# SQL Patterns for Architecture Docs

Drop these into the "Schema changes" section, adapted to the target schema.

---

## 1. Outbox table (transactional outbox pattern)

```sql
CREATE TABLE <schema>.outbox_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id  UUID NOT NULL,
  event_type    VARCHAR(64) NOT NULL,
  routing_key   VARCHAR(128) NOT NULL,
  payload       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at  TIMESTAMPTZ NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  last_error    TEXT
);

-- Partial index: only scan unpublished rows
CREATE INDEX idx_<schema>_outbox_unpublished
  ON <schema>.outbox_events (created_at)
  WHERE published_at IS NULL;
```

**Why partial index:** an outbox grows forever; a partial index keeps the publisher's scan O(unpublished_count) instead of O(total).

---

## 2. Atomic "claim" UPDATE (multi-instance scheduler safe)

```sql
-- Returns claimed rows; concurrent callers don't double-claim
UPDATE <schema>.<table>
SET status = 'CLAIMED', claimed_at = NOW()
WHERE id IN (
  SELECT id FROM <schema>.<table>
   WHERE status = 'PENDING' AND scheduled_at <= NOW()
   ORDER BY scheduled_at
   LIMIT 100
   FOR UPDATE SKIP LOCKED
)
RETURNING id;
```

`FOR UPDATE SKIP LOCKED` lets N workers run this concurrently without blocking each other.

---

## 3. PG advisory lock (for quota / single-writer guarantees)

```sql
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('quota:' || $user_id::text));

-- All updates here are serialized per user_id without locking other rows
SELECT used_amount FROM quota_cycles WHERE user_id = $user_id;
UPDATE quota_cycles SET used_amount = used_amount + $cost WHERE user_id = $user_id;

COMMIT;  -- lock auto-released
```

---

## 4. Provider-call audit log

```sql
CREATE TABLE <schema>.provider_calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name   VARCHAR(50) NOT NULL,
  endpoint        VARCHAR(100),
  request_payload JSONB,
  response_status INT,
  response_body   JSONB,
  duration_ms     INT,
  error_message   TEXT,
  correlation_id  UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_provider_calls_corr
  ON <schema>.provider_calls (correlation_id, created_at DESC);
```

---

## 5. Circuit-breaker state table (or use Redis)

```sql
CREATE TABLE <schema>.provider_health (
  provider_name        VARCHAR(50) PRIMARY KEY,
  state                VARCHAR(20) NOT NULL DEFAULT 'CLOSED', -- CLOSED|OPEN|HALF_OPEN
  consecutive_failures INT DEFAULT 0,
  last_failure_at      TIMESTAMPTZ,
  cooldown_until       TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. Idempotency key (request-level dedupe)

```sql
CREATE TABLE <schema>.idempotency_keys (
  key            VARCHAR(128) PRIMARY KEY,
  request_hash   VARCHAR(64) NOT NULL,
  response_body  JSONB,
  response_status INT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_idempotency_expires
  ON <schema>.idempotency_keys (expires_at);
```

Use Redis instead when you don't need durability beyond TTL.

---

## 7. Worker pool / VM state (autoscaler-driven)

```sql
ALTER TABLE <schema>.worker_pool
  ADD COLUMN cloud_resource_id VARCHAR(64),
  ADD COLUMN state             VARCHAR(20) DEFAULT 'STOPPED',
    -- STOPPED | STARTING | RUNNING | DRAINING
  ADD COLUMN current_job_id    UUID NULL,
  ADD COLUMN drain_started_at  TIMESTAMPTZ,
  ADD COLUMN last_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN pool_tier         VARCHAR(20) DEFAULT 'warm';
    -- warm = pre-provisioned, asg = autoscaling group
```

---

## 8. Scaler audit log

```sql
CREATE TABLE <schema>.scaler_actions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action                VARCHAR(20), -- SCALE_UP|SCALE_DOWN|START|STOP|DRAIN
  resource_id           UUID,
  queue_depth_at_time   INT,
  running_jobs_at_time  INT,
  desired_count         INT,
  created_at            TIMESTAMPTZ DEFAULT now()
);
```

---

## 9. Partial / sync-cadence indexes

```sql
-- Only index rows we actively poll for
CREATE INDEX idx_jobs_active_sync
  ON <schema>.jobs (last_synced_at NULLS FIRST)
  WHERE status IN ('PROCESSING', 'RUNNING', 'PARTIAL');

CREATE INDEX idx_jobs_scheduled_due
  ON <schema>.jobs (scheduled_at)
  WHERE status = 'SCHEDULED';
```

---

## 10. Enum evolution (Postgres)

```sql
-- Always ADD VALUE; never DROP — keeps migrations forward-compatible
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'SUBMITTING_QUEUED';
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'PROVIDER_UNAVAILABLE';
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'REFUNDED';
```

---

## 11. Rules of thumb

- **Every domain table gets `created_at` / `updated_at` TIMESTAMPTZ.**
- **Every event in an outbox row is published at-least-once** — consumers must dedupe.
- **Partial indexes** beat full indexes for queues / scan tables.
- **`FOR UPDATE SKIP LOCKED`** is the default for "claim one row" semantics.
- **Advisory locks** for cross-row invariants (quota, leader election).
- **Never drop enum values** — add only. Rename via new value + backfill + remove later.
