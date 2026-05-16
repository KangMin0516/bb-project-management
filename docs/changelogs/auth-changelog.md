# Auth Changelog

> Authentication and session management for interactive users (JWT bearer) and external callers (`X-API-Key`). Also tracks the user account lifecycle (PENDING → ACTIVE → REJECTED/DELETED) since registration is gated by superuser approval.

## Owns

- **Modules**: `packages/api/src/auth/` (controller, service, module, JwtStrategy, DTOs), `packages/api/src/api-key/` (controller, service, module, `ApiKeyGuard`), `packages/api/src/common/guards/jwt-auth.guard.ts`
- **Frontend**: `packages/web/src/api/auth.ts`, `packages/web/src/api/client.ts` (axios interceptors), `packages/web/src/stores/auth.ts` (Zustand), `packages/web/src/pages/LoginPage.tsx`, `packages/web/src/pages/RegisterPage.tsx`
- **Tables**: `users` (`refresh_token`, `status`, `is_superuser`, `password_hash`), `api_keys` (`key` bcrypt hash, `key_prefix` 8-char index, `last_used`)

## Surface

- `POST /api/auth/register` — public, creates user in `PENDING` status
- `POST /api/auth/login` — public, returns `{accessToken, refreshToken, user}`
- `POST /api/auth/refresh` — public, rotates refresh token
- `GET /api/auth/profile` — JWT, current user
- `PATCH /api/auth/profile` — JWT, update name/avatar
- `POST /api/auth/change-password` — JWT
- `POST /api/auth/upload-avatar` — JWT (handled by `upload` module)
- `POST /api/api-keys` / `GET /api/api-keys` / `DELETE /api/api-keys/:id` — JWT, manage user's API keys

**Global guard:** `JwtAuthGuard` registered as `APP_GUARD`. Routes opt out with `@Public()`. The `external` controller is `@Public()` + `@UseGuards(ApiKeyGuard)`.

## Timeline

### 2026-05-15 — Dual credentials in `ApiKeyGuard` (a0629e0)
**Changed.** The `ApiKeyGuard` now accepts **either** `X-API-Key: bbpm_<hex>` (long-lived personal key) **or** `Authorization: Bearer bbpm_at_<…>` (short-lived OAuth 2.1 access token). Both paths populate `request.user = { sub, email }` so every downstream `/api/external/*` controller treats them identically. The OAuth side is its own surface — see [`mcp-changelog.md`](./mcp-changelog.md) and [`docs/architecture/backend/mcp-server.md`](../architecture/backend/mcp-server.md). Auth-wise the only change here is that the guard gained a second resolution path.
- Source: `packages/api/src/api-key/api-key.guard.ts`.

### 2026-04-17 — DELETED user status (Schema: `20260417033840_add_deleted_user_status`)
**Schema.** Added `DELETED` to `UserStatus` enum so superusers can soft-delete accounts. Login refuses any non-`ACTIVE` status with a localized message.
- Migration: `20260417033840_add_deleted_user_status`.
- Source: `packages/api/src/auth/auth.service.ts:62` (login status guard).

### 2026-04-07 — Account approval + refresh tokens (Schema: `20260407030000_add_user_status_and_refresh_token`)
**Added.** Registration now creates users in `PENDING`. Login is blocked until a superuser approves (sets `status = 'ACTIVE'`) or rejects (`REJECTED`). Refresh tokens introduced: `users.refresh_token` stores `bcrypt(randomUUID())`; full token wire format is `userId:uuid`, the UUID half is what gets bcrypt-compared.
- Migration: `20260407030000_add_user_status_and_refresh_token` — adds `status UserStatus DEFAULT 'PENDING'`, `refresh_token VARCHAR`.
- Source: `packages/api/src/auth/auth.service.ts:23` (register), `:48` (login), `:77` (refresh).

### 2026-04-06 — API-key prefix index (Schema: `20260406091715_add_api_key_prefix`, `20260406093135_expand_api_key_hash_varchar`)
**Schema + Changed.** Validating an API key was scanning every `api_keys` row and calling `bcrypt.compare` on each — O(N). Added an 8-char unencrypted `key_prefix` column with index; validation now narrows by prefix first, then bcrypt-compares the (usually 1) matching row.
- Migrations: `20260406091715_add_api_key_prefix`, `20260406093135_expand_api_key_hash_varchar` (key column widened to fit longer bcrypt hashes).
- Source: `packages/api/src/api-key/api-key.service.ts:58` (`validateKey`).

### 2026-04-06 — Initial auth (init commit, Schema: `20260406080645_init`)
**Added.** `POST /api/auth/register|login|refresh`, JWT signed with `JWT_SECRET` (HS256), `JwtAuthGuard` as global `APP_GUARD`, `@Public()` decorator to opt out. `ApiKeyGuard` for the `external` controller surface. Bcrypt cost factor 12 for passwords, 10 for refresh tokens (single bcrypt invocation per refresh, so a lower factor is intentional).
- Migration: `20260406080645_init` — `users.password_hash`, `api_keys` table.
- Source: `packages/api/src/auth/auth.module.ts`, `packages/api/src/common/guards/jwt-auth.guard.ts`.

## Open questions / known issues

- **R4 — Single refresh-token slot per user.** `users.refresh_token` holds one bcrypt hash. Logging in from device B overwrites it; device A's next refresh fails with 401. A future `user_sessions` table keyed by `(userId, deviceId)` would lift this constraint. See [`docs/ARCHITECTURE.md` §13](../ARCHITECTURE.md#13-risk-register).
- **R11 — Password hashes + Slack/GitHub tokens + project credentials all in one DB.** Backups need access control. No DB-at-rest encryption today.
