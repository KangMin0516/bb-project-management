-- AlterEnum
-- Safe inside Prisma's migration transaction: the new value is only
-- added here, never referenced as a literal in this same migration
-- (Postgres forbids using a freshly-added enum value in the txn that
-- created it).
ALTER TYPE "ShareScope" ADD VALUE 'COMMENT';

-- CreateTable
CREATE TABLE "doc_comments" (
    "id" TEXT NOT NULL,
    "doc_key" VARCHAR(300) NOT NULL,
    "container_id" VARCHAR(200),
    "quote" TEXT,
    "prefix" VARCHAR(120),
    "suffix" VARCHAR(120),
    "text_offset" INTEGER,
    "body" TEXT NOT NULL,
    "parent_id" TEXT,
    "user_id" TEXT,
    "guest_name" VARCHAR(80),
    "author_key" VARCHAR(64),
    "share_link_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" VARCHAR(80),
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doc_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doc_comments_project_id_doc_key_idx" ON "doc_comments"("project_id", "doc_key");

-- CreateIndex
CREATE INDEX "doc_comments_parent_id_idx" ON "doc_comments"("parent_id");

-- AddForeignKey
ALTER TABLE "doc_comments" ADD CONSTRAINT "doc_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "doc_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_comments" ADD CONSTRAINT "doc_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_comments" ADD CONSTRAINT "doc_comments_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "share_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_comments" ADD CONSTRAINT "doc_comments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
