# Magic words placeholder spacing

**Hook:** The vibe edit card's faux placeholder "Change the app with ~~magic~~ words…" rendered with "magic" jammed against its neighbors — even though the JSX clearly has spaces around `<s>magic</s>`.

**Source:** `vibes.diy/base/components/UnifiedVibeCard.tsx` — the placeholder `<span>` is `display: flex` (used to vertically center the text inside the absolutely-positioned overlay). Flexbox promotes each contiguous text run and the `<s>` element into separate flex items and trims the whitespace *between* items, so the single spaces from the JSX vanished at paint time.

**The gotcha:** jsdom doesn't do flex layout, so `textContent` still reported `"Change the app with magic words…"` with proper single spaces — the unit test happily passed while the real browser showed the cramped version. Whitespace-collapse-in-flex is invisible to a `textContent` assertion.

**Fix:** give the `<s>` an explicit `margin: 0 0.25em` so the gap survives regardless of the flex item boundary. Cheap, local, no layout-model change.
