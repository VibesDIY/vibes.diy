# Querying the prod database — `db:inspect`

When you need to look at real data in the backend Neon Postgres (growth/attribution
numbers, why a report looks off, what a table actually contains), reach for the
**`db:inspect`** script. Don't hand-roll a `psql` connection — see the cloud-session
gotcha below for why that hangs.

Script: [`vibes.diy/api/svc/usage-report/inspect-db.ts`](../vibes.diy/api/svc/usage-report/inspect-db.ts).

## Commands

```bash
# What am I connected to (db, user, schemas)?
pnpm --dir vibes.diy/api/svc run db:inspect info

# List base tables
pnpm --dir vibes.diy/api/svc run db:inspect tables

# Dump the newest N rows of a table
pnpm --dir vibes.diy/api/svc run db:inspect table AppDocuments --limit 20

# Arbitrary read-only query (note the escaped double-quotes around identifiers)
pnpm --dir vibes.diy/api/svc run db:inspect sql "select \"userId\", updated from \"UserSettings\" order by updated desc limit 5"
```

`pnpm --filter @vibes.diy/api-svc run db:inspect …` is the same thing — either the
`--dir` or the `--filter` form works.

Sibling: `pnpm growth-report` (root) → `db:inspect-report` renders the prebuilt
growth report instead of a raw query.

## It is read-only, and it is PROD

- The `sql` subcommand is gated by `assertReadonlySql`: only statements starting with
  `select` / `with` / `show` / `explain` run. Anything else is rejected — you cannot
  mutate through this tool, so it's safe to point at prod.
- It reads `NEON_DATABASE_URL` from `process.env` or `vibes.diy/api/svc/.dev.vars`
  (via `loadDevVars`) and connects to the **production** Neon Postgres. There is no
  local/dev mode here. **Never use it to verify local test state** — it won't see your
  local SQLite. (See [local-cli-against-local-dev.md](local-cli-against-local-dev.md).)
- Postgres identifiers in this schema are camelCase and case-sensitive, so table and
  column names must be double-quoted: `"AppDocuments"`, `"userId"`, `"userSlug"`. Note
  several Drizzle fields map to a differently-named column — e.g. the `ownerHandle`
  field is the SQL column `"userSlug"` (grep the `pgTable(...)` defs in
  `vibes.diy/api/sql/vibes-diy-api-schema-pg.ts` before writing a query).

## Cloud-session gotcha: use this, not `psql`

In cloud sessions a raw `psql`/TCP connection to Neon **hangs** and times out — outbound
traffic only leaves via the agent HTTPS proxy, and the Postgres wire protocol isn't
HTTPS. `db:inspect` works anyway because it connects through `@neondatabase/serverless`,
whose transport rides HTTPS and therefore traverses the proxy (`info` reports
`server_addr 127.0.0.1`, i.e. the local proxy). So: reach for `db:inspect`, not `psql`.

If you ever need one-off raw HTTP access without the script, the same serverless
endpoint is reachable via `curl` through the proxy — POST the Neon SQL-over-HTTP
endpoint with a `Neon-Connection-String` header — but the script is the sanctioned path.

## Worked example: classifying who writes to a vibe

The "active members per day" growth chart counts distinct **non-owner, granted** members
who wrote to `AppDocuments`. To reproduce/debug it — or to tell members apart from vibe
owners and ungranted (access-fn-authorized) writers — join the write log against the
grant tables and the handle→owner map (`UserSlugBindings`):

```bash
pnpm --dir vibes.diy/api/svc run db:inspect sql "
with members as (
  select \"foreignUserId\" mid, \"userSlug\" us, \"appSlug\" ap from \"RequestGrants\" where state='approved'
  union select \"tokenOrGrantUserId\", \"userSlug\", \"appSlug\" from \"InviteGrants\" where state='accepted'),
owners as (select distinct \"userId\" oid, \"userSlug\" us from \"UserSlugBindings\"),
w as (select \"userId\" uid, \"userSlug\" us, \"appSlug\" ap from \"AppDocuments\"
      where created >= '2026-06-02' and \"userId\"<>'unknown')
select
  count(distinct case when m.mid is not null then w.uid end) as member_writers,
  count(distinct case when m.mid is null and o.oid is not null then w.uid end) as owner_writers,
  count(distinct case when m.mid is null and o.oid is null then w.uid end) as stranger_writers
from w
left join members m on m.mid=w.uid and m.us=w.us and m.ap=w.ap
left join owners o on o.oid=w.uid and o.us=w.us"
```

`member_writers` is what the chart plots; `owner_writers` are owners editing their own
apps (correctly excluded); `stranger_writers` are ungranted non-owner writers. A flat
zero on the chart with healthy `owner_writers` means member engagement dropped — not that
the pipeline broke.
