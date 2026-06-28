# The active-handle switcher: the "active handle" was already a user setting, the UI just never asked

Source: #2678 (issue), #2675 (epic), #2275 (backend that landed)

The agent-in-vibe card (#2676) shipped with a handle tag at the top — `@meghan ▾` —
but the `▾` was a dead glyph. #2678 wired it to a real dropdown: "Acting as" →
your handles (active one checked) → "New handle". The interesting part is how
little new machinery it needed.

Decisions worth a full post:

- **There is no `setActiveHandle` API — and there shouldn't be.** The "active
  handle" is just the `defaultHandle` *user setting* (`ensureUserSettings({ settings:
  [{ type: "defaultHandle", ownerHandle }] })`), which the server's
  `resolveActiveHandle` (#2275) already honors when attributing writes. So
  "switching handle" is a one-line settings upsert; the picker reads it back the
  same way Settings' `HandlesCard` already did. The richer per-app "last-used
  handle in *this* app" resolution the epic sketches (§2) is deliberately *not*
  built — the landed backend resolves a single account default, and that's the
  honest surface to expose first.
- **Ownership is account-level, so switching handle never changes `isOwner`.** The
  vibe route used to derive `myUserSlug` from `listHandleBindings()[0]` — wrong
  twice over: it ignored the actual default, and it implied identity was the first
  binding. Now bindings + settings load together, `isOwner` checks *any* binding
  against the route owner (account-level), and the active handle is the resolved
  default. The two concerns finally separate cleanly.
- **Single-source-of-truth or it drifts.** The Storybook sketch had its *own*
  `HandleMenu`/`HandleRow` mock. That duplicate is deleted; the real
  `HandlePickerMenu` now lives in `@vibes.diy/base` and the `HandlePickerOpen`
  story renders the as-built `UnifiedVibeCard` with `handlePickerOpen`. The sketch
  can no longer disagree with production because it *is* production.
- **The gotcha: an active-row `✓` poisons the accessible name.** `getByRole(
  "menuitem", { name: /@meghan$/ })` failed because the check mark concatenated into
  the button's accessible name ("@meghan ✓"). Marking the `✓` `aria-hidden` (the
  state is already on `aria-current`) is both the a11y-correct fix and what makes
  the row queryable. Decorative glyphs should never be in the accessible name.

Scoped out on purpose: **avatar photo-editing on click.** The issue mentions it,
but per-handle avatar upload is a 4-step grant→POST→confirm→`ensureHandleAvatar`
flow (`HandleAvatarEditor`); the picker shows per-handle avatars cheaply via the
`/u/<handle>/avatar` URL (graceful initial-fallback on 404) but doesn't wire the
write yet. Kept the PR to the switcher.
