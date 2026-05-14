# Outbox Rollout Runbook

> **Mục đích**: bật transactional outbox cho hai event types đang
> gated behind feature flag (`USE_OUTBOX_FOR_ISSUE_ASSIGNED`,
> `USE_OUTBOX_FOR_JOIN_REQUEST_ADMIN_DM`) một cách canary, có monitor
> + rollback rõ ràng. Fix functional bug P5 (lost notifications on
> pod restart).

> Companion docs:
> - [refactor-plan.md §5](./refactor-plan.md) — outbox design
> - [behavior-preservation-checklist.md §5.2](./behavior-preservation-checklist.md) — intentional behavior changes (N-NEW1..N-NEW6)

---

## 0. Pre-flight checklist (làm 1 lần, không liên quan timeline rollout)

| ✓ | Item | Verify |
|---|---|---|
| ☐ | Migration `20260514103248_add_outbox_events` đã apply trên prod DB | `psql -c "\d outbox_events"` shows table |
| ☐ | OutboxPublisher cron đang chạy (poll 5s) | Server logs show `[OutboxPublisher]` debug messages, không có crash |
| ☐ | Handlers registered ở module init | Hit `/admin/outbox/health` while flag off — `pendingByType` rỗng vì chưa producer publish; không có error trong log |
| ☐ | `OutboxRetentionScheduler` đăng ký | Server logs show `[OutboxRetentionScheduler]` debug at next 03:00 UTC, hoặc grep "Pruned" |
| ☐ | Backup script kiểm tra: ENV var đọc đúng | `kubectl exec ... -- printenv USE_OUTBOX_FOR_ISSUE_ASSIGNED` returns "false" hoặc unset |

---

## 1. Decision matrix — bật flag nào trước?

Bật **JoinRequestAdminDm trước**, **IssueAssigned sau**. Lý do:

| Tiêu chí | JoinRequestAdminDm | IssueAssigned |
|---|---|---|
| Volume | Thấp (~vài /ngày) | Trung bình (~vài chục /ngày) |
| Cancel semantics | Không (fire-and-forget) | Có (10s grace + state-check idempotency) |
| Behavior change | Per-recipient retry — strictly better | Latency +5s, idempotency via state-check |
| Rollback risk | Trivial (flag back to false) | Cao hơn (cancel logic semantics differ) |
| Functional bug fix | Slack outage retry | P5: lost on pod restart |

→ JoinRequestAdminDm là **lower-risk warm-up** trước khi đụng IssueAssigned.

---

## 2. Rollout plan — 4 stages

### Stage A: Staging — JoinRequestAdminDm

**Duration**: 3 ngày

**Pre-flight**:
- ☐ Deploy current `main` (sau khi merge refactor branch) lên staging
- ☐ Verify staging có Slack integration installed
- ☐ Have at least 1 staging admin user with `slackUserId` set

**Action**:
```bash
# Set on staging
USE_OUTBOX_FOR_JOIN_REQUEST_ADMIN_DM=true
```
Restart staging app.

**Acceptance** (must all be true to proceed):

| # | Test | Expected |
|---|---|---|
| A1 | Trigger join-request via web UI | Slack DM arrives within 15s |
| A2 | Inspect `outbox_events` table | Row created with `event_type='JoinRequestAdminDmDelivery'`, `delivered_at` populated within 15s |
| A3 | Kill Slack webhook (Block outbound to slack.com for 30s) → trigger join-request → restore Slack | Row stays pending while blocked, deliver after restore. `attempts >= 1`, `last_error` set |
| A4 | `GET /admin/outbox/health` | `parkedCount: 0`, `oldestPendingAgeSeconds < 60` |
| A5 | Server logs | No `OutboxPublisher pump tick crashed` errors |
| A6 | Manual: open 5 join-requests in 1 minute | All 5 admins DM'd; outbox table has 5 rows, all delivered |

**Rollback** (if any of above fails):
```bash
USE_OUTBOX_FOR_JOIN_REQUEST_ADMIN_DM=false
```
Restart. Legacy fire-and-forget path resumes. Investigate the failed scenario; do NOT proceed to prod.

---

### Stage B: Production — JoinRequestAdminDm (1 project canary)

**Duration**: 1 week

**Pre-flight**:
- ☐ Stage A passed all criteria
- ☐ Verify prod migration applied
- ☐ Identify a low-traffic project to canary; communicate to its team

**Action**:
```bash
USE_OUTBOX_FOR_JOIN_REQUEST_ADMIN_DM=true
```
Restart prod app.

