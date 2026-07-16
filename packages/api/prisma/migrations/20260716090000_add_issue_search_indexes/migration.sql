-- Enable fast substring search for issue title/description filters.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "issues_title_trgm_idx"
ON "issues" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "issues_description_trgm_idx"
ON "issues" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "issues_project_archived_status_order_idx"
ON "issues"("project_id", "archived_at", "status", "order");

CREATE INDEX IF NOT EXISTS "issues_project_assignee_status_order_idx"
ON "issues"("project_id", "assignee_id", "status", "order")
WHERE "assignee_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "issues_project_reviewer_status_order_idx"
ON "issues"("project_id", "reviewer_assignee_id", "status", "order")
WHERE "reviewer_assignee_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "issues_project_creator_status_order_idx"
ON "issues"("project_id", "creator_id", "status", "order")
WHERE "creator_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "issues_project_parent_status_order_idx"
ON "issues"("project_id", "parent_id", "status", "order")
WHERE "parent_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "issue_labels_label_id_issue_id_idx"
ON "issue_labels"("label_id", "issue_id");

CREATE INDEX IF NOT EXISTS "issue_components_component_id_issue_id_idx"
ON "issue_components"("component_id", "issue_id");

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
