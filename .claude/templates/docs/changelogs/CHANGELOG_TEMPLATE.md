# <Domain> Changelog

> One-line scope description. What concern does this domain own?

## Owns

- **Modules**: `packages/api/src/<feature>/` (controller, service, module, dto, optionally scheduler/parsers/formatters)
- **Frontend**: `packages/web/src/pages/<Page>.tsx`, `packages/web/src/api/<feature>.ts`, `packages/web/src/components/<feature>/`
- **Tables**: `<table_a>`, `<table_b>` (Prisma models in `packages/api/prisma/schema.prisma`)
- **Migrations**: anything under `packages/api/prisma/migrations/*<feature>*`

## Surface

- **HTTP routes**:
  - `GET /api/<feature>` — …
  - `POST /api/<feature>` — …
- **Webhooks** (if any): `POST /api/webhooks/<feature>/…`
- **Schedulers** (if any): `<Cron expr>` — purpose
- **UI screens**: `/projects/:projectId/<feature>`

## Timeline

> Newest entries first.

### YYYY-MM-DD — <Short title> (<commit short SHA>)
**Added | Changed | Fixed | Removed | Schema.** One-sentence description.

- Optional details (bullets).
- Migration: `<migration-folder>` — what it does in one line.
- Source: `path/to/file.ts:line`.

### YYYY-MM-DD — <Earlier title> (<commit short SHA>)
**Added.** …

---

## Open questions / known issues

(Optional.) Pull from `docs/ARCHITECTURE.md` §13 if a risk is still open in this domain. Example:

- **R4 — single refresh-token slot per user.** Logging in from device B invalidates device A. Tracked in `auth-changelog.md`. (See [`docs/ARCHITECTURE.md` §13](../ARCHITECTURE.md#13-risk-register).)
