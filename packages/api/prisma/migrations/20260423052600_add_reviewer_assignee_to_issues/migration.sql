-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "reviewer_assignee_id" TEXT;

-- CreateTable
CREATE TABLE "project_join_requests" (
    "id" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" VARCHAR(500),
    "rejection_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "requester_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "resolved_by_id" TEXT,

    CONSTRAINT "project_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_join_requests_project_id_status_idx" ON "project_join_requests"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_join_requests_requester_id_project_id_key" ON "project_join_requests"("requester_id", "project_id");

-- CreateIndex
CREATE INDEX "issues_reviewer_assignee_id_idx" ON "issues"("reviewer_assignee_id");

-- AddForeignKey
ALTER TABLE "project_join_requests" ADD CONSTRAINT "project_join_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_join_requests" ADD CONSTRAINT "project_join_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_join_requests" ADD CONSTRAINT "project_join_requests_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_reviewer_assignee_id_fkey" FOREIGN KEY ("reviewer_assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
