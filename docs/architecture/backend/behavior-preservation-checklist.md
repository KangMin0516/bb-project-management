# Behavior Preservation Checklist

> **Mục đích**: liệt kê những hành vi business mà **mọi PR refactor đều phải giữ y nguyên**. Dùng như literal checklist trong PR review: tick từng dòng, dòng nào không apply ghi "N/A — lý do". Nếu một mục thay đổi có chủ ý → phải đưa vào [refactor-plan.md §4 — "Phase nào đổi logic"](./refactor-plan.md) và ghi rõ.

> Companion: [refactor-plan.md](./refactor-plan.md)

---

## 0. How to use

Trước khi merge mỗi PR refactor:

1. **Viết e2e test "before snapshot"** cho mọi flow trong danh sách module sắp đụng — chạy trên code cũ, capture response body.
2. **Refactor code**.
3. **Re-run snapshot test** — phải byte-identical (trừ field `timestamp`, `id` UUID, `createdAt`).
4. **Đi qua per-module checklist bên dưới**, tick từng dòng.
5. **Diff DTO field**: `git diff` các DTO file, chú thích mỗi field bị remove/rename. Nếu FE đang depend → tách commit revert hoặc giữ alias.

---

## 1. Cross-cutting Invariants (mọi module)

### 1.1. Response envelope

| Hành vi | File hiện tại | Verify |
|---|---|---|
| Success: `{ success: true, data: <return> }` | `common/interceptors/transform.interceptor.ts` | e2e GET endpoint → assert `body.success === true && body.data` exists |
| Error: `{ success: false, statusCode, message, timestamp }` | `common/filters/http-exception.filter.ts` | e2e force-404 → assert đủ 4 field |
| Stream response (file download) **bypass** envelope | `upload.controller.ts:getAvatar` | e2e download → assert `Content-Type` không phải `application/json` |
| Webhook response **bypass** envelope (Slack/GitHub) | webhook controllers | e2e webhook → assert `body === ''` hoặc Slack ACK shape |

### 1.2. Prisma error → HTTP code mapping

| Prisma | HTTP | Phải verify với e2e |
|---|---|---|
| `P2002` unique violation | 409 Conflict | Tạo duplicate `Project.key` → 409 |
| `P2003` FK violation | 400 Bad Request | Update issue với `assigneeId` không tồn tại → 400 |
| `P2025` record not found | 404 Not Found | GET issue với id giả → 404 |
| Khác | 500 | (không test specific) |

### 1.3. Auth & permission

| Hành vi | Verify |
|---|---|
| `JwtAuthGuard` global, `@Public()` short-circuit | GET public endpoint không header → 200; protected endpoint không header → 401 |
| `ProjectMemberGuard` resolve project **key** thành UUID trước khi controller chạy → controller luôn nhận UUID | e2e `GET /projects/MYKEY/issues` and `GET /projects/<uuid>/issues` cùng response shape |
| `ProjectMemberGuard` set `request.projectMember` + `request.isSuperuser` cho `RolesGuard` sau đó | Test với non-member → 403 trước khi vào service |
| `@Roles(ADMIN, PM)` reject DEVELOPER | e2e DEVELOPER member gọi delete project → 403 |
| Superuser bypass non-membership check | e2e superuser truy cập project mình không là member → 200 |
| `ApiKeyGuard` dùng cho external API | e2e header `X-API-Key` → ok; thiếu → 401 |

### 1.4. Rate limit + CORS

| Hành vi | Verify |
|---|---|
| `ThrottlerGuard` 30 req/60s default | e2e spam 31 request → 429 |
| CORS origins từ `CORS_ORIGINS` env | OPTIONS preflight từ allowed origin → 200; từ random origin → 4xx |

### 1.5. Activity & audit

| Hành vi | File | Verify |
|---|---|---|
| Mọi issue field change ghi `activity` row | `issue.service.ts:buildActivities` | Update issue.title → assert có activity row mới với field='title' |
| Activity user = actor (người gọi API), không phải assignee | controller resolve `req.user.id` → service | e2e PATCH issue → activity.userId === acting user |
| 10s coalescing: cùng user đổi `assigneeId` 2 lần trong 10s → 1 activity từ giá trị đầu đến cuối | `issue.service.ts:90 coalesceActivityField` | e2e gửi 2 PATCH liên tục → assert 1 activity (không phải 2) |
| Net no-op (A→B→A trong 10s) → xóa activity row, **cancel pending Slack DM** | cùng method | e2e gửi 3 PATCH (A→B→A) → assert 0 activity row mới + Slack adapter mock called 0 times |

