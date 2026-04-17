-- AlterTable
ALTER TABLE "users" ADD COLUMN "slack_user_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_slack_user_id_key" ON "users"("slack_user_id");
