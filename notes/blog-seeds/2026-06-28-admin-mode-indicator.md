# The admin-mode indicator: completing the mode trio without touching the toggle

Source: #2178 (read-only + admin mode indicators), follows #2724 (viewer-mode indicators)

#2724 gave the unified card its viewer-mode glyphs (author shield, read-only-member
lock). #2178 also asked for an **admin-mode** indicator — the owner-toggled full
access-fn bypass. This adds it, completing the trio.

Worth a note:

- **Indicator vs control are separate concerns, kept separate.** The admin *toggle*
  already lives in the Share controls (`onToggleAdmin` on the ShareModal). This PR
  adds only the *indicator* on the card header — a highlighted (filled, amber) shield
  that takes precedence over the plain muted author shield, with `aria-label="Admin
  mode"`. The card reflects state; it doesn't own the toggle. Reading the route first
  to confirm where the toggle lived avoided duplicating it.
- **Distinguishing two shields.** Author and admin are both "owner-ish," so both use a
  shield — distinguished by treatment (admin = filled + amber + full opacity; author =
  outline + muted) and by accessible name ("Admin mode" vs "Owner"). Same icon family,
  unmistakable state.
- **Scoping discipline:** #2178 also mused about putting the hint on the *closed*
  switch toggle. That overlaps the epic's decided "closed = just the toggle" minimal
  state (and #2275's closed-mode ask), so it's a design question, not part of this
  settled slice. Shipped the decided part; flagged the rest.
