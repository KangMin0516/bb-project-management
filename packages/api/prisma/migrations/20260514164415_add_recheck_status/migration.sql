-- AlterEnum: re-add RECHECK between REVIEW_QA and DONE.
-- ALTER TYPE ... ADD VALUE can't be used together with statements that
-- reference the new value inside the same transaction, so we re-create
-- the enum (same pattern the removal migration used) and swap the
-- column type. This lets us backfill in a single migration.
ALTER TYPE "IssueStatus" RENAME TO "IssueStatus_old";
CREATE TYPE "IssueStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW_QA', 'RECHECK', 'DONE', 'CANCELED');
ALTER TABLE "issues" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "issues" ALTER COLUMN "status" TYPE "IssueStatus" USING ("status"::text::"IssueStatus");
ALTER TABLE "issues" ALTER COLUMN "status" SET DEFAULT 'BACKLOG';
DROP TYPE "IssueStatus_old";

-- Backfill: issues flagged with is_recheck=true while IN_PROGRESS were
-- the workaround for the missing RECHECK column. Move them to the
-- proper status and clear the flag so the two concepts stay decoupled
-- going forward.
UPDATE "issues"
   SET "status" = 'RECHECK', "is_recheck" = false
 WHERE "status" = 'IN_PROGRESS' AND "is_recheck" = true;
