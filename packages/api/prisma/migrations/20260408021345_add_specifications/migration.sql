-- CreateEnum
CREATE TYPE "SpecStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'DEPRECATED');

-- CreateTable
CREATE TABLE "specifications" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "category" VARCHAR(50),
    "status" "SpecStatus" NOT NULL DEFAULT 'DRAFT',
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "project_id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,

    CONSTRAINT "specifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spec_sections" (
    "id" TEXT NOT NULL,
    "section_id" VARCHAR(100) NOT NULL,
    "level" INTEGER NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "spec_id" TEXT NOT NULL,

    CONSTRAINT "spec_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spec_comments" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "spec_id" TEXT NOT NULL,
    "section_id" TEXT,
    "user_id" TEXT NOT NULL,
    "parent_id" TEXT,

    CONSTRAINT "spec_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "specifications_project_id_status_idx" ON "specifications"("project_id", "status");

-- CreateIndex
CREATE INDEX "spec_sections_spec_id_order_idx" ON "spec_sections"("spec_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "spec_sections_spec_id_section_id_key" ON "spec_sections"("spec_id", "section_id");

-- CreateIndex
CREATE INDEX "spec_comments_spec_id_resolved_idx" ON "spec_comments"("spec_id", "resolved");

-- CreateIndex
CREATE INDEX "spec_comments_user_id_idx" ON "spec_comments"("user_id");

-- CreateIndex
CREATE INDEX "spec_comments_parent_id_idx" ON "spec_comments"("parent_id");

-- AddForeignKey
ALTER TABLE "specifications" ADD CONSTRAINT "specifications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specifications" ADD CONSTRAINT "specifications_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_sections" ADD CONSTRAINT "spec_sections_spec_id_fkey" FOREIGN KEY ("spec_id") REFERENCES "specifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_comments" ADD CONSTRAINT "spec_comments_spec_id_fkey" FOREIGN KEY ("spec_id") REFERENCES "specifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_comments" ADD CONSTRAINT "spec_comments_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "spec_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_comments" ADD CONSTRAINT "spec_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_comments" ADD CONSTRAINT "spec_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "spec_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
