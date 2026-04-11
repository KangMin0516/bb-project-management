-- CreateTable
CREATE TABLE "issue_spec_links" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issue_id" TEXT NOT NULL,
    "spec_id" TEXT NOT NULL,
    "section_slug" VARCHAR(100),

    CONSTRAINT "issue_spec_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "issue_spec_links_issue_id_idx" ON "issue_spec_links"("issue_id");

-- CreateIndex
CREATE INDEX "issue_spec_links_spec_id_idx" ON "issue_spec_links"("spec_id");

-- CreateIndex
CREATE UNIQUE INDEX "issue_spec_links_issue_id_spec_id_section_slug_key" ON "issue_spec_links"("issue_id", "spec_id", "section_slug");

-- AddForeignKey
ALTER TABLE "issue_spec_links" ADD CONSTRAINT "issue_spec_links_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_spec_links" ADD CONSTRAINT "issue_spec_links_spec_id_fkey" FOREIGN KEY ("spec_id") REFERENCES "specifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
