# Direct-to-app campaign attribution — design

**Issue:** [VibesDIY/vibes.diy#2333](https://github.com/VibesDIY/vibes.diy/issues/2333)
**Date:** 2026-06-12
**Status:** Proposed — Option A approved by review ([PR #2347](https://github.com/VibesDIY/vibes.diy/pull/2347)) with guardrails folded in; pending implementation plan

## Problem

The campaign-health report cannot attribute **direct-to-app** campaigns — ads that link straight to `vibes.diy/vibe/<author>/<slug>?fbclid=X&utm_campaign=Y` instead of routing through a `good.vibes.diy` landing page. Their per-campaign **CTA Visitors** / **Cost/Visitor** columns are always blank. Direct-to-app launched 2026-06-10 (10 campaigns) on the assumption the funnel would stay visible; it doesn't.

This is **not** a Meta-side tracking outage. PageView CAPI fires for direct-app landings (`vibes.diy/pkg/workers/app.ts:68`), ViewContent fires from `useEngagedVisit`, and Meta's native CTR/LPV/cost-per-LPV all work and drive ad optimization. What's missing is the report's **internal per-campaign click-through depth** for direct-app rows.

## Root cause

The only local attribution source is `good.vibes.diy` referer events. `fetchGoodVibesClickThroughs()` (`vibes.diy/api/svc/public/report-campaign-health.ts:64`) reads `RefererEvents` filtered to `eq(refHost, "good.vibes.diy")` and mines `fbclid` + `utm_campaign` from the **referer URL**. That works for landing-page campaigns because of a two-hop flow:

1. Ad → `good.vibes.diy/<page>?fbclid=X&utm_campaign=Y` (fbclid is on the page URL).
2. User clicks a CTA → request to `vibes.diy` carries `Referer: good.vibes.diy/<page>?fbclid=X` → the worker logs `[referer] <href>` (`app.ts:326-340`) → ETL writes it to `RefererEvents` → the report mines fbclid from the referer.

**Direct-to-app has no second hop.** The ad lands straight on `vibes.diy/vibe/og/<slug>?fbclid=X&utm_campaign=...`. The fbclid is on the **request URL**, not on any referer. The `[referer]` log records only the referer href (Facebook, no fbclid) plus `reqUri.pathname` — the request query string is dropped (`app.ts:337`). And `landingPath` is only set when the destination host is `good.vibes.diy` (`report-campaign-health.ts:256`), so direct-app rows get `ctaClicks: undefined`.

## Approach: capture direct-app landings end-to-end (Option A)

Mirror the existing `[referer]` → ETL → table → report → SPA pipeline with a parallel `[landing]` event that records the **request-URL** `fbclid` + `utm_campaign` for `/vibe/*` landings, injected right beside the existing CAPI fire.

### Decisions locked during brainstorming

- **Capture approach — Option A** (`[landing]` log pipeline), not Option B (persisting CAPI engaged events). Rationale: mirrors the established `[referer]`/`[missing-vibe]` ETL pattern, and captures the landing even if client JS never runs. Option B would add a new write path inside `/capi/engaged` and depend on the client executing.
- **Bot/prefetch traffic — capture all, label LPV-ish.** Direct landings include Facebook link-preview crawlers hitting the URL with the ad's fbclid (the good.vibes.diy path is naturally bot-filtered because crawlers don't click CTAs). We do **not** maintain a user-agent deny list. We emit `[landing]` for every fbclid vibe load, dedupe unique fbclid per campaign, and the SPA labels a direct-app "CTA Visitor" as closer to a landing-page-view (LPV-ish) so the two attribution semantics are never silently conflated.
- **No cross-repo / landing-pages change, no backfill.** The report already holds each campaign's destination URL from Meta metadata (`meta.website_url`) — it's exactly how `landingPath` is derived for good.vibes.diy today (`report-campaign-health.ts:253`). A direct ad's `website_url` _is_ `vibes.diy/vibe/og/<slug>?utm_campaign=direct-app-<slug>`, and the captured landing carries the same `utm_campaign` string (Meta only appends `fbclid`). So we **join on the `utm_campaign` string** extracted from the campaign's own `website_url` — no numeric-convention rewrite and no rewriting of the 10 live ads is required. Slugs are unique per campaign, so this is a clean join key. (Unifying the ad-creation convention to numeric `campaign_id` remains a possible future landing-pages cleanup, but it is not needed for attribution and is out of scope here.)

## Layered design

All code lives in `vibes.diy/`. Each layer mirrors an existing, proven equivalent.

### Layer 1 — capture (`pkg/workers/app.ts`)

Beside the fbclid CAPI block (`app.ts:64-71`), emit a structured landing log for vibe routes carrying an fbclid:

```
[landing] <full-request-url> <pathname> <user-agent>
```

- **Gate:** `fbclid !== undefined && parseVibePathname(url.pathname) !== undefined`. `parseVibePathname` is already imported and used at `app.ts:344`.
- **Why full URL:** the query string is kept intact so the ETL can extract both `fbclid` and `utm_campaign` at read time.
- **Why a distinct prefix:** unlike `[referer]`, this is a same-host landing. The `[referer]` block deliberately skips internal/same-host requests (`app.ts:336`), so the landing signal needs its own `[landing]` prefix.
- **User-agent (Charlie guardrail #3):** the `User-Agent` header is appended as the free-form trailing field so crawler/prefetch noise can be audited later without re-instrumenting. It is captured but **not** used for filtering in v1. It must be the last field because UAs contain spaces (the ETL regex captures the remainder of the line).

### Layer 2 — ETL + schema

**`api/logpush-etl/worker.ts`** (mirror the referer equivalents at lines 42 / 70 / 72 / 115 / 178):

- `LANDING_RE = /^\[landing\] (\S+) (\S+) (.*)$/` — URL, pathname, then the free-form UA tail (`.*` so spaces in the UA are captured).
- `parseLandingLine(message, ts, logKey, lineIdx)` — parse the URL, pull `fbclid` + `utm_campaign` from its query, and keep the UA group (mirror `parseRefererLine`). Return `null` on malformed URL.
- An inline `landingEvents` pgTable (kept in sync with the pg schema, per the file's existing "keep in sync" convention).
- `batchInsertLanding()` with `onConflictDoNothing()` on the dedup PK.
- An `else if (message.startsWith("[landing]"))` branch in the scan loop, plus counters in the summary log line.

**`api/sql/vibes-diy-api-schema-sqlite.ts` + `-pg.ts`** — add `sqlLandingEvents` (`LandingEvents` table), shape parallel to `sqlRefererEvents` (`-pg.ts:264`):

| column        | notes                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `logKey`      | R2 object key; part of dedup PK                                                                |
| `lineIdx`     | line index within the R2 object; part of dedup PK                                              |
| `ts`          | event timestamp (indexed)                                                                      |
| `landHref`    | full landing URL, query intact                                                                 |
| `landHost`    | hostname only                                                                                  |
| `landPath`    | path only                                                                                      |
| `fbclid`      | parsed from `landHref` query at ETL write time; the report's join column                       |
| `utmCampaign` | parsed from `landHref` query at ETL write time; the report's join column                       |
| `ua`          | raw `User-Agent` (Charlie guardrail #3); stored for future bot/prefetch auditing, unused in v1 |

PK `(logKey, lineIdx)`; `ts` index. Register in `api/sql/tables.ts` (sqlite map ~line 28, pg map ~line 66). Both SQLite and Postgres schemas get the table — no dev/prod schema divergence.

> Note (Charlie guardrail #5): the report reads the **parsed `fbclid`/`utmCampaign` columns** — it does **not** re-parse `landHref` at read time. `landHref` is the audit/debug source of truth; the parsed columns keep the table queryable and indexable. (This differs from `fetchGoodVibesClickThroughs`, which parses `refHref` on read — the new table is parsed once at write time instead.)

### Layer 3 — report enrichment (`api/svc/public/report-campaign-health.ts`)

- Add `fetchDirectAppLandings(vctx, sinceIso, untilIso): Promise<{ byUtmCampaign: Record<string, number> }>`, mirroring `fetchGoodVibesClickThroughs` but reading `LandingEvents` (no host filter — these are already vibe landings) and counting **unique fbclid per `utmCampaign`** straight from the **parsed `utmCampaign`/`fbclid` columns** (Charlie guardrail #5 — no re-parse of `landHref`). Null-prototype map to prevent prototype-key shadowing, same as the existing function. **Skip rows with an empty/null `utmCampaign`** (Charlie guardrail #2) so organic fbclid-bearing shares never land in the per-campaign map.
- Run it inside the existing `Promise.all` (`:151`).
- In the per-row merge (`:248-272`): when a campaign has no good.vibes.diy `landingPath`, derive a **direct key** by extracting `utm_campaign` from the campaign's own `website_url` (mirroring the `landingPath` extraction at `:253`), gated on **all** of: the destination host is `vibes.diy`, the path is a `/vibe/*` route, and the extracted `utm_campaign` is **non-empty**. Do **not** infer the key from the slug or campaign name (Charlie guardrail #1). Then source `ctaClicks` from `directLandingsByUtm[campaignUtm]` and set `directApp: true`.
- **Duplicate/ambiguous keys (Charlie guardrail #1):** if more than one campaign in the result set derives the **same** direct `utm_campaign` key, do not silently assign the same visitor count + cost/visitor to each. Mark those rows shared — reuse the existing `ctaClicksIsShared` flag (parallel to the good.vibes.diy path-sharing case at `:269`) so the SPA can surface the ambiguity rather than overstating per-campaign depth.
- Precedence (Charlie guardrail #4): existing good.vibes.diy attribution (`hasCampaignAttribution` / `landingPath`) takes priority; direct-app is the fallback only when there is no good.vibes.diy landing path. No regression to landing-page rows.

### Layer 4 — response types (`api/types/report.ts`)

Add `"directApp?": "boolean"` next to `ctaClicks` / `ctaClicksIsShared` (`:173-179`). Additive optional field — no breaking change. A row's `directApp: true` signals that its `ctaClicks` is a direct-app LPV-ish count, not a good.vibes.diy landing→app hop.

### Layer 5 — SPA (`pkg/reports-app/src/CampaignHealth.tsx`)

- Render `ctaClicks` for direct-app rows (same column as today).
- When `row.directApp`, swap the column tooltip to make the semantics explicit — e.g. "Unique fbclid sessions that loaded the app directly (LPV-ish)" — distinct from the current good.vibes.diy hop copy (`:554-563`), and badge the row so the two attribution semantics are visually distinguished.
- When `row.directApp && row.ctaClicksIsShared`, reuse the existing shared-count affordance so an ambiguous direct key (multiple campaigns → same `utm_campaign`) reads as shared, not as exact per-campaign depth.

### Layer 6 — tests

- **`api/tests/report-campaign-health-unit.test.ts`** — a `fetchDirectAppLandings` describe block paralleling the `fetchGoodVibesClickThroughs` suite: dedupe unique fbclid per `utmCampaign`, ignore rows without fbclid, **ignore rows with empty/null `utmCampaign`**, scope by date window. Plus report-row merge cases: joins by the `website_url`-derived key only when host is `vibes.diy` + `/vibe/*` + non-empty key; **precedence** (good.vibes.diy wins when both exist); and **ambiguity** (two campaigns deriving the same key → both flagged `ctaClicksIsShared`).
- **ETL** — a `parseLandingLine` unit test: valid line (incl. a UA tail containing spaces), missing fbclid, empty `utm_campaign`, malformed URL.

## Acceptance criteria

- [ ] Direct-app + direct-remix campaigns show non-blank **CTA Visitors** / **Cost/Visitor** in the report, scoped to the date window.
- [ ] Counts dedupe unique fbclid per campaign.
- [ ] Attribution joins direct landings to campaigns by the **non-empty** `utm_campaign` extracted from each campaign's `website_url` (host `vibes.diy` + `/vibe/*`), never inferred from slug/name — no landing-pages change and no ad backfill required.
- [ ] Rows with empty/null `utm_campaign` (e.g. organic fbclid shares) are excluded from per-campaign attribution.
- [ ] Two campaigns deriving the same direct key are flagged `ctaClicksIsShared`, not silently double-counted.
- [ ] No regression to existing good.vibes.diy landing-page attribution (good.vibes.diy wins when a campaign has both signals).
- [ ] Direct-app rows are visually/semantically distinguished from landing-page CTA rows (LPV-ish labeling).
- [ ] `LandingEvents` stores the raw `User-Agent` for later bot auditing (unused in v1).
- [ ] Unit tests for `fetchDirectAppLandings` and `parseLandingLine`.

## Notes / risks

- **Bot/prefetch traffic:** accepted, not filtered in v1. A direct-app "CTA Visitor" is closer to an LPV than a landing→app click; the SPA labels it as such. The raw `User-Agent` is stored in `LandingEvents` so crawler noise can be audited and a deny list added later without re-instrumenting. Revisit filtering only if the data shows it materially distorts counts.
- **Privacy:** `LandingEvents` stores `fbclid`, already stored in `RefererEvents`. No new PII class.
- **Single repo:** entirely within `vibes.diy`. No cross-repo coordination or rollout ordering.
