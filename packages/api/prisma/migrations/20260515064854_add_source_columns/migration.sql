-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "source" VARCHAR(20) NOT NULL DEFAULT 'WEB';

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "source" VARCHAR(20) NOT NULL DEFAULT 'WEB';

-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "source" VARCHAR(20) NOT NULL DEFAULT 'WEB';

-- AlterTable
ALTER TABLE "outbox_events" ALTER COLUMN "id" DROP DEFAULT;
