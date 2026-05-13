# Folder structure

The shape of `packages/api/src/`. Every entry that isn't a feature module is
called out separately; everything else is "a feature module" and follows the
template below.

```
packages/api/
├── prisma/                          # Prisma schema + 29 migrations + seed.ts
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── generated/prisma/                # Generated Prisma client (not in src)
└── src/
    ├── main.ts                      # NestJS bootstrap (global config)
    ├── app.module.ts                # 30 feature modules wired up
    ├── app.controller.ts            # /api/health (and not much else)
    │
    ├── common/                      # Cross-cutting infra (Global module)
    │   ├── common.module.ts         # @Global() — exports EncryptionService
    │   ├── constants.ts             # USER_SELECT, limit numbers
    │   ├── encryption.service.ts    # AES-256-CBC
    │   ├── decorators/              # @CurrentUser, @Roles, @Public
    │   ├── guards/                  # JwtAuth, Roles, ProjectMember, Superuser
    │   ├── filters/                 # GlobalExceptionFilter (Prisma error mapping)
    │   ├── interceptors/            # TransformInterceptor (envelope)
    │   └── index.ts                 # barrel
    │
    ├── prisma/                      # Prisma DI module
    │   ├── prisma.module.ts
    │   ├── prisma.service.ts
    │   └── index.ts
    │
    ├── auth/                        # Auth (login / register / refresh / profile)
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── dto/                     # login.dto.ts, register.dto.ts, …
    │   └── strategies/jwt.strategy.ts
    │
    ├── <feature>/                   # ← see "Module template" below (× 28)
    │   ├── <feature>.module.ts
    │   ├── <feature>.controller.ts
    │   ├── <feature>.service.ts
    │   └── dto/
    │
    └── …
```

## Module template

A boring CRUD feature module looks like:

```
<feature>/
├── <feature>.module.ts          @Module({ controllers, providers, exports })
├── <feature>.controller.ts      Thin: param decoding, calls service
├── <feature>.service.ts         All business logic + all Prisma access
└── dto/
    ├── create-<feature>.dto.ts  class-validator decorators
    ├── update-<feature>.dto.ts
    ├── query-<feature>.dto.ts   (when there are filters)
    └── index.ts                 barrel
```

Three things vary from the template:

1. **Schedulers**: a feature owning a cron lives next to its service —
   `<feature>/<feature>.scheduler.ts`. See `issue/archive.scheduler.ts`,
   `standup/standup.scheduler.ts`, `report/report.scheduler.ts`. The
   scheduler is registered in the module's `providers`.
2. **Multiple controllers**: when a feature exposes multiple top-level
   routes, give each its own controller in the same module. Dashboard does
   this: `dashboard.controller.ts` (per-project), `global-dashboard.controller.ts`
   (cross-project), `team-dashboard.controller.ts` (team view).
3. **Sub-services**: when a feature has a logically distinct second service
   (e.g. webhook handler, formatter, digest builder), give it its own file:
   - `github/github-sync.service.ts`, `github/github-webhook.service.ts`
   - `report/mgmt-digest.service.ts`
   - `report/formatters/` (single-purpose, pure helpers)
   - `dashboard/formatters/` (Slack block builders)

## What goes in each file

| File | Holds | Doesn't hold |
|---|---|---|
| `*.module.ts` | `@Module` decorator. `imports`, `controllers`, `providers`, `exports`. Nothing else. | Logic. Conditionals. Type definitions. |
| `*.controller.ts` | `@Controller(prefix)`. Routes. `@Param`/`@Query`/`@Body`/`@CurrentUser` decoding. Guard application. Delegates to service. | Prisma calls. Business rules. Validation (DTOs do that). |
| `*.service.ts` | `@Injectable()`. All Prisma access. All side effects (Slack, S3, schedulers fire). Throws `HttpException` subclasses for client errors. | Express types. `request`/`response` objects. |
| `dto/*.dto.ts` | DTO `class` with `class-validator` decorators (`@IsString`, `@IsOptional`, `@IsEnum`, `@IsUUID`, …) + `@ApiProperty` for Swagger. | Methods. Logic. |
| `*.scheduler.ts` | `@Injectable()` with `@Cron(...)` methods. Thin — most schedulers just call into the service. | The actual business logic (delegate to service). |
| `strategies/`, `formatters/` | Passport strategies, pure formatting functions. | Anything that touches Prisma. |

