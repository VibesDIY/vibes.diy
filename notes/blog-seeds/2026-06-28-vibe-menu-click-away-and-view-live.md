# Vibe menu: click-away to dismiss + dropping the self-referential "View live"

**Hook:** Two small but felt fixes on the `/vibe` route's expandable menu (the "window vibes switch") — it now closes when you click outside it, and the Share panel no longer offers a "View live" link that just reloads the page you're already on.

**Source:**
- `vibes.diy/base/components/UnifiedVibeCard.tsx` — added a transparent, full-viewport click-away backdrop rendered only while `open`, sitting above the running app and below the card + toggle (z-index 1 / 2 / 3).
- `vibes.diy/base/components/SharePanelView.tsx` — removed the "View live ↗" button and the now-unused `onViewLive` prop; wiring removed in `vibe.$ownerHandle.$appSlug.tsx` and `AgentInVibe.stories.tsx`.

**Trade-off / why / gotcha:**
- The card floats over the live app, which renders in an **iframe**. A document-level `mousedown` listener (the pattern the in-card handle picker uses) can't see clicks that land on a cross-origin iframe — they never bubble to the parent document. So the reliable dismiss mechanism is a backdrop element that physically intercepts the click above the iframe, not an event listener. The backdrop is transparent (no dimming) so it's visually inert; it only exists to catch the click.
- It's rendered on `open` (not `mounted`) so the 240ms shrink-exit animation isn't click-blocking.
- The "View live" link resolved to `shareModal.publishedUrl ?? /vibe/${vibeSlug}` — on the in-app Share panel that's the current page, so it was a no-op-feeling reload. Copy URL already covers sharing; the link added confusion, not capability (originally #2234's "link-first" idea, which doesn't hold up inside the running vibe).
