# Validating the cached-suggestion read lane in prod (#2801 @ 3.0.5)

**Source:** read-only prod validation of `ship@3.0.5` (`3244519d6`) + the blog post
`landing-pages/src/posts/precompute-every-chip.md`.

Hooks/gotchas worth a post or a follow-up:

- **The offered chips track the vibe's *latest* suggestions, not the pinned
  version's** (`useLatestVibeChips` → `getVibeChips`). So an owner's in-place
  "produce" rotates the offered chips to the new draft's suggestions, and the
  just-produced chip scrolls off. The bless control (`canBless`) only renders on a
  *currently-offered* chip whose key matches a produced entry — so the bless window
  is effectively transient (catch it right after persist) on the same session, and
  on reload the produced chip is gone from the owner card. Producing must start from
  a **non-draft (published-HEAD) pin** anyway (guard `sourceFsId !== draftFsId`).

- **Anonymous saw no suggestion chips on a public ("Anyone with the link") prod
  vibe**, while the owner saw three on the same published HEAD — even with the WS API
  connected (`wss://prod-v2…/api/app?vibe=…`). Since `getVibeChips` (anonymous arm)
  and the cached-suggestion read share the `isPublicReadable`/`publicAccess.enable`
  gate, this gates the *entire* anonymous read-lane entry point. Needs a backend
  check: does a representative "Anyone with the link" vibe actually have
  `publicAccess.enable === true` on its **published** version, or does the toggle
  bind like #2902 (draft setting, inert on live until publish)? Deny-by-default held
  (no leaks) — but the headline anonymous cache-hit couldn't be exercised.

- **Tooling gap for validating the data layer:** there's no CLI surface for
  AppSettings / the cached-suggestion produce + bless maps, and the npm
  `vibes-diy@3.0.4` client predates the `getCachedSuggestion` method — so a direct
  endpoint call / map inspection isn't possible from the published CLI. A
  `vibes-diy app-settings` (or read-only `cached-suggestion`) read command would make
  this lane testable without driving the browser.

- **What's solid:** infra/activation (tags, prod+cli deploy success, flag on),
  live-build canaries, owner produce → draft → bless-control-surfaces, deny-by-default
  everywhere observed, and the boundary + log-redaction logic in the deployed source.
