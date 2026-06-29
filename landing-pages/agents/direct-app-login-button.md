# Add a Prominent Login Button to Direct Apps

Every **direct-to-app** ad sends a cold visitor straight to `vibes.diy/vibe/<author>/<slug>` — no landing page in between. These apps are world-readable, so an anonymous visitor can _read_ but most interaction is gated behind `can("write")`. Generated apps typically render a passive fallback ("…check back soon…") and **no login affordance at all**, so the ad click dead-ends: the visitor can't participate and has no obvious way in.

Fix: render a **prominent "Sign in" button** in the hero/header for anonymous viewers. This is the highest-leverage conversion fix for direct-app campaigns — it turns a read-only dead-end into a one-tap path to `CompleteRegistration`.

## How login works in a vibe (`useViewer`)

`useViewer()` (from `use-vibes`) is the only public surface for auth inside app code. There is **no `login()` method**. Relevant fields:

| Field                  | Use                                                                                                                                                                                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `viewer`               | `null` when anonymous; the viewer payload when signed in. Gate the CTA on `!viewer`.                                                                                                                                                                                              |
| `can(action, dbName?)` | `can("write")` is false for anonymous viewers on a world-readable app.                                                                                                                                                                                                            |
| `isViewerPending`      | `true` until identity resolves (preview/handshake). Gate on `!isViewerPending` to avoid an anonymous-flash.                                                                                                                                                                       |
| `ViewerTag`            | A component returned by the hook. **Rendered with no props for an anonymous viewer it shows a "Sign in" button wired to the runtime's `requestLogin()`.** When signed in it shows the editable user pill. Its `style` prop is spread last, so you can restyle it to be prominent. |

So the way to "add a login button" is to render `<ViewerTag style={…} />` (in `_jsxDEV` form) for anonymous viewers — you don't call login yourself.

## The pattern

> ⚠️ These deployed `App.jsx` files are **pre-transpiled** — the component body is manual `_jsxDEV(...)` calls, **not raw JSX**. Match that style; don't introduce `<Component/>` syntax into the body.

**1. Extend the hook destructure.** If the app already has `const { viewer, can } = useViewer()`:

```js
const { viewer, can, isViewerPending, ViewerTag } = useViewer();
```

If the app doesn't use `useViewer` yet (e.g. pub-trivia-night), add the import alongside the other `use-vibes`/`use-fireproof` imports and call the hook near the other hooks:

```js
import { useViewer } from "use-vibes";
// …inside App():
const { viewer, isViewerPending, ViewerTag } = useViewer();
```

**2. Render a prominent, themed login block** for anonymous viewers, placed where an ad-click visitor sees it on load (hero/header, above the fold). Gate on `(!isViewerPending && !viewer)`. Style `ViewerTag` to match the app's accent with high contrast:

```js
, (!isViewerPending && !viewer) && (
  _jsxDEV('div', { className: "flex flex-col items-center gap-3 my-4", children: [
    _jsxDEV(ViewerTag, { style: { background: '<ACCENT>', border: 'none', color: '<CONTRAST>', borderRadius: '0.5rem', padding: '0.95rem 2.4rem', fontSize: '1.2rem', fontWeight: 700, boxShadow: '0 6px 22px rgba(0,0,0,0.4)' } }, void 0, false, {fileName: _jsxFileName}, this)
    , _jsxDEV('p', { className: "text-sm opacity-80", children: "Sign in to <app-specific verb phrase>." }, void 0, false, {fileName: _jsxFileName}, this)
  ]}, void 0, true, {fileName: _jsxFileName}, this)
)
```

- Write the helper line to fit the app ("Sign in to claim a gift.", "Sign in to host or join trivia night.").
- Keep logged-in CTAs (`can("write")` branches) as-is — they only render when signed in.
- Match the `_jsxDEV` source-location arg (`_jsxFileName` / `{fileName: …}`) to whatever neighboring calls in that file use.

## Deploy & verify

Per [`improve-app-via-screenshot.md`](improve-app-via-screenshot.md). **Push from inside the app dir, with the correct author** (it is _not_ always `og` — pub-trivia-night is `jchris`):

```sh
cd vibes/direct-ads/<slug>
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
"$TSX" "$MAIN" push --user-slug <author>
```

Verify against the **server screenshot, which renders the anonymous view** — exactly what the button targets:

```sh
curl -sfL "https://<slug>--<author>.prod-v2.vibesdiy.net/screenshot.jpg" -o /tmp/<slug>.jpg \
  && wc -c /tmp/<slug>.jpg && file /tmp/<slug>.jpg     # expect >5KB JPEG
```

Then Read the jpg and confirm the Sign in button is visible.

## Batch it

For multiple apps, dispatch one agent per app (see [`parallel-upgrade-loop.md`](parallel-upgrade-loop.md)) — each app is an isolated dir + deploy, so they parallelize cleanly. Give each agent: the file path, the **author**, the accent color, this pattern, and the screenshot-verify step.

## Status (live direct-app campaigns)

All five live direct-app destinations have the button as of 2026-06-15:

| App                     | Author     | Accent                  |
| ----------------------- | ---------- | ----------------------- |
| camping-adventure-story | og         | gold `#F4A300`          |
| book-exchange-log       | og         | green `#2d6a4f`         |
| guest-address-book      | og         | dark `#14141a` on cream |
| group-gift-claimer      | og         | gold `#f0c040`          |
| pub-trivia-night        | **jchris** | gold `#e8b948`          |

The other staged apps in `vibes/direct-ads/` still need it before their campaigns launch.

## Related runbooks

- [`improve-app-via-screenshot.md`](improve-app-via-screenshot.md) — the screenshot→edit→push→verify loop this builds on
- [`parallel-upgrade-loop.md`](parallel-upgrade-loop.md) — batch one agent per app
- [`direct-to-app-design-note.md`](direct-to-app-design-note.md) — the design gap between landing pages and bare apps
- [`campaign-health-check.md`](campaign-health-check.md) — measuring whether direct-app funnels convert
