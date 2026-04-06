-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_user_id_fkey";

-- DropForeignKey
ALTER TABLE "issues" DROP CONSTRAINT "issues_creator_id_fkey";

-- AlterTable
ALTER TABLE "activities" ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "issues" ALTER COLUMN "creator_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