> **M2 ghi chú**: cancel pending DM hiện implement bằng cancel `setTimeout`. Sau outbox → phải check current state khi deliver (idempotency). Test này là phép thử quan trọng nhất của M2.

---

## 2. Module: Issue

### 2.1. Create

| # | Invariant | File:line hiện tại |
|---|---|---|
| I-C1 | `EPIC` không được có `parentId` → throw 400 | `issue.service.ts:237` |
| I-C2 | `SUB_TASK` bắt buộc `parentId` → throw 400 | `:242` |
| I-C3 | Parent là `SUB_TASK` → throw 400 | `:262` |
| I-C4 | Tạo issue có `assigneeId` không set + `componentIds` set → auto-fill assignee từ `component.defaultAssigneeId` đầu tiên match | `:291–304` |
| I-C5 | Auto-fill xong vẫn rỗng → assigneeId = null (KHÔNG fail) | cùng | 
| I-C6 | `number` field auto-increment per-project (không phải global) | `:312` (qua Postgres sequence) |
| I-C7 | `order` field cho status mặc định: max(order) + 1000 | `:319` |
| I-C8 | Activity "created" được ghi cùng `$transaction` với Issue | `:303` |
| I-C9 | Khi `assigneeId` set ở create → schedule Slack DM (10s grace) | `:328` notifyAssignment |
| I-C10 | `labelIds`/`componentIds` link qua join table — order không quan trọng | `:286` |

**Edge case test bắt buộc**:
- Tạo issue type=BUG, parent type=EPIC → ok
- Tạo issue type=BUG, parent type=SUB_TASK → 400
- Tạo issue type=SUB_TASK, parent type=TASK → ok
- Tạo issue không assignee, có component có defaultAssignee → assignee = component.defaultAssignee
- 2 user tạo issue cùng project đồng thời → 2 issue có `number` liên tiếp, không trùng

### 2.2. Update

| # | Invariant | File:line |
|---|---|---|
| I-U1 | Validate hierarchy khi đổi `type` hoặc `parentId` (cùng rule create) | `:603` |
| I-U2 | Phát hiện cycle khi đổi `parentId` — walk up parent chain | `:269` |
| I-U3 | `dueDate` trở thành quá khứ + `isRecheck=true` → reset `isRecheck=false` | `:617` (re-grep "isRecheck" để confirm) |
| I-U4 | `archivedAt` set → khóa mọi field write tiếp theo (trừ unarchive) | `:617` archiveReset |
| I-U5 | `assigneeId` đổi → schedule Slack DM với 10s grace period | `:660 → notifyAssignment → notification.service:135` |
| I-U6 | Cùng user đổi `assigneeId` lại trước 10s → cancel pending DM | `notification.service.ts:135` cancel setTimeout |
| I-U7 | Net no-op (A→B→A trong 10s) → 0 DM, 0 activity row | combined |
| I-U8 | Issue type=EPIC update assignee → auto-assign mọi child chưa có assignee + ghi activity cho từng child | `:694 autoAssignUnassignedChildren` |
| I-U9 | Auto-assigned children CŨNG schedule DM riêng (loop) | `:218` |
| I-U10 | Reviewer change → schedule DM riêng cho reviewer (template khác) | `:719` |
| I-U11 | `silent: true` flag trong DTO → KHÔNG trigger notification | `:558` peel silent |
| I-U12 | Activity row trong cùng `$transaction` với issue.update | nested write |

**Edge case test bắt buộc**:
- A→B→A trong 5s cùng user → 0 activity (coalesce + drop)
- A→B→C trong 5s cùng user → 1 activity (oldValue=A, newValue=C)
- A→B trong 5s, **user khác** → 2 activity (coalesce theo user)
- Update EPIC assignee → tất cả children chưa có assignee được set; children đã có giữ nguyên
- Update với `silent=true` → DB write có, notification 0, activity vẫn ghi
- Move issue thành child của descendant của chính nó → 400 "Circular parent reference detected"

### 2.3. Reorder

