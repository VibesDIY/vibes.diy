-- 0001 — AppSlugBindings.updated (SQLite / D1)
--
-- Starting state: the `updated` column does not yet exist. This migration
-- adds it, backfills from `created`, then rebuilds the table so the column
-- is genuinely NOT NULL on disk (matching the schema). SQLite cannot
-- promote an existing column from nullable to NOT NULL via ALTER, so the
-- create-copy-drop-rename dance below is the canonical fix.
--
-- Run this BEFORE pushing the schema on any deploy that has existing
-- AppSlugBindings rows. Skipping it leaves legacy rows with no value for
-- `updated` and a subsequent push either fails or silently corrupts cursor
-- pagination. Run exactly once per database.

ALTER TABLE AppSlugBindings ADD COLUMN updated TEXT;
UPDATE AppSlugBindings SET updated = created;

PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

CREATE TABLE AppSlugBindings_new (
  userSlug TEXT NOT NULL,
  appSlug TEXT NOT NULL,
  ledger TEXT NOT NULL,
  created TEXT NOT NULL,
  updated TEXT NOT NULL,
  PRIMARY KEY (appSlug, userSlug)
);

INSERT INTO AppSlugBindings_new (userSlug, appSlug, ledger, created, updated)
  SELECT userSlug, appSlug, ledger, created, updated FROM AppSlugBindings;

DROP TABLE AppSlugBindings;
ALTER TABLE AppSlugBindings_new RENAME TO AppSlugBindings;

CREATE INDEX AppSlug_userSlug_updated_appSlug
  ON AppSlugBindings (userSlug, updated, appSlug);

COMMIT;
PRAGMA foreign_keys=ON;
