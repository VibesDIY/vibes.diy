# Campaign Health SPA Integration — Design Spec

**Date:** 2026-05-26  
**Status:** Approved  
**Closes:** PR #1935 (replaces the Bearer-only HTTP endpoint approach)

## Problem

PR #1935 added `GET /reports/campaign-health` as a server-rendered HTML endpoint requiring
`Authorization: Bearer <token>` in the request header. A browser hitting this URL gets a JSON
`401` response — no Clerk sign-in flow, no browser-friendly auth. The handler was also dead code
on the main domain because `route-decision.ts` routes all `/reports/*` to `env.ASSETS.fetch`
before the handler could fire.

## Goal

- `/reports?report=campaign-health` is a browser-accessible Campaign Health page
- Same Clerk-based auth flow as the rest of `/reports`
- Same visual styling (brand palette: `--red`, `--cyan`, `--yellow`, `--cream`, `--near-black`)
- Linked from the `/reports` index
- Only the selected report's data is fetched (no simultaneous DB+Meta calls)

## Architecture

The `/reports` page is a standalone Vite SPA (separate from the main React Router app), built into
`build/client/reports/` and served by the `reports-asset` route in `app.ts`. Campaign Health
integrates as a query-param-selected view within this same SPA — no sub-path routing, no changes
to `app.ts` or `route-decision.ts`.

URL scheme:
- `/reports` or `/reports?report=growth` → Growth Report (existing behavior)
- `/reports?report=campaign-health` → Campaign Health view

The SPA reads `new URLSearchParams(location.search).get("report")` to choose which view to render
and which WS request to make.

## Changes by Layer

### 1. `@vibes.diy/api-types` — `vibes.diy/api/types/report.ts`

Add arktype schemas and inferred types for the new WS message pair:

**Request:**
```
reqReportCampaignHealth — {
  type: 'vibes.diy.req-report-campaign-health',
  auth: dashAuthType,
  days?: string,   // default "7"
  since?: string,  // YYYY-MM-DD; overrides days if present
}
```

**Response** (structured JSON, not HTML — the SPA renders it):
```
resReportCampaignHealth — {
  type: 'vibes.diy.res-report-campaign-health',
  generatedAt: string,
  dateLabel: string,
  ranked: CampaignRow[],      // sorted by cost-per-LPV ascending
  anomalies: CampaignAnomalies,
}
```

Where `CampaignRow` and `CampaignAnomalies` match the shapes already defined in the PR's
`campaign-health-template.tsx` (campaign_name, impressions, clicks, spend, ctr, cpc, reach,
actions; anomalies: duplicateNames, budgetOutliers, zeroSpend, lowLpvRatio, pixel).

Export `isResReportCampaignHealth` type-guard following the existing pattern.

### 2. `@vibes.diy/api-impl` — `vibes.diy/api/impl/index.ts`

Add one method to `VibesDiyApi` (same 2-liner pattern as all other report methods):

```typescript
reportCampaignHealth(req: Req<ReqReportCampaignHealth>): Promise<Result<ResReportCampaignHealth, VibesDiyError>> {
  return this.request(
    { ...req, type: "vibes.diy.req-report-campaign-health" },
    { resMatch: isResReportCampaignHealth }
  );
}
```

### 3. New WS handler — `vibes.diy/api/svc/public/report-campaign-health.ts`

New file following the same structure as `report-growth-memberships.ts`:

- Validate: match `type === "vibes.diy.req-report-campaign-health"`
- Auth: `checkAuth` + `hasReport(claims, "campaign-health")`
- Data: inline the `fetchCampaignHealth` logic (ported from the PR's `campaign-health-report.ts`
  into this file) — calls Meta Graph API for campaign insights and pixel stats
- Returns `ResReportCampaignHealth` JSON over WS
- Error path: sends `ResError` (same as other handlers)
- Requires `vctx.metaAccessToken`, `vctx.metaAdAccountId`, `vctx.metaPixelId` — returns error
  message if any are missing (503 equivalent over WS)

Register in `vibes.diy/api/svc/vibes-msg-evento.ts` alongside the other report handlers.

### 4. Remove dead HTTP handler

Remove `campaignHealthReport` from `vibes.diy/api/svc/vibes-req-res-evento.ts` and delete
`vibes.diy/api/svc/campaign-health/campaign-health-report.ts`. The
`campaign-health-template.tsx` file is also deleted (the SPA renders the data instead of
server-side React SSR).

The `campaign-health/` directory is removed entirely.

### 5. Reports SPA — `vibes.diy/pkg/reports-app/src/main.tsx`

After Clerk auth passes in `AuthedShell`, read the `?report=` query param and pass it as a prop:

```typescript
const report = new URLSearchParams(location.search).get("report") ?? "growth";
return <App getClerkToken={...} report={report} />;
```

### 6. Reports SPA — `vibes.diy/pkg/reports-app/src/App.tsx`

- Accept `report: string` prop
- Add a nav bar at the top (between ColorStripe and the main content) with two links:
  - `Growth` → `/reports` (or `/reports?report=growth`)
  - `Campaign Health` → `/reports?report=campaign-health`
  - Active link styled distinctly (e.g. filled `.section-label--filled` style)
- Based on `report` prop, render either:
  - `report === "campaign-health"` → `<CampaignHealth api={api} />`
  - default → existing growth + referrer sections
- Only the selected branch makes WS calls; the other branch is never mounted

### 7. New component — `vibes.diy/pkg/reports-app/src/CampaignHealth.tsx`

Receives `api: VibesDiyApi` and calls `api.reportCampaignHealth({})`.

Renders using existing CSS classes from `index.html`:
- Hero card with "Campaign Health" label + date range
- Campaigns table card: rows sorted by cost-per-LPV, color-coded (green < $0.30, yellow
  $0.30–$0.50, red > $0.50), columns: Campaign, CTR, CPC, LPVs, Cost/LPV, Spend, Reach
- Pixel health card: last fired, event counts
- Anomalies card: duplicate names, zero-spend campaigns, budget outliers, low-LPV-ratio campaigns;
  shows a green "No anomalies" badge when clean
- Loading / error states using existing `.empty` and `.err` classes

No new CSS variables or classes introduced — reuses the full brand palette and card system already
in `reports-app/index.html`.

## What Does NOT Change

- `route-decision.ts` — unchanged; `/reports?report=campaign-health` is still a `reports-asset`
  route because query strings don't affect path matching
- `app.ts` — unchanged; `env.ASSETS.fetch(request)` already handles this correctly since the
  `?report=` param passes through to Cloudflare Assets, which ignores query strings and serves
  `index.html`
- The `reports-config` route, Clerk key bootstrap, or any other reports infrastructure

## Access Control

Campaign Health uses the existing `hasReport(claims, "campaign-health")` check (same as the PR).
A user needs `@vibes.diy` email or `publicMetadata.reports` containing `"campaign-health"` or
`"*"`. The growth report continues to require `"growth"`.

## Secrets Required

`META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_PIXEL_ID` — same as documented in the PR.
Worker starts without them; the WS handler returns an error message if any are missing.
