-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "archived_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "issues_status_archived_at_idx" ON "issues"("status", "archived_at");
