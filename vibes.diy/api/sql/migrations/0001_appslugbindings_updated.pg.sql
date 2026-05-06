-- 0001 — AppSlugBindings.updated (PostgreSQL / Neon)
--
-- Adds the `updated` column that drives recent-vibes ordering. The column is
-- declared NOT NULL in the schema; this migration adds it nullable, backfills
-- from `created`, then promotes it to NOT NULL so the subsequent
-- `drizzle-kit push` is a no-op for this column.
--
-- Run this migration BEFORE pushing the schema on any deploy that has
-- existing AppSlugBindings rows. Skipping it will leave legacy rows with
-- NULL `updated` and the push's SET NOT NULL step will fail.

ALTER TABLE "AppSlugBindings" ADD COLUMN IF NOT EXISTS "updated" TEXT;
UPDATE "AppSlugBindings" SET "updated" = "created" WHERE "updated" IS NULL;
ALTER TABLE "AppSlugBindings" ALTER COLUMN "updated" SET NOT NULL;
