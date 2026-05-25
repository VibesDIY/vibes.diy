# Attribution Pipeline (logpush-etl)

**PR:** [#1807](https://github.com/VibesDIY/vibes.diy/pull/1807) — branch `worktree-jchris+attribution-pipeline`

ETLs Cloudflare Workers Trace Events from R2 into a `RefererEvents` Neon table, surfaced at `/reports` for Clerk users with `"attribution"` in `publicMetadata.reports`.

Full setup instructions: [`vibes.diy/api/logpush-etl/SETUP.md`](../vibes.diy/api/logpush-etl/SETUP.md)

## Status (2026-05-25)

| Step | Status |
|---|---|
| R2 buckets (`vibes-diy-workers-logs`, `vibes-diy-workers-logs-dev`) | ✅ Created |
| `RefererEvents` schema in Neon | ✅ Landed via c2.2.97 `drizzle:neon` |
| CI wiring (`vibes.diy/actions/deploy/action.yaml`) | ✅ commit 820e1f80 |
| Logpush job in CF dashboard (Workers Trace Events → R2) | ⚠️ Created (jobs 1672480/1672481) — no activity; check path prefix + Workers Logs enabled |
| `NEON_DATABASE_URL` secret on ETL worker | ✅ In GH env |
| Clerk `"attribution"` access grant | ✅ Skip=true for all @vibes.diy accounts |

## Remaining steps

### 1. Configure Logpush job (CF dashboard, one-time)

Account Home → Analytics & Logs → Logpush → Create a job:
- Dataset: **Workers Trace Events**
- Filter: `ScriptName eq "vibes-diy-v2-cli"`
- Destination: R2, bucket `vibes-diy-workers-logs`, path prefix `{DATE}/`

Repeat for `vibes-diy-v2-prod` when promoting.

### 2. Set the Neon secret on the ETL worker

```bash
cd vibes.diy/api/logpush-etl
echo "$NEON_DATABASE_URL" | wrangler secret put NEON_DATABASE_URL --env cli
echo "$NEON_DATABASE_URL" | wrangler secret put NEON_DATABASE_URL --env prod
```

### 3. Deploy (or let CI handle it)

The next `vibes-diy@c*` tag will deploy via CI. To deploy manually:

```bash
pnpm --filter @vibes.diy/api-logpush-etl deploy:cli
```

### 4. Grant Clerk access

Add `"attribution"` to `publicMetadata.reports` for any user who needs the referrer table at `/reports`.

## Verify

```bash
wrangler tail vibes-diy-logpush-etl-cli --format pretty
# expect: [logpush-etl] processed N objects — inserted M, skipped K
```
