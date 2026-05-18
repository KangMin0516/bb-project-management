-- CreateTable
CREATE TABLE "issue_rules" (
    "id" TEXT NOT NULL,
    "issue_type" "IssueType" NOT NULL,
    "title_pattern" VARCHAR(500),
    "description_template" TEXT,
    "required_fields" JSONB NOT NULL DEFAULT '[]',
    "default_values" JSONB NOT NULL DEFAULT '{}',
    "enforced_label_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "issue_rules_issue_type_key" ON "issue_rules"("issue_type");
