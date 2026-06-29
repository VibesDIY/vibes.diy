# Ad / marketing tooling lives in the private repo

The ad-posting and campaign-management tooling for good.vibes.diy is **not** in
this public monorepo. It stays in the **private `VibesDIY/landing-pages` repo**,
which after the move (see PR #2849) is the private home of just that tooling.

What's over there (and intentionally not here):

- **Ad/marketing agents** — `ad-copy-rules`, `fb-ads-campaign`, `meta-ads-setup`,
  `campaign-health-check`, the `handoff-*-ads` runbooks, etc.
- **Ad/marketing scripts** — `scripts/campaigns/` plus the `create-*-ads`,
  `campaign-health`, `fetch-adset-ids`, and related Meta Graph API scripts.
- **Ad-posting plan/spec docs** and the web-advertising strategy note.

These contain real Meta business/app/page/account IDs, a personal ad account,
budgets, geofence coordinates, and A/B ad copy — written for the team, not the
public. There are no live secrets (only env-var names), but the PII and ad
strategy must stay private.

Retargeting those scripts to work cross-repo against the now-moved site/app
paths is tracked (deferred) in `VibesDIY/landing-pages#114`.
