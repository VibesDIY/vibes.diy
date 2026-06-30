# good.vibes.diy gets a favicon: the D·I·Y half of the toggle

- **Branch / PR:** `claude/issue-2031-diy-black-jrdnui` — fixes #2031
- **Hook:** good.vibes.diy shipped with no favicon — just the browser's blank
  default page glyph in the tab. The full horizontal VIBES·DIY toggle collapses
  into an unreadable dark blob at 16px, so it was never a candidate for a tab mark.

## The trade-off / why

The fix is to use *one half* of the brand toggle rather than the whole wordmark.
Mike's agent mocked up seven directions from the real glyph paths (`vibes-toggle.svg`,
ink `#231f20` / ivory `#fffff0`); jchris picked **F · D•I•Y on ink** — the DIY half
with its interpunct dots, ivory glyphs on a near-black ink squircle.

Production assets are generated straight from the same brand path data so the mark
never drifts from the toggle:

- `favicon.svg` — the master, a 100×100 ink squircle (`rx=26`) with the DIY glyph
  paths framed into a centered 70×70 box via a nested `<svg viewBox>` + `xMidYMid meet`.
- `apple-touch-icon.png` (180px) — a **full-bleed** variant (rect, not squircle) so
  iOS's own corner mask doesn't composite over transparent corners.
- `favicon.ico` — 16/32/48 PNG-in-ICO entries for legacy tabs.

The `<link>` tags live in the shared `head.hbs` partial, so every page built through
the five real layouts (standard / blog-index / blog-post / editorial / webring) gets
them; `build.js` copies the three assets into `_site/` alongside the existing logo.

## Gotcha worth a post

Rasterizing the SVG with headless Chromium, the first render came out clipped to a
single giant "D". The bug wasn't the favicon — it was the *render harness*: the
`svg { width: …px }` CSS rule also matched the **nested** `<svg>` that frames the
glyph, blowing away its `width`/`height`/`x`/`y` and so its internal coordinate
mapping. Scoping the rule to `body > svg` fixed it. Nested SVGs are their own
elements; a bare `svg` selector is a wider blast radius than it looks.
