-- CreateIndex
CREATE INDEX "issues_project_id_due_date_idx" ON "issues"("project_id", "due_date");
