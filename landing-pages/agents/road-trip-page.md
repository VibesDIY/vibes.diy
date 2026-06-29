# Road Trip Page — Agent Runbook

End-to-end guide for the road trip audience page.

**Spec:** `docs/superpowers/specs/2026-05-27-road-trip-page-design.md`
**Plan:** `docs/superpowers/plans/2026-05-27-road-trip-page.md`

**PR policy:** Merge PR before activating any Meta ads.

---

## Apps (all deployed under og/)

| App | Slug | Tag |
|-----|------|-----|
| Signpost | `road-signpost` | Route Advice |
| Road Party | `road-party-finder` | Gather |
| The Fill-Up | `road-resource-share` | Resource Share |
| Who You Met | `road-encounters` | People |
| The Weird One | `route-advisor` | Decide |

Verify deploy: `curl -sL https://<slug>--og.prod-v2.vibesdiy.net/ | grep -oE '"fsId":"[^"]+"'`

## Upgrade Cycle

See spec Phase 2 upgrade targets. Run `agents/improve-app-via-screenshot.md` per app.

## Regenerating apps

Use `vibes/road-trip/_run.sh`. Always verify fsId after generation.

## Ads

Script: `scripts/create-road-trip-ads.js`
Image: `images/screenshots/road-trip.jpg`
URL: `https://good.vibes.diy/road-trip/`

Always create ACTIVE at $10/day. Never PAUSED.