| # | Invariant | File:line |
|---|---|---|
| I-R1 | Reorder dùng `order` field (float/int gap 1000) | `:782` |
| I-R2 | Khi gap giữa 2 issue < ngưỡng → trigger renormalization (renumber theo step 1000) toàn column | cùng |
| I-R3 | Reorder cross-status → update cả `status` + `order` trong cùng `$transaction` | cùng |
| I-R4 | Reorder không tạo activity (UX choice — pure reorder không log) | confirm trong service |
| I-R5 | `ISSUE_MAX_PER_COLUMN` enforce | `common/constants.ts` |

### 2.4. Bulk operations

| # | Invariant |
|---|---|
| I-B1 | `bulkUpdate` atomic trong `$transaction` |
| I-B2 | `bulkUpdate` set assignee cho N issue → N notification scheduled (không gộp) |
| I-B3 | `bulkDelete` cascade vào activity, label join, component join, link, comment, notification |
| I-B4 | Bulk operation tôn trọng `silent` flag |

### 2.5. Archive vs Delete

| # | Invariant |
|---|---|
| I-A1 | `archivedAt` set → issue ẩn khỏi default list nhưng còn trong DB |
| I-A2 | Scheduler tự archive issue status=DONE + completed > N days (`archive.scheduler.ts`) |
| I-A3 | Hard delete đi qua `prisma.issue.delete` → cascade |

---

## 3. Module: Project

### 3.1. Create

| # | Invariant | File:line |
|---|---|---|
| P-C1 | `key` unique global → P2002 → 409 "Project key already exists" | `:20` ConflictException trước insert |
| P-C2 | Creator được add làm ADMIN member trong cùng prisma.create nested write | `:32` |
| P-C3 | **Mọi superuser ACTIVE** được auto-add làm ADMIN member cùng project | `:25` |
| P-C4 | 6 default label seed: Bug/Feature/Improvement/Documentation/Urgent/Design | `:55` |
| P-C5 | Label seed `skipDuplicates: true` (an toàn nếu chạy lại) | `:66` |
| P-C6 | **⚠️ P7 hiện tại**: project.create và label.createMany KHÔNG trong cùng transaction → có thể project tồn tại với 0 label | `:32, :64` |

> **Behavior change ở M3**: bọc cả 2 vào `$transaction`. **Trước**: partial state có thể xảy ra. **Sau**: atomic. Đây là **fix**, không phải regression.

### 3.2. Update / Find / Delete

| # | Invariant |
|---|---|
| P-U1 | `findOne(idOrKey)` accept cả UUID lẫn `key` — regex check |
| P-U2 | `findAll(userId)` chỉ trả project user là member |
| P-U3 | `findAllWithJoinStatus(userId)` trả tất cả project + flag `isMember`/`myRole`/`pendingJoinRequest` |
| P-U4 | Delete project cascade: members, issues (→ activities, comments, links), labels, components, specifications, credentials, reportConfig, githubIntegration, joinRequests |

---

## 4. Module: JoinRequest

| # | Invariant | File:line |
|---|---|---|
| J-1 | Create: ngăn duplicate PENDING của cùng user/project | `join-request.service.ts:create` |
| J-2 | Create: nếu user đã là member → throw 400 |
| J-3 | Create: gửi Slack DM (fire-and-forget) đến tất cả ADMIN/PM của project | `:24, sendSlackNotification` |
| J-4 | Approve: atomic transaction `[update status, upsert ProjectMember]` | `:131` |
| J-5 | Approve: gửi notification (in-app + Slack) cho requester | `:161` |
| J-6 | Reject: update status, không tạo member, gửi notification cho requester |
| J-7 | Cancel: chỉ requester mới được cancel chính request của mình |
| J-8 | Approve/reject chỉ ADMIN/PM của project được phép (guard) |
| J-9 | **⚠️ P9 hiện tại**: `process.env.FRONTEND_URL` fallback hardcoded `'https://pm.burningbros.kr'` | `:244` |

> **Behavior change ở M3**: chuyển sang `ConfigService.get('FRONTEND_URL')`. Nếu env không set → service throw startup time (fail fast), không runtime fallback. Document trong `.env.example`.

---

## 5. Module: Notification

### 5.1. Delivery semantics — current

| # | Invariant | File:line |
|---|---|---|
| N-1 | In-app `Notification` row là **source of truth** | `notification.service.ts:create` |
| N-2 | Slack DM là **best-effort**, swallow error log warn | `:184–256` |
| N-3 | `ASSIGNED` + `REVIEWER_ASSIGNED` types → schedule với 10s grace, có cancel | `:135` |
| N-4 | Type khác (`COMMENTED`, `MENTIONED`, `JOIN_*`, etc.) → immediate `create` + Slack (nếu có) | `:100` |
| N-5 | Notification rows persist cả khi Slack fail | logger.warn nuốt |
| N-6 | Mark read: `notification.markAsRead`, không xóa row |
| N-7 | Mark all read: `notification.markAllAsRead(userId)` filter unread |

