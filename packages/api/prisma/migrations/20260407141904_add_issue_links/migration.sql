-- CreateEnum
CREATE TYPE "IssueLinkType" AS ENUM ('BLOCKS', 'IS_BLOCKED_BY', 'RELATES_TO', 'DUPLICATES', 'IS_DUPLICATED_BY');

-- CreateTable
CREATE TABLE "issue_links" (
    "id" TEXT NOT NULL,
    "type" "IssueLinkType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_issue_id" TEXT NOT NULL,
    "target_issue_id" TEXT NOT NULL,
    "creator_id" TEXT,

    CONSTRAINT "issue_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "issue_links_source_issue_id_idx" ON "issue_links"("source_issue_id");

-- CreateIndex
CREATE INDEX "issue_links_target_issue_id_idx" ON "issue_links"("target_issue_id");

-- CreateIndex
CREATE UNIQUE INDEX "issue_links_source_issue_id_target_issue_id_type_key" ON "issue_links"("source_issue_id", "target_issue_id", "type");

-- AddForeignKey
ALTER TABLE "issue_links" ADD CONSTRAINT "issue_links_source_issue_id_fkey" FOREIGN KEY ("source_issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_links" ADD CONSTRAINT "issue_links_target_issue_id_fkey" FOREIGN KEY ("target_issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_links" ADD CONSTRAINT "issue_links_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
