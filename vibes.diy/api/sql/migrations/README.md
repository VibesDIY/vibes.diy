# Migrations

The `@vibes.diy/api-sql` package's primary deploy mechanism is
`drizzle-kit push`, which diffs schema files against the live DB and applies
the result. Push is sufficient for additive, low-risk changes (new tables,
new nullable columns) and for fresh test databases.

When a schema change is **not safe to express as a pure diff** — e.g. adding
a NOT NULL column to a table that already has rows — the change must be
staged: backfill the data first, then let push catch up. SQL files in this
directory implement those staged changes.

## Running

Each `.sql` file is named with a numeric prefix and a target dialect:

- `*.sqlite.sql` — apply via `wrangler d1 execute --file=…` (D1 prod) or
  `sqlite3 <file> < …` (local/test SQLite)
- `*.pg.sql` — apply via `psql $NEON_DATABASE_URL -f …` (Neon prod)

Run migrations in numeric order. Each migration must be applied **before**
the `drizzle-kit push` of the schema commit that ships it; otherwise push
will either fail or silently corrupt data.

## Tests

Tests start from an empty database via `drizzle-kit push`, so they do not
need migrations applied. Migrations exist solely for deploys that already
have data.

## Migration list

| File | Why |
|------|-----|
| `0001_appslugbindings_updated.{sqlite,pg}.sql` | Adds `AppSlugBindings.updated` (drives recent-vibes ordering), backfills from `created`, and enforces NOT NULL on disk. The PG variant uses `ALTER COLUMN … SET NOT NULL`; the SQLite variant rebuilds the table (create-copy-drop-rename) since SQLite cannot promote an existing column to NOT NULL. |
