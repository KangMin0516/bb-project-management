# Event-Driven Patterns (reusable building blocks)

When the design is event-driven, every doc in the reference corpus assembles a subset of these patterns. Use this file as a checklist when writing the "Component breakdown" section.

---

## 1. Transactional Outbox

**Problem:** "DB committed but event never published" or "event published but DB rollback".

**Solution:** Within the *same DB transaction* as the domain write, insert a row into `outbox_events`. A separate poller publishes unsent rows to the broker and marks them sent.

```typescript
async function createOrder(input) {
  return dataSource.transaction(async (tx) => {
    const order = await tx.save(Order, input);
    await tx.save(OutboxEvent, {
      aggregateId: order.id,
      eventType: 'order.created',
      routingKey: `order.created.${order.id}`,
      payload: { orderId: order.id, ... },
    });
    return order;
  });
}

// Separate process, leader-elected via pg_advisory_lock
@Cron('*/2 * * * * *')
async function publishOutbox() {
  if (!(await tryAcquireLeaderLock('outbox'))) return;
  const batch = await outboxRepo.findUnpublished(100);
  for (const ev of batch) {
    try {
      await broker.publish(ev.routingKey, ev.payload);
      await outboxRepo.markPublished(ev.id);
    } catch (e) {
      await outboxRepo.incrementAttempt(ev.id, e.message);
    }
  }
}
```

**Doc beats to include:**
- Outbox SQL (see `sql-patterns.md` §1)
- A sequence diagram showing `DB commit → outbox row → broker publish → consumer`
- Leader-election strategy (advisory lock, single-replica deployment, or k8s leader-election sidecar)

---

## 2. Prefetch=1 / one-worker-one-job

For long-lived jobs (encoding, large I/O), set `channel.prefetch(1)` so a worker holds exactly one in-flight message. Combined with manual ack, this gives you:

- Natural backpressure (queue depth = remaining work)
- Easy graceful shutdown ("finish current job, then exit")
- One process per VM/pod scaling story

For short jobs (HTTP submit, status sync), use `prefetch=N` (4–20) and design handlers to be CPU-light.

---

## 3. Idempotency

Every consumer must tolerate duplicates. Three layers:

1. **Producer side:** include a stable `event_id` (UUID v7 or content hash) per event.
2. **Consumer side dedupe:** before doing work, `SET NX` in Redis with key `processed:<event_id>` and TTL = 2× expected processing time.
3. **DB side guard:** unique constraint or `INSERT … ON CONFLICT DO NOTHING` on the operation's natural key.

Document this in the event catalog with a `Dedupe key` column when non-obvious.

---

## 4. Dead Letter Queue (DLQ)

Pattern: every work queue has `x-dead-letter-exchange` pointing to a fanout DLX, which fans out to per-queue `*.dead` queues.

Triggers for moving to DLQ:
- Explicit `nack(requeue=false)` after max retries
- Message TTL expiry (`x-message-ttl`)
- Queue length limit (`x-max-length`)

Document includes:
- DLQ queue in the topology diagram
- Alerting rule: "any message in DLQ → page on-call"
- Manual replay path: a CLI / admin endpoint to re-publish DLQ messages

---

## 5. Retry with backoff (without blocking the channel)

Don't `setTimeout(() => retry, …)` inside a consumer — it pins the channel. Instead:

- Publish a copy of the message to a **delay queue** (`x-message-ttl=2^attempt * 1000` + `x-dead-letter-exchange=main`) and ack the original.
- Or use a delayed-message exchange plugin.
- Or write to DB as `RETRY_AT=now+delay` and let the scheduler re-publish.

Document the retry policy:
- Max attempts (typical: 3–5)
- Backoff curve (typical: exponential 2^n seconds, capped at 5 min)
- Terminal action (DLQ + alert)

---

## 6. Circuit breaker per external dependency

State machine: `CLOSED → OPEN → HALF_OPEN → CLOSED`.

- `CLOSED`: normal calls
- `OPEN`: skip calls, throw immediately for cooldown duration
- `HALF_OPEN`: let one probe through to test recovery

```typescript
class CircuitBreaker {
  async call<T>(fn: () => Promise<T>): Promise<T> {
    const state = await this.getState();
    if (state === 'OPEN') {
      if (!(await this.shouldProbeHalfOpen())) {
        throw new CircuitOpenError(this.cooldownMs());
      }
    }
    try {
      const r = await fn();
      await this.recordSuccess();
      return r;
    } catch (e) {
      await this.recordFailure();
      throw e;
    }
  }
}
```

Defaults to document:
- `failureThreshold: 5 consecutive`
- `cooldownMs: 30_000` (exponential up to 5 min)
- `halfOpenProbes: 1`

Pair with a sequence diagram: "Provider down → 5 failures → OPEN → 30s cooldown → HALF_OPEN probe → CLOSED".

---

## 7. Token bucket rate limiter (per provider)

Stored in Redis as `tokens` + `last_refill` keys.

```
rate: 10 req/s
burst: 20
algorithm: token bucket
worker behavior:
  - try consume 1 token
  - if no token: nack with delay = (1 / rate) seconds, do not block channel
```

Doc beats:
- Per-provider settings table
- A note on why this is per-*provider*, not per-*worker* (multiple workers must share the bucket via Redis)

---

## 8. Saga / event chain

For multi-step workflows where each step is a separate consumer:

```
order.created
   → order.submission.requested
       → order.submission.succeeded   (happy path)
       → order.submission.failed      (compensating: quota.refund)
   → order.completed
       → notification.send
       → analytics.record
```

Document with a sequence diagram + the event catalog showing the chain in the `Consumer(s)` column.

---

## 9. Autoscaler controller loop

```
every 15s:
  1. measure: queue_depth + running_jobs
  2. measure: current capacity (active workers / VMs)
  3. compute: desired = ceil(total_demand / jobs_per_worker) + HEADROOM
  4. cap: min(desired, MAX_WORKERS)
  5. scale up: start workers from warm pool, then ASG burst
  6. scale down: drain (signal worker, don't kill), then stop when idle
```

Cooldowns to prevent flapping:
- `scaleUpCooldownSec: 60`
- `scaleDownCooldownSec: 300`
- Scale-up wins over scale-down ties (latency-sensitive)

---

## 10. Leader election (single-instance roles)

Three options:

| Approach | Use when |
|---|---|
| `pg_advisory_lock(hashtext('role'))` | Already on Postgres, no extra infra |
| Redis SETNX with TTL refresh | Already on Redis, lower latency |
| k8s leader-election (lease object) | Running on Kubernetes |

For schedulers, outbox publishers, and reapers, always document which option you picked.

---

## 11. Event catalog conventions

Routing key shape: `<domain>.<aggregate>.<verb>[.<id>]`

Examples:
```
order.created.{order_id}
order.submission.requested.{provider}.{order_id}
order.submission.succeeded.{provider}.{order_id}
encoder.job.heartbeat.{vm_id}
provider.degraded.{provider_name}
```

The catalog table column set: `Event | Producer | Consumer(s) | Purpose` (and optionally `Dedupe key` when non-trivial).

---

## 12. Observability requirements (always include)

Every event-driven doc must include this in the SLO / hardening section:

- Broker exporter → Prometheus → Grafana dashboard
- Per-queue panels: depth, publish/consume rate, redelivered rate, DLQ size
- Per-handler panels: processing latency P50/P95/P99, error rate
- Alerting rules:
  - Queue depth > threshold for > N min
  - DLQ has any messages (page)
  - Outbox publish lag > 5s P99
  - Circuit breaker OPEN for > 5 min
