# Shared Procedures

Reusable procedures referenced by multiple agents and commands. Each procedure is **self-contained** — an agent can paste the snippet and run it without further context.

All commands assume the working directory is the repo root (`config.md` `project_root`).

---

## 1. Obtain an access token

Use the seeded admin account from `config.md` → `Auth → default_account`.

```bash
TOKEN=$(curl -s -X POST http://localhost:3002/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@burningb.com","password":"changeme123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

# Sanity check
echo "$TOKEN" | head -c 60
[ -n "$TOKEN" ] || echo "ERROR: token is empty — is the API running on :3002?"
```

For subsequent calls:

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3002/api/auth/profile
```

> **If login fails**, check `make logs-be` first. Common causes: API not running, DB not migrated, seed not applied (`pnpm db:seed`), or `ADMIN_PASSWORD` env mismatch.

---

## 2. Service health check

Run all three steps; report each with HTTP status code and container state.

### 2.1. Container status
```bash
docker compose ps
```
Expected: `db` is `Up (healthy)`. In dev, `app` and `web` are not in compose (they run on host) — confirm with `lsof -i :3002` and `lsof -i :5173`.

### 2.2. HTTP probes
```bash
# Backend liveness (Swagger doc is served unconditionally)
curl -s -o /dev/null -w "API:    %{http_code}  (%{time_total}s)\n" \
  http://localhost:3002/api/docs

# Frontend (dev server or nginx)
curl -s -o /dev/null -w "Web:    %{http_code}  (%{time_total}s)\n" \
  http://localhost:5173

# Database
docker compose exec -T db pg_isready -U bbpm -d bbpm_db
```

### 2.3. Tail recent logs on failure
```bash
docker compose logs --tail=30 db
# api/web run on host — use the dev terminal output, not docker logs
```

---

## 3. Determine change scope (Git)

Run all of these and include the output in your report.

```bash
git status -s                        # staged + unstaged + untracked
git diff --stat HEAD                 # line counts per file
git diff --name-only                 # changed files (one per line)
git diff --name-only --diff-filter=A # newly added files
git diff --name-only --diff-filter=D # deleted files
git log --oneline -10                # recent commit context
```

For PR-scoped reviews (use the PR's base branch from `config.md` `pr_base_branch`):

```bash
BASE=main
git diff --name-only "$BASE"...HEAD
git diff "$BASE"...HEAD              # full diff
git log --oneline "$BASE"...HEAD     # commits on this branch
```

**Affected-service mapping** (do this in your head, then report):

| Path prefix | Service |
|---|---|
| `packages/api/` | api (backend) |
| `packages/web/` | web (frontend) |
| `packages/shared/` | shared (types — touches both) |
| `packages/api/prisma/` | api + db (migration needed) |
| `docker-compose*.yml` / `Makefile` / `packages/*/Dockerfile` | infra |
| `.github/` | CI/CD |

---

## 4. Build / rebuild a service

Always check `config.md` for the canonical command. Common shortcuts:

```bash
# Backend production build
pnpm --filter @bb-pm/api build

# Frontend production build
pnpm --filter @bb-pm/web build

# Regenerate Prisma client after schema change
pnpm --filter @bb-pm/api exec prisma generate

# Apply pending migrations to dev DB
pnpm db:migrate

# Full Docker image rebuild
make dev-build      # dev
make prod-build     # prod
```

---

## 5. E2E browser testing (Claude in Chrome MCP)

Used by the QA Engineer (Stage 4) and the Verifier (Stage 6).

### 5.1. Preflight
1. Call `mcp__claude-in-chrome__tabs_context_mcp` and confirm the extension responds.
   - If it errors → **stop**. Ask the user to enable the Chrome extension. Do not mark E2E as PASS.
2. `mcp__claude-in-chrome__tabs_create_mcp` to open a fresh tab.
3. `mcp__claude-in-chrome__navigate` → `config.md` `e2e_entry_url`.

### 5.2. Login
1. Follow `config.md` `Auth → default_account`.
2. Use `mcp__claude-in-chrome__form_input` to fill email + password.
3. Use `mcp__claude-in-chrome__computer` to click the submit button.
4. Use `mcp__claude-in-chrome__read_page` to assert the URL changed to `/` (Global Dashboard) and the user's email is visible in the header.

### 5.3. Critical-path sweep
Walk every entry in `config.md` `critical_paths` in order. For each:
1. `read_page` → assert the expected element is rendered.
2. `read_console_messages` with the `error` filter → must be empty.
3. If `gif_recording: true`, call `gif_creator` to capture the flow.

### 5.4. Change-scoped E2E
After the critical-path sweep, run the E2E scenarios defined by the QA agent for **this** change. The scenarios live in `.claude/outputs/stage-4-test.md` Phase 1.

### 5.5. Failure capture
On any failure:
- `mcp__claude-in-chrome__upload_image` → screenshot evidence.
- `read_console_messages` (no filter) → full console dump.
- `read_network_requests` → failed HTTP requests.
- Include all three in the bug report.

### 5.6. Pass criteria
- 100% of critical paths complete without thrown errors.
- 0 console errors (warnings are tolerated).
- All change-scoped scenarios PASS.
- Screenshots / GIFs attached when required.

---

## 6. Verify a previous stage's output

Every stage reads the previous stage's report. Before doing anything else, check it exists.

```bash
# Example: Stage 4 reading Stage 2's implementation report
test -f .claude/outputs/stage-2-implement.md && \
  echo "✓ Stage 2 report present" || \
  echo "✗ Stage 2 report MISSING — instruct user to run /2-implement"
```

If the file is missing:
- **Do not** invent context from the conversation.
- **Do not** proceed.
- Tell the user which stage to run, then stop.

If the file exists but is malformed (missing required sections), report the issue to the user and stop.

---

## 7. Archive previous workrun outputs

Used by `/1-plan` when starting a new task while previous stage outputs still exist.

```bash
# Extract the previous task name from stage-1-plan.md's first line
# (the heading after "# 기획서: " or "# Plan: " — fall back to "unknown")
SLUG=$(head -1 .claude/outputs/stage-1-plan.md 2>/dev/null \
  | sed -E 's/^# (기획서|Plan): *//' \
  | tr -cd '[:alnum:]-_' \
  | head -c 40)
[ -z "$SLUG" ] && SLUG="unknown"

DATE=$(date +%Y-%m-%d)
DEST=".claude/outputs/history/${DATE}_${SLUG}"

mkdir -p "$DEST"
cp .claude/outputs/stage-*.md "$DEST/" 2>/dev/null
rm -f .claude/outputs/stage-*.md
echo "Archived previous run to $DEST"
```

---

## 8. Quick API smoke test

Useful in Stage 4 and Stage 6 for quick endpoint verification.

```bash
TOKEN=$(./<from-procedure-1>)
BASE=http://localhost:3002/api

# List projects (should return user's projects + isMember flag)
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/projects" | jq '.data | length'

# Get current user
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/auth/profile" | jq

# Swagger spec (lists every route — handy when an endpoint name escapes you)
curl -s "$BASE/docs-json" | jq '.paths | keys[]' | head -40
```

---

## 9. Investigate a Postgres state question

```bash
# Open psql inside the db container
make shell-db

# Or one-shot query
docker compose exec -T db psql -U bbpm -d bbpm_db -c "SELECT id, key, name FROM projects ORDER BY created_at DESC LIMIT 5;"
```

Reference: `packages/api/prisma/schema.prisma` for the canonical schema and `packages/api/prisma/migrations/` for the migration history (29 migrations).
