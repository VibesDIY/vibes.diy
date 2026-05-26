# Reporting Services

This directory (`usage-report/`) contains the database inspection tooling. The `campaign-health/` directory
contains the live HTTP endpoint for Meta ad performance.

## usage-report — database inspection CLI

Files:

- `inspect-db.ts`: read-only database inspector for connection info, table listings, table samples, and ad hoc SQL.
- `inspect-db-report.ts`: report generator that queries the database and produces the HTML report.
- `inspect-db-report-template.tsx`: HTML template/rendering module used by the report generator.

Commands:

```bash
pnpm --dir vibes.diy/api/svc run db:inspect info
pnpm --dir vibes.diy/api/svc run db:inspect tables
pnpm --dir vibes.diy/api/svc run db:inspect-report
```

Local configuration:

- Put `NEON_DATABASE_URL=...` in `vibes.diy/api/svc/.dev.vars` (see `.dev.vars.example`)
- `.dev.vars` is gitignored

Generated output:

- HTML is written to `vibes.diy/api/svc/dist/inspect-db-report/index.html`
- the script prints that path on stdout
- rerunning the report overwrites the same file in place

## campaign-health — live HTTP endpoint

Served at `GET /reports/campaign-health` by the Cloudflare Worker.

**Auth:** `Authorization: Bearer <clerk-token>` — the user must have `reports: ["campaign-health"]` (or `["*"]`) in
their Clerk `publicMetadata`, or an `@vibes.diy` email address.

**Query params:**

- `?days=7` (default) — last N days
- `?since=2026-05-26` — since a specific date

**Required secrets** (Cloudflare Worker secrets or `.dev.vars`):

```
META_ACCESS_TOKEN=   # long-lived user token with ads_read (~60-day expiry)
META_AD_ACCOUNT_ID=  # act_XXXXXXXXXX format
META_PIXEL_ID=       # numeric pixel ID
```

Token refresh runbook: `landing-pages/agents/meta-ads-setup.md`

Cost-per-LPV tiers (healthy range: $0.20–$0.35):

- Green: < $0.30
- Yellow: $0.30–$0.50
- Red: > $0.50 or no LPVs
