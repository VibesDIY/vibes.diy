# Theme preview that doesn't yank you off the page

Source: `claude/theme-preview-thumbnail-jvonuq`

The Theme card in the in-vibe settings had a "preview" link that opened
`/vibe/theme/<slug>` in a new tab — a full navigation away from the vibe you
were editing just to glance at what a theme looks like. We swapped it for an
inline thumbnail: the same static `/themes/<slug>.html` exemplar pages the
theme-picker modal already scales into cards, rendered as a small
`transform: scale(0.18)` iframe right under the select, with the accent-color
swatch in the corner.

The angle worth writing up is reuse-as-a-feature: the picker modal had already
solved "show a faithful theme preview cheaply" (author the exemplar at 1400×900,
scale it down so the layout stays true instead of reflowing a tiny viewport).
Pointing a second surface at the same assets turned a context-destroying link
into a glanceable preview with no new infrastructure — the gotcha being only
that the thumbnail iframe must stay `pointer-events-none` and `sandbox`ed so it
reads as an image, not an interactive page.
