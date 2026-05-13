# Patterns

The shapes you'll recognise after reading a few services. Each has a "Use when"
and a "Don't use for" — most introduce non-trivial cost (memory, complexity,
operational surface), so they need to earn their place.

---

## 1. Layered guard composition

**Where:** `common/guards/{jwt-auth,roles,project-member,superuser}.guard.ts`,
applied per-controller via `@UseGuards(...)`.

**Shape.** Guards stack from least specific (auth) to most specific
(role). They communicate by attaching enrichment to `request` so each later
guard avoids a duplicate query.

```ts
@Controller('projects/:projectId/issues')
@UseGuards(ProjectMemberGuard)   // sets request.projectMember + request.isSuperuser
export class IssueController {
  @Patch(':issueId')
  // ...JwtAuthGuard ran globally before this; no @Roles needed for member-only ops
}

@Patch(':projectId')
@UseGuards(RolesGuard)
@Roles(ProjectRole.ADMIN, ProjectRole.PM)  // checks the request.projectMember.role
update(...) { /* ... */ }
```

**Key invariants.**

- `ProjectMemberGuard` does two things: resolves a project *key* to a UUID
  (mutating `request.params.projectId`) and attaches `request.projectMember`.
  This is what lets `:projectId` in a URL accept either form.
- `RolesGuard` checks `request.projectMember.role` *if already attached*, and
  only falls back to a DB query otherwise. Avoids one redundant query per
  request when both guards apply.
- `@Public()` short-circuits `JwtAuthGuard`. The external API uses it together
  with `@UseGuards(ApiKeyGuard)`.

**Don't use for:** ad-hoc per-route permission checks. Those go in the
service as a private `ensureCanX(...)` method that throws
`ForbiddenException`. Guards are for membership-shaped questions.

---

## 2. Response envelope + Prisma-aware error filter

**Where:** `common/interceptors/transform.interceptor.ts`,
`common/filters/http-exception.filter.ts`.

Every response is wrapped at the interceptor:

```json
{ "success": true, "data": <controller return> }
```

Every error is shaped at the filter, with Prisma codes promoted to HTTP
statuses:

| Prisma | HTTP | Message |
|---|---|---|
| `P2002` (unique violation) | `409 Conflict` | "A record with this value already exists" |
| `P2003` (FK violation) | `400 Bad Request` | "Referenced record does not exist" |
| `P2025` (record not found) | `404 Not Found` | "Record not found" |
| Other `PrismaClientKnownRequestError` | `500` | (default) |

```json
{ "success": false, "statusCode": 404, "message": "...", "timestamp": "..." }
```

The frontend's `apiClient` is built around this envelope. **Never bypass it**
by returning `Response`/`res.json(...)` directly — the frontend will fail to
unwrap.

**Don't use for:** binary responses (file streams). `UploadController.getAvatar`
returns a stream and sets headers manually; it stays outside the envelope by
not returning a JSON-able value (the interceptor lets streams pass through).

---

## 3. Deferred-with-cancel side effects (the "Undo" pattern)

**Where:** `notification/notification.service.ts:scheduleAssignmentNotification`
+ `issue/issue.service.ts` calling sites.

**Why.** Assignment changes fire a Slack DM. We give the user 10 seconds to
*undo* before the DM goes out, so a mis-click doesn't ping the wrong person.

**Shape.**

```ts
// In NotificationService:
private readonly pendingAssignmentTimers = new Map<string, NodeJS.Timeout>();

scheduleAssignmentNotification(data) {
  const key = `${data.type}:${data.issueId}`;
  this.cancelPendingAssignmentByKey(key);   // replace if one's already pending
  const timer = setTimeout(() => {
    this.pendingAssignmentTimers.delete(key);
    this.create(data).catch(/* log */);
  }, 10_000);
  timer.unref?.();                          // don't keep the process alive
  this.pendingAssignmentTimers.set(key, timer);
}

cancelPendingAssignment(issueId, type = 'ASSIGNED'): boolean {
  /* clears the timer if found */
}
```

