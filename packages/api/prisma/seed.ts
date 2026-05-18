import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { hash } from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const connectionString = process.env['DATABASE_URL']!;
const adapter = new PrismaPg(connectionString);
const prisma = new PrismaClient({ adapter });

async function seedAdmin() {
  const email = process.env['ADMIN_EMAIL'] || 'admin@burningb.com';
  const password = process.env['ADMIN_PASSWORD'] || 'changeme123';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Heal any prior bad-state seed: the very first seed predated the explicit
    // status assignment below, so an existing admin row may still be PENDING.
    // Make sure the seeded admin is always ACTIVE + superuser.
    if (existing.status !== 'ACTIVE' || !existing.isSuperuser) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', isSuperuser: true },
      });
      console.log(`Admin user healed → ACTIVE + superuser: ${email}`);
    } else {
      console.log(`Admin user already exists: ${email}`);
    }
    return;
  }

  const passwordHash = await hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      email,
      name: 'Admin',
      passwordHash,
      isSuperuser: true,
      status: 'ACTIVE',
    },
  });

  console.log(`Admin user created: ${admin.email} (${admin.id})`);
}

/**
 * Default IssueRule presets, modeled on Jira's standard issue-type
 * schemes (Bug, Story/Task, Epic, Sub-task) but adapted to the columns
 * BB-PM actually has. Idempotent via `upsert` keyed on the unique
 * `issueType` — running the seed again only fills slots that aren't
 * already configured.
 *
 * Customise per workspace via the admin UI at /admin/issue-rules.
 */
const DEFAULT_ISSUE_RULES = [
  {
    issueType: 'BUG' as const,
    titlePattern: '/^\\[BUG\\]/',
    descriptionTemplate: `## Summary
_One-line description of the bug._

## Steps to reproduce
1.
2.
3.

## Expected behavior


## Actual behavior


## Severity
_Blocker / Critical / Major / Minor / Trivial_

## Reproducibility
_Always / Sometimes / Rarely / Once_

## Environment
- Browser/OS:
- App version / commit:
- Source (Web / Slack / MCP / API):

## Workaround
_None / describe if known_

## Screenshots / logs
`,
    requiredFields: ['description', 'priority', 'assigneeId'],
    defaultValues: { priority: 'HIGH', status: 'TODO' },
    enforcedLabelNames: ['bug', 'needs-triage'],
  },
  {
    issueType: 'TASK' as const,
    titlePattern: null,
    descriptionTemplate: `## User story
_As a [role], I want [capability] so that [benefit]._

## Context
_Why this task exists. Link parent epic or design doc._

## Acceptance criteria
- [ ]
- [ ]

## Definition of done
- [ ] Code merged
- [ ] Unit tests added/updated
- [ ] Manually verified on staging

## Dependencies
_Other issues that must ship first, or none._

## Notes / open questions
`,
    requiredFields: ['description', 'assigneeId'],
    defaultValues: { priority: 'MEDIUM', status: 'BACKLOG' },
    enforcedLabelNames: [] as string[],
  },
  {
    issueType: 'EPIC' as const,
    titlePattern: '/^Epic:/',
    descriptionTemplate: `## Goal
_One-sentence outcome this epic delivers._

## Why now
_Business / user driver._

## Scope (in)
-

## Scope (out)
_What we explicitly are NOT doing._

## Success metrics
_How we know we shipped it right (numbers, not adjectives)._

## Stakeholders
- Owner:
- Engineering lead:
- Design / PM:

## Timeline
_Target start / target ship._

## Open questions
`,
    requiredFields: ['description', 'priority'],
    defaultValues: { status: 'BACKLOG' },
    enforcedLabelNames: ['epic'],
  },
  {
    issueType: 'SUB_TASK' as const,
    titlePattern: null,
    descriptionTemplate: `## What to do


## Done when
- [ ]
`,
    // parentId is enforced at the API/UC layer (SUB_TASK without a
    // parent is rejected) — listed here so the LLM sees the
    // requirement in get_create_rules and doesn't even try.
    requiredFields: ['assigneeId', 'parentId'],
    defaultValues: { priority: 'MEDIUM', status: 'TODO' },
    enforcedLabelNames: [] as string[],
  },
];

async function seedIssueRules() {
  let created = 0;
  let kept = 0;
  for (const preset of DEFAULT_ISSUE_RULES) {
    const existing = await prisma.issueRule.findUnique({
      where: { issueType: preset.issueType },
    });
    if (existing) {
      kept++;
      continue;
    }
    await prisma.issueRule.create({ data: preset });
    created++;
  }
  console.log(
    `Issue rules: ${created} created, ${kept} kept (existing rows are never overwritten — edit via /admin/issue-rules).`,
  );
}

async function main() {
  await seedAdmin();
  await seedIssueRules();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
