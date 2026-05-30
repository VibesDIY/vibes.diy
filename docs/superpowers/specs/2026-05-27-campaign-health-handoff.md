# Campaign Health Report — Current State Handoff (2026-05-27)

## Active Worktree

**Branch:** `jchris+ws-close-fail-fast`
**Worktree:** `/Users/jchris/code/fp/vibes.diy/.claude/worktrees/jchris+ws-close-fail-fast/`

Deployed to **CLI** as `vibes-diy@c2.4.15` (not yet promoted to prod).

---

## What's Built

Full funnel is visible in one campaign table:

| Column            | Source                              | Notes                                                                                                     |
| ----------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Campaign          | Meta Ads API                        | Campaign name                                                                                             |
| Click Rate        | Meta (CTR)                          | clicks ÷ impressions                                                                                      |
| Cost/Click        | Meta (CPC)                          | spend ÷ clicks                                                                                            |
| Spend             | Meta                                | Period spend                                                                                              |
| Reach             | Meta                                | Unique users reached                                                                                      |
| **CTA Clicks**    | D1 RefererEvents                    | `refHost = 'good.vibes.diy'`, grouped by refPath, joined to campaign via `website_url` from campaigns API |
| **Site Visits**   | Meta `landing_page_view`            | Browser pixel fires on good.vibes.diy at ad click                                                         |
| Cost/Visit        | Computed                            | spend ÷ Site Visits; drives row color coding                                                              |
| **Content Views** | Meta / CAPI `view_content`          | Fires after 10s dwell or 25% scroll on vibes.diy vibe page                                                |
| **Registrations** | Meta / CAPI `complete_registration` | New Clerk account within 2 min of fbclid session                                                          |
| Cost/Reg          | Computed                            | spend ÷ Registrations                                                                                     |

Summary tiles above the table show: Total Spend, Ad Clicks, Click Rate, vibes.diy Arrivals, Registrations.

---

## Key Finding

block-party (163 Site Visits, $0.22/visit) and wedding (92 Site Visits) show **0 CTA Clicks** — visitors land on good.vibes.diy but don't click through to vibes.diy. church-summer and camping have click-throughs. The landing page conversion is the bottleneck, not ad performance.

---

## Implementation Details

### CTA Clicks join (`report-campaign-health.ts:59–82`)

1. `fetchGoodVibesClickThroughs(vctx)` — D1 query: `SELECT refPath, count(*) FROM RefererEvents WHERE refHost = 'good.vibes.diy' GROUP BY refPath` → `Record<string, number>` keyed by path slug
2. `fetchCampaignDestinationUrls(token, account)` — Meta campaigns API `/{account}/campaigns?fields=id,website_url` → `Record<campaignId, url>`
3. Both run in parallel via `Promise.all` with the insights fetch
4. For each insight row: extract path from `website_url`, look up click count, attach as `row.ctaClicks`

### Key files

- **SPA:** `vibes.diy/pkg/reports-app/src/CampaignHealth.tsx`
- **Handler:** `vibes.diy/api/svc/public/report-campaign-health.ts`
- **Types:** `vibes.diy/api/types/report.ts` — `ResReportCampaignHealthCampaignRow` has `ctaClicks?: number`

---

## Open Items

1. **Column names** — user unhappy with "Site Visits", "Content Views", "Registrations" (to be renamed)
2. **Promote to prod** — needs prod tag after column rename is settled
3. **Zero-CTA campaigns** — block-party / wedding landing pages aren't converting; separate product problem

---

## Column Definitions (current, in-UI `<dl>`)

| Term          | Definition shown                                                                         |
| ------------- | ---------------------------------------------------------------------------------------- |
| Click Rate    | Ad CTR — clicks ÷ impressions                                                            |
| Cost/Click    | Spend ÷ clicks (CPC)                                                                     |
| CTA Clicks    | Outbound clicks good.vibes.diy → vibes.diy from Referer header in server logs (all-time) |
| Site Visits   | Meta `landing_page_view` — browser pixel on good.vibes.diy                               |
| Content Views | CAPI `ViewContent` — 10s dwell or 25% scroll on vibes.diy                                |
| Registrations | CAPI `CompleteRegistration` — new Clerk account within 2 min of fbclid session           |
| Cost/Visit    | Spend ÷ site visits; primary efficiency metric                                           |