**The undo path** (frontend → backend):

```
PATCH /issues/:id  body: { assigneeId: <prev>, silent: true }
  → IssueService.update → params.silent === true
    → notificationService.cancelPendingAssignment(issueId, 'ASSIGNED')
```

**Invariants.**

- Key is `${type}:${issueId}` so primary-assignee and reviewer changes on
  the same issue can be pending in parallel.
- Within the same `(type, issue)` slot, a new schedule *overwrites* the
  previous one. Two rapid clicks coalesce to the latest target.
- The DB row (`Notification`) is created *when the timer fires*, not when
  the assignment changes. An undone assignment leaves zero trace.
- In-memory only. Server restart drops pending timers. That's acceptable
  for 10 seconds, **not** for a longer window — if we ever extend the grace
  period, this needs a `BullMQ` / Postgres-backed queue.

**Don't use for:** anything where the side effect *must* be delivered (e.g.
billing events, audit-log entries). For those, write the row immediately
and reverse-it-out on undo.

---

## 4. Activity coalescing within a time window

**Where:** `issue/issue.service.ts:coalesceActivityField`.

**Why.** If the same user changes `assigneeId` three times in 10 seconds,
the activity log shouldn't show `A → B → C → D` — it should show `A → D`.
Same window as the notification grace period so the activity log and the
Slack DM tell the same story.

**Shape.**

```ts
// Within UpdateIssue handler:
const activities = this.buildActivities(existing, dto);
const isNoOp = await this.coalesceActivityField(activities, 'assigneeId', {
  issueId, userId: actorId,
});
if (isNoOp) {
  // User clicked their way back to the original value → no row.
  // Also cancel any pending Slack DM for symmetry.
  this.notificationService.cancelPendingAssignment(issueId, 'ASSIGNED');
}
```

The coalescing logic:
1. Find the most recent activity row for `(issueId, userId, field)` within
   the 10s window.
