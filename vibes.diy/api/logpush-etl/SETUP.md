# Logpush ETL Setup

This worker reads Cloudflare Workers Logs from R2 (written by Logpush), extracts
`[referer]` lines, and inserts them into the `RefererEvents` table in Neon.

## One-time setup steps

### 1. Create the R2 bucket

```bash
# prod / cli
wrangler r2 bucket create vibes-diy-workers-logs

# dev / preview
wrangler r2 bucket create vibes-diy-workers-logs-dev
```

### 2. Configure Logpush job (CF dashboard or API)

CF does not expose Logpush via `wrangler` CLI today — use the dashboard or REST API.

**Dashboard path:**  
Account Home → Analytics & Logs → Logpush → Create a job

- Dataset: **Workers Trace Events**
- Filter: `ScriptName eq "vibes-diy-v2-prod"` (repeat for cli)
- Destination: **R2**, bucket `vibes-diy-workers-logs`, path prefix `{DATE}/`  
  (CF expands `{DATE}` to `YYYY/MM/DD` — matches the prefix the ETL uses)

**REST API equivalent:**

```bash
curl -X POST "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/logpush/jobs" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "vibes-diy-workers-logs-prod",
    "dataset": "workers_trace_events",
    "logpull_options": "fields=ScriptName,Outcome,Logs,Timestamp",
    "filter": "{\"where\":{\"key\":\"ScriptName\",\"operator\":\"eq\",\"value\":\"vibes-diy-v2-prod\"}}",
    "destination_conf": "r2://vibes-diy-workers-logs/{DATE}?account-id='${CF_ACCOUNT_ID}'",
    "enabled": true
  }'
```

Repeat with `"vibes-diy-v2-cli"` and bucket `vibes-diy-workers-logs` for the CLI env.

### 3. Apply the Neon schema

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

## Verifying it works

After the first cron fires (within 5 minutes of deploy), check:

```bash
wrangler tail vibes-diy-logpush-etl-prod --format pretty
# expect: [logpush-etl] processed N objects, inserted M, skipped K
```

Query Neon directly to confirm rows landed:

```sql
SELECT ref_host, count(*) FROM "RefererEvents"
WHERE ts > now() - interval '1 hour'
GROUP BY 1 ORDER BY 2 DESC LIMIT 20;
```
