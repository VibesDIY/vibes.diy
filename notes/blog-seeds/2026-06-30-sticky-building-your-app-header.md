# Pin the "building your app" line so it survives the scroll

Source: `claude/jolly-johnson-91llr8` — during an in-vibe generation the card body
streams a header (`building your app… · N msgs · ~N lines`) followed by the
model's `▸` narration lines. The header was the first child of a scrolling
container (`UnifiedVibeCard`'s `streamBody` slot is `overflowY: auto`), so as the
narration piled up the live count summary scrolled out of view — exactly the line
a watching owner wants to keep their eye on.

Fix is one CSS rule on the header row in `GenerationStreamView`: `position:
sticky; top: 0` plus the card-body background (`--color-light-background-00`) and a
`zIndex` so the narration slides *under* it instead of bleeding through. The
spinner + count now stay pinned at the top of the stream while the narration
scrolls beneath them.

Angles worth a full post:

1. **Sticky needs an opaque backdrop, or it leaks.** A `position: sticky` header
   only looks pinned if it paints over what scrolls behind it. Without the
   background fill the narration shows through the header's text gaps and reads as
   a rendering glitch — the masking color is load-bearing, not decoration.

2. **The status line you want pinned is the one that changes.** Static labels can
   scroll away; a *live* counter (msgs/lines ticking up) is the thing the user is
   actively reading, so it's the natural candidate to keep in the viewport even
   when everything else moves.
