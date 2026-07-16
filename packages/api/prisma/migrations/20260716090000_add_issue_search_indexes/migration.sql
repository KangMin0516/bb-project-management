-- Enable fast substring search for issue title/description filters.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "issues_title_trgm_idx"
ON "issues" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "issues_description_trgm_idx"
ON "issues" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "issues_project_archived_status_order_idx"
ON "issues"("project_id", "archived_at", "status", "order");

CREATE INDEX IF NOT EXISTS "activities_issue_created_at_idx"
ON "activities"("issue_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "activities_created_at_issue_id_idx"
ON "activities"("created_at" DESC, "issue_id");

CREATE INDEX IF NOT EXISTS "activities_user_created_at_idx"
ON "activities"("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "activities_status_done_created_at_idx"
ON "activities"("created_at" DESC, "issue_id", "user_id")
WHERE "field" = 'status' AND "new_value" = 'DONE';

CREATE INDEX IF NOT EXISTS "comments_issue_created_at_idx"
ON "comments"("issue_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "attachments_issue_created_at_idx"
ON "attachments"("issue_id", "created_at" DESC);
