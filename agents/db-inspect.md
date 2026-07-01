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

# Dump N rows of a table. NOTE: it does `order by 1 desc` — sorted by the FIRST
# column, not by time. For AppDocuments that's "userSlug", so these are NOT the
# newest rows. Use `sql` with an explicit `order by created desc` for recency.
pnpm --dir vibes.diy/api/svc run db:inspect table AppDocuments --limit 20

# Arbitrary read-only query (note the escaped double-quotes around identifiers)
pnpm --dir vibes.diy/api/svc run db:inspect sql "select \"userId\", updated from \"UserSettings\" order by updated desc limit 5"
```

`pnpm --filter @vibes.diy/api-svc run db:inspect …` is the same thing — either the
`--dir` or the `--filter` form works.

Sibling: `pnpm growth-report` (root) → `db:inspect-report` renders the prebuilt
growth report instead of a raw query.

## It is meant for reads, and it is PROD — so still be careful

- The `sql` subcommand runs `assertReadonlySql`, but that is only a **prefix
  allowlist**: it accepts a statement whose first word is `select` / `with` / `show` /
  `explain` and rejects everything else. It is NOT a real read-only guarantee — Postgres
  runs writable CTEs (`with d as (delete from … returning …) select …`) and executes the
  target of `explain analyze <dml>`, both of which start with an allowed keyword and
  therefore slip through. So the guard stops a bare `delete`/`update`, but do not treat
  it as mutation-proof: this hits **production**, so read your query before you run it.
  (Hardening the guard to an actual read-only transaction is tracked in
  [#2982](https://github.com/VibesDIY/vibes.diy/issues/2982).)
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

This query totals the whole window as a coarse sanity check; it is **not** the per-day
series. The chart is day-bucketed, so to compare against it directly, add
`substr(created,1,10) as d` to `w`, `select` it, and `group by 1 order by 1` — then
`member_writers` per row lines up with each point on the chart.