(Flag is global, can't canary by project natively. Risk acceptable because: legacy fallback exists for any race with a previously-installed app; the behavior change is strictly safer.)

**Daily monitoring** (operator runs these 1×/day):

```sql
-- Count of un-delivered rows older than 5 minutes (should stay near zero)
SELECT COUNT(*) FROM outbox_events
WHERE delivered_at IS NULL AND occurred_at < NOW() - INTERVAL '5 minutes';

-- Parked rows (attempts hit ceiling) — should be zero
SELECT id, event_type, aggregate_id, attempts, last_error, occurred_at
FROM outbox_events
WHERE delivered_at IS NULL AND attempts >= 8
ORDER BY attempts DESC;

-- Recent errors grouped by type
SELECT event_type, COUNT(*) as failed, MAX(last_error) as latest_error
FROM outbox_events
WHERE delivered_at IS NULL AND attempts > 0
GROUP BY event_type;
```

Or hit `/admin/outbox/health` from a superuser session.

**Acceptance**:
- 0 parked rows for 1 week
- Median delivery latency < 15s
- No `OutboxPublisher pump tick crashed` errors
- User-facing: admin Slack DMs still arrive (sample N>10 manually)

**Rollback**:
Same flag toggle as Stage A. Legacy path resumes; pending outbox rows stay (they'll be delivered when flag turns back on, OR drained by retention if you wait 30 days).

---

### Stage C: Staging — IssueAssigned

**Duration**: 5 ngày

**Pre-flight**:
- ☐ Stage B passed 1 week clean
- ☐ Confirm engineering team knows about behaviour change N-NEW5 (latency +5s) — communicate to UX

**Action**:
```bash
USE_OUTBOX_FOR_ISSUE_ASSIGNED=true
```
Restart staging.

**Acceptance** — same as Stage A but with assignment-specific scenarios:

| # | Test | Expected |
|---|---|---|
| C1 | Assign issue to user with `slackUserId` | Slack DM arrives within 10–15s |
| C2 | Assign issue, then immediately unassign within 5s | 0 Slack DM (state-check idempotency, N-NEW3) |
| C3 | Assign issue, kill pod within 5s, restart pod | Slack DM still delivers after restart (P5 fix verified) |
| C4 | Assign to A, change to B within 5s | DM goes to B only, not A |
| C5 | Bulk-assign 20 issues to one user | 20 outbox rows, 20 DMs within 30s |
| C6 | `GET /admin/outbox/health` | `parkedCount: 0`, `pendingByType` shows both event types |
| C7 | UI "Undo" click within grace period | `cancelPendingAssignment` deletes the undelivered row; verify in DB |

**Rollback**:
```bash
USE_OUTBOX_FOR_ISSUE_ASSIGNED=false
```
Restart. Legacy `setTimeout` path resumes. Undelivered outbox rows stay; retention prunes them in 30 days.

---

### Stage D: Production — IssueAssigned

**Duration**: ongoing

**Pre-flight**:
- ☐ Stage C passed all criteria

**Action + monitoring**: same template as Stage B.

**Specific acceptance after 2 weeks clean**:
- 0 reports of "I assigned someone but they didn't get notified"
- 0 reports of "I got assigned, then unassigned within 10s, but still got a Slack ping"
- P5 functional bug officially closed

---

## 3. Cleanup phase (sau Stage D + 2 weeks stable)

Khi cả 2 flags đã ON trên prod ≥ 2 tuần stable:

1. **Delete legacy fallback code paths**:
   - `notification.service.ts`: xóa `pendingAssignmentTimers` Map + legacy `setTimeout` branch
   - `notification.service.ts`: xóa `cancelPendingAssignmentByKey` helper
   - `create-join-request.use-case.ts`: xóa legacy loop branch
2. **Remove feature flag reads**:
   - `useOutboxForAssignment()`, `useOutboxForAdminDm()` always return true → inline removal
3. **Remove ENV vars** from `docker-compose.prod.yml` (nếu đã set)
4. **Update `refactor-plan.md`** §1.1 P5 status to "RESOLVED" + reference rollout dates

Commit message template:
```
chore(api): finalize outbox rollout — remove legacy fallback paths

USE_OUTBOX_FOR_ISSUE_ASSIGNED + USE_OUTBOX_FOR_JOIN_REQUEST_ADMIN_DM
both observed stable for 2 weeks on production. Remove the gated
fallback paths and the in-memory setTimeout map. P5 (lost
notifications on pod restart) closed.
```

---

## 4. Operational reference

### Replay a parked row manually

If a row is parked (`attempts >= 8`) and you've fixed the underlying
cause (added a missing handler, fixed a Slack permission), reset it:

```sql
UPDATE outbox_events
SET attempts = 0, next_retry_at = NOW(), last_error = NULL
WHERE id = '<uuid>';
```

Publisher picks it up on the next tick.

### Drop a row that should never deliver

E.g. row points to a deleted user / project. Hard delete:

```sql
DELETE FROM outbox_events WHERE id = '<uuid>';
```

### Inspect a payload before replaying

```sql
SELECT id, event_type, aggregate_id, payload, attempts, last_error
FROM outbox_events
WHERE id = '<uuid>';
```

### Force-deliver everything pending (emergency drain)

Don't. Let the publisher do its job. If the publisher is broken,
fix the publisher and let it catch up naturally.

---

## 5. SLO targets (per `refactor-plan.md` §9.2)

| Metric | Target | How measured |
|---|---|---|
| Notification delivery loss rate | < 0.1% | (Rows pending > 1h with no error) / (rows delivered + pending) |
| Notification delivery P95 latency | < 15s | `delivered_at - occurred_at` percentile |
| Parked count | 0 sustained | `/admin/outbox/health` parkedCount |
| Outbox table size | < 10MB | `pg_total_relation_size('outbox_events')` post-prune |

If any SLO is breached for > 24h → revert the relevant flag, investigate, redo from earlier stage.

---

## 6. Risk register specific to rollout

| # | Risk | P | I | Mitigation |
|---|---|---|---|---|
| RR1 | Publisher crash leaves rows stuck pending | L | H | Single mutex flag in publisher; @Cron retries; monitor `oldestPendingAgeSeconds` |
| RR2 | Duplicate Slack DM (pod restarts after delivery commit but before mark) | L | M | Accept (slack-side dedupe via blocks hash is overkill; we logged it as N-NEW6) |
| RR3 | Handler registry doesn't have a handler for the event type | M | M | Publisher marks failed + log warn — visible in `/admin/outbox/health.pendingByType` |
| RR4 | Backoff cap too high (1h) starves fresh events | L | L | New rows have `next_retry_at = now()`, scanned first by sequence_no order |
| RR5 | FOR UPDATE SKIP LOCKED contention with retention DELETE | L | M | Retention runs at 03:00 UTC; publisher tick is 5s — windows interleave but don't block (LOCKED rows are skipped on both sides) |

Done.
