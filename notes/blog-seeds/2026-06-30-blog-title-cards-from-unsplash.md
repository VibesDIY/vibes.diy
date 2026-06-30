# Branded title cards: giving image-less blog posts an index card instead of a text tile

Source: `claude/blog-post-illustrations-d8cgw2`

The blog index renders each post as a card; posts without a `thumb` fell back to a `glyph` —
a flat monospace text tile (`"isOwner ✗"`, `"shard the runners"`). A whole run of recent infra/
CI/refactor posts shipped that way, so the index read as a wall of text blocks next to the few
posts that had real screenshots. The fix wasn't "go take 12 screenshots" — most of these posts
have nothing photographable. Instead: synthesize an illustration. Each card is a duotone
(teal → goldenrod) treatment of a *topical* Unsplash photo — a bank vault for the access-control
post, runners on a track for CI sharding, a rocket for the runtime lift — with the post's own
glyph, an overline, and the title set over it in the blog's house style. The duotone + goldenrod
overlay is the trick that makes it cohesive: any stock photo, once pushed through the same
grayscale-contrast + brand-gradient stack, reads as *ours* rather than as clip art.

The reusable bit is `landing-pages/scripts/blog-card.js` (puppeteer, the dep the repo already
has): pass `--slug/--photo/--overline/--glyph/--title`, it fetches the Unsplash photo, base64-
embeds it so the render is self-contained, and screenshots a 1600×900 JPEG (~120 KB at q82 —
JPEG, not PNG, because these are photographic and a 1 MB PNG × 12 on the index is a real tax).
Cloud gotcha worth keeping: puppeteer's own Chrome download is skipped in cloud sessions, so the
script auto-resolves Playwright's Chromium under `/opt/pw-browsers` (newest `chromium-*`),
falling back to puppeteer's bundled binary locally — one resolver makes the same script work in
both places. The throughline: when a post has no natural image, a synthesized-but-on-brand card
beats a text tile, and once the recipe is a committed script + a documented step in
`blog-authoring.md`, "every post ships a thumb" becomes a default instead of a chore.
