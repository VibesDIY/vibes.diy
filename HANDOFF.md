# Attribution Pipeline — Handoff

**PR:** #1807 `worktree-jchris+attribution-pipeline` → `main`
**Closes:** #1806

## What's in this PR

Three commits, all code-complete:

| Commit     | What                                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `80ce11f7` | `@vibes.diy/api-logpush-etl` cron worker — reads R2 Logpush NDJSON every 5 min, extracts `[referer]` lines, batch-upserts into Neon `RefererEvents` table |
| `76067d06` | Rules-bag fixes on the above (Drizzle instead of raw SQL, URI/exception2Result, lineIdx stability, dedupe version fix)                                    |
| `53e8819e` | Step 3 — `reportAttributionReferrers` Evento handler, arktype types, `/reports` dashboard table (host \| path \| total \| conversions \| browse)          |

`RefererEvents` is in both the Postgres and SQLite schemas — no env-conditional code anywhere. Dev just has an empty table.

## Before merging

CI must be green. Both `compile_test` and `deploy-preview` were still running at time of handoff.

## After merging — infra checklist

These are one-time manual steps (no code changes needed):

### 1. Create R2 buckets

```bash
wrangler r2 bucket create vibes-diy-workers-logs      # prod + cli
wrangler r2 bucket create vibes-diy-workers-logs-dev  # dev/preview
```

### 2. Configure Logpush job (CF dashboard)

Account Home → Analytics & Logs → Logpush → Create a job

- Dataset: **Workers Trace Events**
- Filter: `ScriptName eq "vibes-diy-v2-prod"` (repeat for `vibes-diy-v2-cli`)
- Destination: R2, bucket `vibes-diy-workers-logs`, path prefix `{DATE}/`

Or via REST API — see [`vibes.diy/api/logpush-etl/SETUP.md`](vibes.diy/api/logpush-etl/SETUP.md) for the curl command.

### 3. Push `RefererEvents` schema to Neon

```bash
cd vibes.diy/api/tests
VIBES_DIY_TEST_NEON_URL="$NEON_DATABASE_URL" npx drizzle-kit push --config drizzle.neon.config.ts
```

### 4. Set the Neon secret on the ETL worker

```bash
cd vibes.diy/api/logpush-etl
echo "$NEON_DATABASE_URL" | wrangler secret put NEON_DATABASE_URL --env prod
echo "$NEON_DATABASE_URL" | wrangler secret put NEON_DATABASE_URL --env cli
```

### 5. Deploy the ETL worker

```bash
pnpm --filter @vibes.diy/api-logpush-etl deploy:prod
pnpm --filter @vibes.diy/api-logpush-etl deploy:cli
```

### 6. Grant Clerk access to the attribution report

For each user who needs the referrer table at `/reports`, add `"attribution"` to their `publicMetadata.reports` array in the Clerk dashboard.

The existing growth reports use `"growth"` — same mechanism.

## Verifying it works

After the first cron fires (≤5 min after deploy):

```bash
# ETL worker logs
wrangler tail vibes-diy-logpush-etl-prod --format pretty
# expect: [logpush-etl] processed N objects — inserted M, skipped K

# Neon directly
SELECT ref_host, count(*) FROM "RefererEvents"
WHERE ts > now() - interval '1 hour'
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;
```

Then visit `/reports` with a Clerk user who has `"attribution"` access — the referrer table should appear below the growth charts.

## Cleanup

Delete this file once infra steps are complete and the pipeline is confirmed working.