## Where to add a new module

1. Create `src/<feature>/`:
   ```
   <feature>/
     <feature>.module.ts
     <feature>.controller.ts
     <feature>.service.ts
     dto/
       create-<feature>.dto.ts
   ```
2. Wire it into `app.module.ts` (`imports: [..., <Feature>Module]`).
3. If the controller needs project-membership protection, decorate it with
   `@UseGuards(ProjectMemberGuard)` and mount under `projects/:projectId/...`.
4. If the controller is route-public (no JWT required), decorate with
   `@Public()` and add the relevant alternative guard (`ApiKeyGuard`, etc.).
5. If you need to publish your service to another module, add it to the
   module's `exports`.

## When to break the template

- **`common/`** is `@Global()`. `EncryptionService` is available without
  importing `CommonModule` because too many modules need it (Slack tokens,
  project credentials). Don't add new global modules casually — only when
  >5 modules would otherwise need the same import.
- **`api-key/api-key.guard.ts`** lives inside the feature folder rather than
  `common/guards/` because it's only used by `external/` and the API-key
  CRUD itself. Guards that are reused across ≥3 unrelated modules graduate
  to `common/guards/`.
- **`prisma/`** is its own module (`PrismaService` is `@Injectable()`,
  exported via `PrismaModule`). Every feature module that needs DB access
  imports it. (Could be made `@Global()` — the cost of the explicit import
  is low and the visibility is high, so we leave it as-is.)

## Naming conventions

- **File names:** kebab-case (`create-issue.dto.ts`, `archive.scheduler.ts`).
- **Class names:** PascalCase, suffix matches the file's role
  (`CreateIssueDto`, `ArchiveScheduler`, `IssueService`).
- **Module names:** `<Feature>Module`. Always export.
- **Cron tags:** stick to `@Cron('<6-field>')` strings. Use the `timeZone`
  option for tz-fixed schedules (`{ timeZone: 'Asia/Seoul' }`). For
  per-config tz, do the tz math in JS (see `report.scheduler.ts`).
- **Test files:** colocated as `*.spec.ts` (currently sparse — most coverage
  is via Playwright on the frontend; expanding backend unit tests is a known
  gap, see `docs/ARCHITECTURE.md`).

## ESM specifics

The repo is `"type": "module"`. Two things you have to remember:

1. **Always end relative imports with `.js`**, even when the source is
   `.ts`:
   ```ts
   import { PrismaService } from '../prisma/prisma.service.js';
   //                                                       ^^^
   ```
2. **Imports of generated Prisma code** go through the custom output path:
   ```ts
   import { PrismaClient } from '../../generated/prisma/client.js';
   import type { Prisma } from '../../generated/prisma/client.js';
   import type { IssueStatus, ProjectRole } from '../../generated/prisma/enums.js';
   import type { IssueWhereInput } from '../../generated/prisma/models.js';
   ```
   *Never* `from '@prisma/client'` — that resolves to the
   default-output Prisma client, which is not installed and would conflict
   with the generated one.

## What's not in `src/` but matters

| File / dir | Why |
|---|---|
| `packages/api/prisma/schema.prisma` | Authoritative model definition. Every DB shape change lives here, applied through a new migration. |
| `packages/api/prisma/migrations/` | 29 migrations. Date-prefixed names. Once applied, never edit — generate a follow-up. |
| `packages/api/prisma/seed.ts` | Seed data for fresh dev installs (`pnpm db:seed`). |
| `packages/api/generated/prisma/` | Output of `prisma generate`. Gitignored. Regenerated by `pnpm prisma generate` after schema changes. |
| `packages/api/Dockerfile` | Production build. Multi-stage; `pnpm install` with `--frozen-lockfile`, then `pnpm build` (`tsc`). |
| `.env` (repo root) | Loaded by `ConfigModule.forRoot({ envFilePath: '../../.env' })`. Resolved relative to the runtime CWD, which is `packages/api`. |
