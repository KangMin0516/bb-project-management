-- CreateTable
CREATE TABLE "github_integrations" (
    "id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "webhook_secret" TEXT NOT NULL,
    "owner_login" TEXT NOT NULL,
    "repo_name" TEXT,
    "on_pr_open_status" TEXT,
    "on_pr_merge_status" TEXT,
    "auto_link_enabled" BOOLEAN NOT NULL DEFAULT true,
    "project_id" TEXT NOT NULL,
    "installed_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_pull_requests" (
    "id" TEXT NOT NULL,
    "github_id" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "url" TEXT NOT NULL,
    "state" VARCHAR(20) NOT NULL,
    "author_login" TEXT NOT NULL,
    "author_avatar" TEXT,
    "repo_full_name" TEXT NOT NULL,
    "base_branch" TEXT NOT NULL,
    "head_branch" TEXT NOT NULL,
    "merged_at" TIMESTAMP(3),
    "integration_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_pull_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_pr_issue_links" (
    "id" TEXT NOT NULL,
    "pull_request_id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_pr_issue_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "github_integrations_project_id_key" ON "github_integrations"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "github_pull_requests_integration_id_github_id_key" ON "github_pull_requests"("integration_id", "github_id");

-- CreateIndex
CREATE INDEX "github_pr_issue_links_issue_id_idx" ON "github_pr_issue_links"("issue_id");

-- CreateIndex
CREATE UNIQUE INDEX "github_pr_issue_links_pull_request_id_issue_id_key" ON "github_pr_issue_links"("pull_request_id", "issue_id");

-- AddForeignKey
ALTER TABLE "github_integrations" ADD CONSTRAINT "github_integrations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_integrations" ADD CONSTRAINT "github_integrations_installed_by_id_fkey" FOREIGN KEY ("installed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_pull_requests" ADD CONSTRAINT "github_pull_requests_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "github_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_pr_issue_links" ADD CONSTRAINT "github_pr_issue_links_pull_request_id_fkey" FOREIGN KEY ("pull_request_id") REFERENCES "github_pull_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_pr_issue_links" ADD CONSTRAINT "github_pr_issue_links_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
