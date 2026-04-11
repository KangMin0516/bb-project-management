-- Backfill existing NULL values
UPDATE "issue_spec_links" SET "section_slug" = '' WHERE "section_slug" IS NULL;

-- AlterTable
ALTER TABLE "issue_spec_links" ALTER COLUMN "section_slug" SET NOT NULL,
ALTER COLUMN "section_slug" SET DEFAULT '';
