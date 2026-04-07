-- CreateTable
CREATE TABLE "components" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "project_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "default_assignee_id" TEXT,

    CONSTRAINT "components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_components" (
    "issue_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,

    CONSTRAINT "issue_components_pkey" PRIMARY KEY ("issue_id","component_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "components_project_id_name_key" ON "components"("project_id", "name");

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "components" ADD CONSTRAINT "components_default_assignee_id_fkey" FOREIGN KEY ("default_assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_components" ADD CONSTRAINT "issue_components_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_components" ADD CONSTRAINT "issue_components_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "components"("id") ON DELETE CASCADE ON UPDATE CASCADE;
