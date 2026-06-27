# Seed: the logo that teleported

- **Hook:** the Vibes logo appeared top-left during load, then jumped to the
  bottom-right. It read as a bug. It wasn't one element moving — it was two
  logos in opposite corners, mounting and unmounting at different times.
- **Source:** `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`. The
  top-left `VibesSwitch` renders whenever `!isAccessGranted` (including the
  transient `"loading"` state) behind a `Delayed ms={1000}`; the bottom-right
  `ExpandedVibesPill` mounts only after `isAccessGranted`, behind its *own*
  `Delayed ms={1000}`. Slow grant resolution = top-left flash, then pill.
- **Trade-off / gotcha:** the top-left logo isn't decorative — it's the only
  `SessionSidebar` toggle, and only exists while access is ungranted. So "just
  delete it" strands the sidebar on the card / not-found screens. The fix that
  actually ships: suppress the logo during `"loading"` only, keep it on the
  persistent card / not-found screens. Invisible until bottom-right, sidebar
  toggle intact.
- Spec: `notes/vibe-logo-loading-spec.md`.