### 5.2. Delivery semantics — sau M2 (intentional change)

| # | Hành vi mới | Chấp nhận được? |
|---|---|---|
| N-NEW1 | `ASSIGNED`/`REVIEWER_ASSIGNED` outbox row với `next_retry_at = now() + 10s` | ✅ |
| N-NEW2 | Pod restart trong grace period → outbox publisher pickup, vẫn deliver | ✅ improvement |
| N-NEW3 | Cancel logic: thay vì timer cancel, deliver-time check: nếu `issue.assigneeId` ≠ payload.assigneeId → skip (no Slack call, no notification row) | ✅ same UX outcome |
| N-NEW4 | Net no-op (A→B→A trong 10s): hai outbox row, cả 2 đều "skip" khi deliver (DB state ≠ payload) → 0 Slack DM | ✅ same |
| N-NEW5 | Delivery latency P95 tăng từ ~10s lên 10–15s | ⚠️ accept |
| N-NEW6 | Duplicate risk edge case: pod chết giữa `mark delivered` và Slack ACK → có thể double-send | Mitigate idempotency key, accept |

**Test required cho M2 cutover**:
- 1 assign → 1 Slack DM trong 10–15s
- A→B→A trong 5s → 0 Slack DM (idempotency win)
- Assign rồi restart pod trong 5s → vẫn deliver
- 100 concurrent assign → 100 unique DM trong 30s

---

## 6. Module: Slack

### 6.1. Adapter behavior (M1 cutover)

| # | Invariant | Bằng chứng cũ |
|---|---|---|
| S-1 | `sendDirectMessage` throw fail → caller phải swallow (`.catch`) | `notification.service.ts:184` đã swallow |
| S-2 | Token decrypt qua `EncryptionService` trước khi truyền vào WebClient | `slack.service.ts:44` |
| S-3 | Bot user impersonation: dùng `as_user: false` hay `as_user: true`? | grep `chat.postMessage` args |
| S-4 | Block Kit JSON shape không đổi (FE/UX không thay) | snapshot test message payload |
| S-5 | Rate limit Slack 1 msg/sec/channel — adapter có queue/backoff? | hiện tại không có; giữ behavior, monitor 429 |
| S-6 | OAuth token refresh: WebClient tự refresh không? | grep refresh flow |
| S-7 | Webhook signature verify (HMAC-SHA256) | `slack.controller.ts` |

### 6.2. Standup-specific behaviors

| # | Invariant |
|---|---|
| ST-1 | Standup schedule trigger theo timezone của project config |
| ST-2 | Standup question parse từ Slack reply (regex/structured) — pattern không đổi |
| ST-3 | Quick-issue creation từ Slack DM: `quickIssueService.create` → `IssueService` |
| ST-4 | Standup DM thread reply ghi vào `StandupAnswer` table |
| ST-5 | Late reply (sau cutoff) → marked late nhưng vẫn record |

> **M4 split warning**: nhiều method `private` trong `StandupService` được call chéo nhau. Trước split, grep `this.` để liệt kê call graph; mỗi method private dùng cross-class phải đổi thành dependency inject hoặc giữ trong same class.

---

## 7. Module: External API

| # | Invariant | File |
|---|---|---|
| E-1 | `ApiKeyGuard` thay JWT | `api-key/api-key.guard.ts` |
| E-2 | API key scope: project-level, không global | `external.module.ts` |
| E-3 | Bulk external update issue: idempotent (call lại cùng payload → same result) | `external.service.ts` |
| E-4 | Response shape qua `external/dto/*` — KHÔNG trùng response internal (FE-internal có envelope khác) | dto folder |
| E-5 | Rate limit nghiêm hơn (theo ApiKey) — verify khi refactor |

---

## 8. Module: Dashboard

Dashboard là read-only — không có domain write, refactor ít rủi ro logic. Nhưng phải preserve:

