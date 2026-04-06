-- AlterTable: add key_prefix column with a temporary default for existing rows.
-- Existing API keys get a placeholder prefix; users should regenerate them.
ALTER TABLE "api_keys" ADD COLUMN "key_prefix" VARCHAR(8) NOT NULL DEFAULT '';

-- Remove the default so future inserts must provide a value
ALTER TABLE "api_keys" ALTER COLUMN "key_prefix" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "api_keys_key_prefix_idx" ON "api_keys"("key_prefix");
