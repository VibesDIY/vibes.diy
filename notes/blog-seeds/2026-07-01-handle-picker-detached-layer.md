# You can't strike through a placeholder, and you can't un-clip a child

Source: `claude/vibe-handles-menu-scroll-k313xk` (follow-up to #2990)

Two Vibe-card tweaks that both hit the same wall: **the browser won't let an
element be two things at once.**

**The handle picker menu.** The active-handle switcher opens from a tag in the
card header, but the card is a floating panel that clips its own overflow
(`overflow: hidden`, `maxHeight: 82%`). A menu rendered as a descendant of that
panel is trapped: open it downward and the tail (New handle / Log out) is
scissored off at the card's bottom edge; the card body's own ~200px scroll area
throws off any "just position it inside" math. The fix isn't a better offset —
it's to stop being a descendant. The menu now renders as a `position: fixed`
**sibling** of the card (not a portal — a fixed sibling already escapes an
ancestor's clip, because fixed positioning resolves against the viewport, not the
clipped box), anchored near the *top* of the screen and overlapping just past the
card's right edge for a detached, casual look. Being viewport-bounded, it can
always scroll to its last row.

Two gotchas that ride along with "move it out of the parent":
- **Dark mode broke.** The card's light→dark token remap is scoped to
  `[data-unified-vibe-card]`; a sibling isn't inside that selector, so the menu
  rendered white-on-white in dark mode. Fix: tag the detached layer
  `[data-vibe-handle-menu]` and add it to the same remap rule.
- **Click-away broke.** The dismiss-on-outside-click test was `!anchor.contains(target)`.
  Once the menu lives outside the anchor, clicking a menu row counts as "outside"
  and dismisses it before the row's handler runs. Fix: treat *both* the anchor and
  the detached menu as "inside."

**The strikethrough placeholder.** Ask: make the composer say "Change the app
with ~~magic~~ words…". A real `placeholder` attribute is plain text — no `<s>`,
no markup, full stop. So the honest answer is a **faux placeholder**: an
`aria-hidden`, `pointer-events: none` span overlaid on the input, shown only while
the value is empty, holding real `<s>magic</s>` markup. The input keeps an
`aria-label` so accessibility doesn't regress. Worth stating plainly to the user
that the native control can't do it, rather than pretending — the overlay is the
trick that makes the impossible ask real.