| # | Invariant |
|---|---|
| D-1 | Query timezone của user (focus, today, due) — không UTC |
| D-2 | "Focus today" định nghĩa: `focusDate === today` trong timezone server |
| D-3 | "Overdue": `dueDate < now() AND status ∉ {DONE, CLOSED}` (verify TERMINAL_STATUSES) |
| D-4 | Burndown data point shape: `{ date, remaining, completed }` |
| D-5 | Workload aggregate: count active issues (not archived) per assignee |
| D-6 | Permission: dashboard endpoint cho project member; team dashboard chỉ superuser |
| D-7 | Performance: aggregate query không N+1 — verify EXPLAIN ANALYZE sau khi tách Query Service |
| D-8 | Pagination: limit 200 default cho list endpoints, vẫn vậy sau refactor |

---

## 9. Module: Issue link / Comment / Spec link

| # | Invariant |
|---|---|
| L-1 | Issue link bi-directional (link A→B → query B trả link đến A) |
| L-2 | Link type enum: `BLOCKS`, `BLOCKED_BY`, `RELATES_TO`, `DUPLICATES`, `DUPLICATED_BY` — pair logic |
| L-3 | Comment @mention parser: `@username` regex giống FE — verify regex |
| L-4 | Comment mention → notification per mentioned user |
| L-5 | Spec link: link issue ↔ specification section; cascade delete khi spec section bị xóa |

---

## 10. Cross-cutting: Database transaction integrity

Mọi flow dưới phải atomic. Refactor không được tách ra ngoài transaction.

| Flow | Hiện tại | Sau |
|---|---|---|
| Issue create + initial activity | `prisma.issue.create` với nested `activity.create` (1 statement) | Giữ |
| Issue update + activity | `prisma.issue.update` với nested activity (1 statement) | Giữ |
| Auto-assign children + activity batch | `$transaction([updateMany, activity.createMany])` | Giữ |
| Reorder issues | `$transaction(...)` | Giữ |
| Join request approve + member upsert | `$transaction([update, upsert])` | Giữ |
| Project create + label seed | **Không atomic ⚠️** | **Atomic sau M3** |
| Issue + outbox event | N/A | **Mới: cùng `$transaction`** (critical cho M2) |

---

## 11. Pre-M0 audit tasks (làm 1 lần, trước khi viết bất cứ refactor code nào)

| # | Audit | Output |
|---|---|---|
| AU-1 | Snapshot toàn bộ response của 30 endpoint hot path | File `tests/snapshots/api-v0.json` (per endpoint) |
| AU-2 | Grep `data: dto` spread → list field whitelist cho từng controller | `audit/dto-leak.md` |
| AU-3 | Grep `process.env` ngoài `*.config.ts` → list env var bypass | `audit/env-bypass.md` |
| AU-4 | Grep `.catch(() => {})` và `.catch((e) => logger.warn(...))` → list silent failure | `audit/silent-failures.md` |
| AU-5 | Liệt kê private method cross-class usage (Standup, Dashboard) | `audit/private-call-graph.md` |
| AU-6 | Verify mọi Prisma transaction → list các multi-write thiếu `$transaction` | `audit/missing-transactions.md` |
| AU-7 | Snapshot Slack message payload (Block Kit) cho từng notification type | `tests/snapshots/slack-messages/<type>.json` |

---

## 12. PR Review template (paste vào mỗi refactor PR)

```markdown
## Refactor PR Checklist — <module>

### Module-specific (xem behavior-preservation-checklist.md §<n>)
- [ ] All <N> invariants in module section verified by e2e tests
- [ ] Listed below if any intentional behavior change: <none | list>

### Cross-cutting (§1)
- [ ] Response envelope unchanged (snapshot test pass)
- [ ] Prisma error mapping unchanged
- [ ] Auth/guard order unchanged
- [ ] Activity coalesce window 10s preserved
- [ ] Silent flag semantics preserved (where applicable)

### Transaction integrity (§10)
- [ ] No multi-write moved outside `$transaction`
- [ ] Outbox insert (if any) **inside** the business `$transaction`

### Tests
- [ ] Snapshot test diff = empty
- [ ] ≥3 unit tests for new use case / port / adapter
- [ ] e2e happy path passing
- [ ] e2e error path (404, 403, 400 unique) passing

### Rollback
- [ ] Feature flag added (if M1/M2) or single-commit revert plan documented
```

---

> **Một dòng cuối**: dài như vậy nhưng nguyên tắc đơn giản — **không phải invariant trong file này thì không được đổi, là invariant trong file này thì test trước rồi mới sửa**.
