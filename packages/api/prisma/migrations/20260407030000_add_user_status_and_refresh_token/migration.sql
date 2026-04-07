-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN "refresh_token" TEXT;

-- Set default for new registrations to PENDING (existing users stay ACTIVE)
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'PENDING';