2. If none → no-op, write a new row.
3. If found and `recent.oldValue === current.newValue` → delete the
   recent row, **drop** the new activity (it's a net no-op).
4. Otherwise → delete the recent row, rewrite the new one with
   `oldValue = recent.oldValue` (preserving the true origin).

**Don't use for:** boolean toggles or status changes where every step is
meaningful (e.g. `IN_PROGRESS → REVIEW → DONE` should remain three rows).
Only fields where rapid back-and-forth is a UX artifact, not a real signal.

---

## 5. AES-256-CBC encryption at rest for third-party secrets

**Where:** `common/encryption.service.ts` (`@Global` module). Consumers:
`slack/slack.service.ts` (bot tokens), `credential/credential.service.ts`
(project secrets).

**Shape.**

```ts
encrypt(text): `${ivHex}:${cipherHex}`
decrypt(`${ivHex}:${cipherHex}`): text
```

Key is read from `ENCRYPTION_KEY` env (must be 64 hex chars = 32 bytes). IV
is random per encrypt call. Output is hex (not base64) — chosen for safe
JSON transport.

**Use when:** storing a third-party access token, OAuth refresh token, or
arbitrary user-supplied secret that the server needs to re-use plaintext
later. Slack bot token, GitHub PAT, etc.

**Don't use for:**
- **User passwords** — those go through `bcryptjs` (`hash` in
  `auth.service.ts`), which is one-way and slow-by-design.
- **API keys we issue** — we hash with bcrypt and verify on use
  (`api-key.service.ts`). We never need to recover the plaintext, so
  bcrypt is correct.
- **JWTs** — those are signed-not-encrypted by `JwtModule`.

---

## 6. Best-effort Slack DM with rate-limit retry

**Where:** `slack/slack.service.ts:sendDirectMessage`, `sendMessage`.

**Shape.**

```ts
async sendDirectMessage(slackUserId, text, blocks?) {
  // 1. Pick the most-recently-installed integration (we only support one).
  // 2. Decrypt the bot token; instantiate WebClient.
  // 3. conversations.open → DM channel id. On failure → log + return (skip).
  // 4. chat.postMessage with up-to-3 retries on `ratelimited`:
  //    delay = error.retryAfter ?? 2 ** retry (seconds)
  // 5. Any other failure: log warn + return. Never throw.
}
```

**Invariants.**

- DMs are *enrichment*. The authoritative notification lives in the DB.
  Caller code uses `.catch(err => logger.warn(...))` and continues.
- Channel sends (`sendMessage`) *do* throw on non-rate-limit failures.
  The caller (scheduler) catches and logs; the user-facing flow doesn't
  block on Slack at all.

**Caches.** `getChannels` and `getUsers` use 5-minute in-memory TTL caches
keyed by `integrationId`. Cleared on `disconnect`. Acceptable because Slack
list endpoints are slow and our config-pickers re-fetch on view.

---

## 7. Timezone-aware cron checks

**Where:** `report/report.scheduler.ts`, `standup/standup.scheduler.ts`.

**Problem.** `@Cron()` fires at server-local time. We need per-config
timezones (one team in `Asia/Seoul`, another in `America/Los_Angeles`).

**Pattern.** Run a "tick" job every minute and *inside* the handler check
each enabled config:

```ts
@Cron('0 * * * * *')
async checkAndSendReports() {
  const configs = await this.prisma.dailyReportConfig.findMany({ where: { enabled: true } });
  for (const config of configs) {
    const localTime = new Intl.DateTimeFormat('en-US', {
      timeZone: config.timezone,
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date()).replace(/ /g, '').trim();
    if (localTime !== config.morningTime) continue;
    // dedup: skip if lastSent === today's HH:mm in this tz
    await this.sendReport(...);
    await prisma.update({ data: { morningLastSent: now } });
  }
}
```

**Invariants.**

- ` ` (narrow no-break space) appears in `Intl.DateTimeFormat` output
  on some Node versions between AM/PM markers. Always strip it before
  comparison. Same for `.trim()`.
- Dedup against `<field>LastSent`: compute today's date in the config tz,
  compare to `lastSent` formatted in the same tz. Avoids double-send if a
  pod restarts mid-minute.
- For fixed-tz schedules (management digest at Seoul 7:30 / 17:30),
  use the `timeZone` option on the cron directly:
  `@Cron('0 30 7 * * 1-5', { timeZone: 'Asia/Seoul' })`.

---

## 8. The dual-purpose `findOne(idOrKey)` (project lookup)

**Where:** `project/project.service.ts:findOne`.

**Shape.**

```ts
async findOne(idOrKey: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrKey);
  return this.prisma.project.findUnique({
    where: isUuid ? { id: idOrKey } : { key: idOrKey },
    include: { /* … */ },
  });
}
```

**Why.** The SPA navigates by project key (`/projects/PITB/board`), so
`GET /api/projects/PITB` has to work without a roundtrip to resolve the
UUID first.

**Critical asymmetry.** `update(id, …)` and `remove(id, …)` accept *UUID
only*:

```ts
async update(id: string, dto: UpdateProjectDto) {
  await this.ensureExists(id);    // ← only matches by id
  return this.prisma.project.update({ where: { id }, … });
}
```

This is intentional — mutations should be addressed by a stable identifier
that doesn't change when a user renames the project key. But it means:

> **Frontend mutation callers must pass `project.id`, NOT the URL param.**

The May 2026 Settings 404 bug was exactly this — see
`docs/architecture/frontend/refactor-2026-05-changelog.md`. The frontend
now resolves `project.id` from the query response before calling mutations.

---

## 9. Soft validation envelope (DTOs)

**Where:** every `<feature>/dto/*.dto.ts`.

**Shape.** Each DTO is a class with `class-validator` decorators and
`@ApiProperty` for Swagger:

```ts
export class CreateIssueDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional({ enum: IssueType })
  @IsOptional()
  @IsEnum(IssueType)
  type?: IssueType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}
```

The global `ValidationPipe` with `whitelist + forbidNonWhitelisted + transform`
guarantees:
1. Unknown fields → `400` (you literally cannot smuggle extra columns into a
   `prisma.update({ data: dto })`).
2. Wrong types → `400`.
3. `enableImplicitConversion` lets `?limit=50` arrive as `number` not
   `string` (URL query strings).

**Don't use for:** raw `req.body` parsing. The pipe needs the DTO class on the
controller method signature to apply validation. If you ever see `@Body() body: any`,
that's a bug.

---

## 10. Single-source-of-truth for membership checks

**Where:** `common/guards/project-member.guard.ts` + `common/guards/roles.guard.ts`.

Every project-scoped controller in the app `@UseGuards(ProjectMemberGuard)`.
That guard:
1. Resolves project key → UUID (`request.params.projectId` is mutated).
2. Loads `request.user.sub`'s `isSuperuser` flag (`request.isSuperuser`).
3. If not superuser, loads the `ProjectMember` row and attaches
   `request.projectMember`.
4. Throws `ForbiddenException('Not a member of this project')` if neither
   condition holds.

`RolesGuard` then re-uses the attached state — *no second DB query unless
called without `ProjectMemberGuard` having run*.

**Don't write your own membership check in a service.** If you find yourself
running `prisma.projectMember.findUnique` inside a service, the guard should
be doing that. The single exception: bulk-import endpoints that need to
filter membership across many projects per request.

---

## 11. External API: alternate auth via header-scoped guard

**Where:** `external/external.controller.ts`, `api-key/api-key.guard.ts`.

```ts
@Controller('external')
@Public()                              // skip the global JwtAuthGuard
@UseGuards(ApiKeyGuard)                // instead use API key from X-API-Key header
export class ExternalController { … }
```

**Shape of `ApiKeyGuard`** (high-level): hash the supplied key with bcrypt
against every active `ApiKey` row, attach the owner as `request.user`
(populating `sub` + `email` so the rest of the request pipeline thinks
it's authenticated), then return `true`. The `@CurrentUser()` decorator
on the controller then transparently gives you the owning user.

**Don't use for:** trusted-internal callers. Use a service token or signed
request instead — API keys are designed for revocable per-integration trust,
not for "the report scheduler calling the report service".

---

## 12. Module exports are deliberate, not blanket

**Where:** every `<feature>.module.ts` — look at the `exports: [...]` array.

Most feature modules export their service:

```ts
@Module({
  providers: [IssueService, ArchiveScheduler],
  exports: [IssueService],   // ← only what other modules legitimately need
})
export class IssueModule {}
```

`ArchiveScheduler` is *not* exported — it's a fire-and-forget cron consumer
of the service. The Slack module exports `SlackService` so
`NotificationService` can DM. `NotificationModule` exports
`NotificationService` so `IssueService` can schedule.

**Rule:** if no other module imports your service, don't put it in `exports`.
Make the cross-module surface explicit and grep-able.

---

## What to ignore on the backend

A few patterns from other NestJS codebases that we deliberately don't use:

- **Custom repositories** (NestJS Mongoose-style). All Prisma access is
  inline in services. The frontend has a repository layer; the backend does
  not, because services *are* the persistence boundary and the abstraction
  doesn't earn its complexity.
- **Custom interceptors per route.** We have one global interceptor
  (response envelope). Per-route interceptors add invisible behaviour;
  prefer guards (which run earlier and fail loudly) or service-level logic.
- **Manual DTO-to-entity mapping**. Prisma's generated types are the entity
  shape. We pass DTOs straight to `prisma.update({ data: dto })` thanks to
  `whitelist: true` on the validation pipe.
- **`Reflector.get` inside services.** Reflector metadata is read by guards
  only. Once you're inside a service, you have the params you need.
