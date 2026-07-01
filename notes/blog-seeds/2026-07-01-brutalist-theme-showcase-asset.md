# The 44th theme had no showcase — and the fix was a test, not a denylist

Source: `claude/fix-2924-ni603t` (#2924)

The Neobrutalist theme had everything a catalog theme needs — an exemplar
`App.jsx`, colorset yaml, design.md — except the one static asset every preview
surface actually renders: `vibes.diy/pkg/public/themes/brutalist.html`. It was
the only one of 44 catalog themes missing its showcase (43 HTMLs vs 44 themes),
so `/themes/brutalist.html` fell through to the SPA "Page Not Found" page, and
every surface that scales that route into a card — the theme-picker modal, the
new in-vibe settings thumbnail — rendered a 404 inside the card.

The interesting part is the *shape* of the workaround that had accumulated: a
hand-maintained `THEMES_WITHOUT_EXEMPLAR` denylist in the settings tab that
swapped the iframe for a colour swatch whenever a showcase was missing. That's a
denylist standing in for an invariant nobody was enforcing. Authoring the
showcase (restyled from the family's shared component-showcase template with the
brutalist tokens — Space Grotesk / JetBrains Mono, chunky 2px borders, hard
offset shadows, red/yellow blocks) let the denylist go to zero — but the real
fix was deleting the machinery and replacing it with a `theme-showcase-assets`
test that asserts *every* `vibesThemes` slug has a `/themes/<slug>.html`. The
guard moves from "remember to add the slug when a showcase is missing" to "you
can't merge a catalog theme without its showcase." Worth a short post on
preferring a machine-checked invariant over a manually-curated exception list.
