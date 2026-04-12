-- CreateTable
CREATE TABLE "project_credentials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "entries" JSONB NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_credentials_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "project_credentials" ADD CONSTRAINT "project_credentials_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_credentials" ADD CONSTRAINT "project_credentials_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
