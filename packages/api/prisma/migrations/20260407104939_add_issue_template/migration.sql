-- CreateTable
CREATE TABLE "issue_templates" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "IssueType" NOT NULL DEFAULT 'TASK',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "creator_id" TEXT NOT NULL,

    CONSTRAINT "issue_templates_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "issue_templates" ADD CONSTRAINT "issue_templates_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
