# Meta CAPI Attribution — Interpreting Results

How to query, read, and interpret data from the Meta Conversions API (CAPI) pipeline.

## What fires and when

| Event | Trigger | Client or Server | Gate |
|---|---|---|---|
| `PageView` | Worker fetch handler | Server-side | `?fbclid=` in URL |
| `ViewContent` | `useEngagedVisit` hook → `/capi/engaged` | Client relay | `fbclid` in sessionStorage + engagement threshold |
| `CompleteRegistration` | `useCapiCompleteRegistration` hook → `/capi/complete-registration` | Client relay | `fbclid` in sessionStorage + `user.createdAt` within 120 s |

All three events require an active Facebook click ID (`fbclid`) in the URL or sessionStorage. They are never fired for organic traffic.

## Data sources

### 1. Meta Graph API (pixel stats)

Credentials in `vibes.diy/pkg/.dev.vars`: `META_CAPI_TOKEN`, `META_PIXEL_ID`.

```bash
# Event counts by hour (last 5 hours by default)
curl "https://graph.facebook.com/v19.0/{PIXEL_ID}?fields=name,last_fired_time,stats&access_token={TOKEN}"

# Diagnostics — deduplication, match quality
curl "https://graph.facebook.com/v19.0/{PIXEL_ID}/diagnostics?access_token={TOKEN}"
```

**What to look for:**
- `last_fired_time` — if more than 6 hours ago, no fbclid traffic has hit prod recently
- `stats.data[].data` — expect `PageView` on any day with Facebook ad traffic; `ViewContent` after engaged sessions; `CompleteRegistration` only when new users sign up via ad click
- `ViewContent` without any `CompleteRegistration` is normal — most engaged visitors don't sign up

### 2. Worker logs (Cloudflare)

```bash
wrangler tail vibes-diy-v2-prod --format pretty 2>&1 | grep "\[capi\]"
```

Log lines to watch:
- `[capi] network error sending ...` — Meta API unreachable
- `[capi] non-ok ... response` + status code — Meta rejected the payload (check `fbc` format, `access_token`)
- `[referer] https://good.vibes.diy/path GET /vibe/...` — external navigation from marketing site; full path should be present (was broken pre-p2.3.17, fixed)

No log lines for CAPI means either no fbclid traffic or events are firing silently (check `ctx.waitUntil` wrappers in `app.ts`).

### 3. Neon `RefererEvents` table (attribution pipeline)

The logpush-etl worker (separate from the CAPI worker) reads Cloudflare Workers Trace Events from R2 and writes to `RefererEvents`. See [`agents/attribution-pipeline.md`](attribution-pipeline.md) for setup status — **as of 2026-05-19 the Logpush job and Neon secret have not been configured yet**, so this table may be empty.

When operational:
```sql
SELECT referer_host, referer_path, req_pathname, COUNT(*) as hits
FROM "RefererEvents"
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY 1, 2, 3
ORDER BY hits DESC
LIMIT 50;
```

This shows which pages on external sites (e.g. `good.vibes.diy/mind-games/crossword`) are driving traffic to which vibes.

## Interpreting the funnel

A healthy Facebook ad funnel looks like:

```
PageView (every fbclid visit)
  └── ViewContent (subset: engaged sessions ~30–60s on page)
        └── CompleteRegistration (small subset: new signups only)
```

**Normal ratios:**
- ViewContent / PageView ≈ 10–40% (depends on ad targeting quality)
- CompleteRegistration / PageView < 5% (most visitors don't sign up on first visit)

**Red flags:**
- `PageView` firing but no `ViewContent` — `useEngagedVisit` may not be wiring sessionStorage correctly, or engagement threshold not being crossed (users bouncing immediately)
- `CompleteRegistration` firing for users with old `createdAt` — the 120 s window guard in `useCapiCompleteRegistration` is broken
- Events show in Meta Test Events but not in production stats — likely using test event code in prod; remove it

## Event payload structure

All events use server-side CAPI (no browser pixel). Key fields:

```json
{
  "event_name": "CompleteRegistration",
  "action_source": "website",
  "event_time": 1716700000,
  "event_source_url": "https://vibes.diy/youtubers",
  "user_data": {
    "fbc": "fb.1.1716699950000.AbCdEfGhIjKl",
    "client_ip_address": "1.2.3.4",
    "client_user_agent": "Mozilla/5.0 ..."
  }
}
```

- `fbc` format: `fb.1.{fbclidTs_ms}.{fbclid}` — fbclidTs is when the user first landed with the fbclid, from `sessionStorage.capi_engaged_fbc_ts`
- `event_source_url` is the original landing page URL (from `sessionStorage.capi_engaged_landing_url`), not the relay endpoint
- No email or user ID is sent — attribution is purely click-based

## Common issues

| Symptom | Likely cause | Check |
|---|---|---|
| No events at all | No fbclid traffic hitting prod | Confirm active Facebook ad campaign with `?fbclid=` URLs |
| `PageView` only, nothing else | sessionStorage not persisting across navigation | Test manually: visit `/?fbclid=test`, stay on page, check sessionStorage in DevTools |
| Match quality warning in Meta | `fbc` format wrong or `client_ip_address` empty | Check CF-Connecting-IP header is populated; check `fbc` format in Worker logs |
| Duplicate events | `capi_engaged_fired` / `capi_cr_fired` sessionStorage keys not being set | Check hook logic; sessionStorage resets per tab, not per session |
| `CompleteRegistration` not firing | User signed up > 120 s after fbclid landing, or `createdAt` null (OAuth) defaults to `Date.now()` | Increase `NEW_USER_WINDOW_MS` or add cross-session persistence if needed |

## Source files

- Worker endpoints: [`vibes.diy/pkg/workers/app.ts`](../vibes.diy/pkg/workers/app.ts) (PageView inline, ViewContent + CompleteRegistration via routes)
- CAPI send functions: [`vibes.diy/pkg/workers/meta-capi.ts`](../vibes.diy/pkg/workers/meta-capi.ts), [`vibes.diy/pkg/workers/capi-complete-registration.ts`](../vibes.diy/pkg/workers/capi-complete-registration.ts)
- Client hooks: [`vibes.diy/pkg/app/hooks/useEngagedVisit.ts`](../vibes.diy/pkg/app/hooks/useEngagedVisit.ts), [`vibes.diy/pkg/app/hooks/useCapiCompleteRegistration.ts`](../vibes.diy/pkg/app/hooks/useCapiCompleteRegistration.ts)
- Hook wiring: [`vibes.diy/pkg/app/vibes-diy-provider.tsx`](../vibes.diy/pkg/app/vibes-diy-provider.tsx)
