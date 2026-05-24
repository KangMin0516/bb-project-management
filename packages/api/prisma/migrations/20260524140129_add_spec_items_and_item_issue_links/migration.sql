-- CreateTable
CREATE TABLE "spec_items" (
    "id" TEXT NOT NULL,
    "marker" VARCHAR(64) NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "spec_id" TEXT NOT NULL,
    "section_id" TEXT,

    CONSTRAINT "spec_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spec_item_issue_links" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "spec_item_id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,

    CONSTRAINT "spec_item_issue_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spec_items_spec_id_marker_key" ON "spec_items"("spec_id", "marker");

-- CreateIndex
CREATE INDEX "spec_items_spec_id_archived_at_idx" ON "spec_items"("spec_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "spec_item_issue_links_spec_item_id_issue_id_key" ON "spec_item_issue_links"("spec_item_id", "issue_id");

-- CreateIndex
CREATE INDEX "spec_item_issue_links_issue_id_idx" ON "spec_item_issue_links"("issue_id");

-- AddForeignKey
ALTER TABLE "spec_items" ADD CONSTRAINT "spec_items_spec_id_fkey" FOREIGN KEY ("spec_id") REFERENCES "specifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_items" ADD CONSTRAINT "spec_items_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "spec_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_item_issue_links" ADD CONSTRAINT "spec_item_issue_links_spec_item_id_fkey" FOREIGN KEY ("spec_item_id") REFERENCES "spec_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_item_issue_links" ADD CONSTRAINT "spec_item_issue_links_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
