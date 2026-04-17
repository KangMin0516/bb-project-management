-- AlterTable: add is_recheck column
ALTER TABLE "issues" ADD COLUMN "is_recheck" BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing RECHECK issues to IN_PROGRESS + is_recheck=true
UPDATE "issues" SET "status" = 'IN_PROGRESS', "is_recheck" = true WHERE "status" = 'RECHECK';

-- AlterEnum: remove RECHECK from IssueStatus
ALTER TYPE "IssueStatus" RENAME TO "IssueStatus_old";
CREATE TYPE "IssueStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW_QA', 'DONE', 'CANCELED');
ALTER TABLE "issues" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "issues" ALTER COLUMN "status" TYPE "IssueStatus" USING ("status"::text::"IssueStatus");
ALTER TABLE "issues" ALTER COLUMN "status" SET DEFAULT 'BACKLOG';
DROP TYPE "IssueStatus_old";
