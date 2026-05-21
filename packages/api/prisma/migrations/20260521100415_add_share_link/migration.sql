-- CreateEnum
CREATE TYPE "ShareScope" AS ENUM ('TIMELINE', 'BOARD', 'CALENDAR', 'LISTS');

-- CreateTable
CREATE TABLE "share_links" (
    "id" TEXT NOT NULL,
    "token" VARCHAR(32) NOT NULL,
    "passcode_hash" TEXT NOT NULL,
    "scopes" "ShareScope"[] DEFAULT ARRAY['TIMELINE']::"ShareScope"[],
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "last_accessed_at" TIMESTAMP(3),
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_key" ON "share_links"("token");

-- CreateIndex
CREATE INDEX "share_links_project_id_idx" ON "share_links"("project_id");

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
