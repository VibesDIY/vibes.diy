# Adding a blog post to good.vibes.diy

The blog is markdown-authored. To add a post you write one `.md` file — the
index card and the Atom/RSS feeds regenerate themselves from it. No HTML
boilerplate, no hand-editing an index, no touching `build.js`.

## TL;DR

1. Create `landing-pages/src/posts/<slug>.md` (the `<slug>` becomes the URL:
   `https://good.vibes.diy/blog/<slug>.html`).
2. Add YAML front-matter (see the table below) and write the body in markdown.
3. Put any images under `landing-pages/images/blog/<slug>/` and reference them
   with **root-absolute** paths: `/images/blog/<slug>/whatever.png`.
4. Build + eyeball: `cd landing-pages && pnpm install --ignore-workspace && pnpm build`,
   then open `_site/blog/<slug>.html`, `_site/blog/index.html`, and check
   `_site/blog/feed.xml` / `rss.xml` list the post.
5. Commit the `.md` (and images). On merge to `main` the deploy workflow ships
   it to good.vibes.diy automatically.

That's it — the post is rendered into the shared `blog-post` layout, added to
the generated index, both feeds, and the sitemap.

## Front-matter fields

```yaml
---
title: "How we shipped the thing" # required — H1 + <title> + og:title
date: 2026-07-01 # required — ISO date; sorts the index/feeds (newest first)
summary: "One or two sentences." # shown on the index card AND as the feed entry summary
description: "SEO meta description." # optional — <meta name=description>/og; falls back to summary
author: "Vibes DIY" # optional — defaults to "Vibes DIY"
thumb: "/images/blog/<slug>/card.png" # optional — index card image + og:image (root-absolute)
glyph: "look → fix → push ↺" # optional — text tile shown on the index when there's no thumb
draft: true # optional — excluded from the build (index, feeds, page) while true
---
```

- **Same-day ordering:** if two posts share a `date`, give the newer one a later
  time so the index order is deterministic, e.g. `date: 2026-07-01T12:00:00Z`
  vs `...T10:00:00Z`. The displayed date still reads as the calendar day.
- **`thumb` vs `glyph`:** provide a `thumb` for an image card; omit it and set
  `glyph` for a monospace text tile instead.

## Writing the body

The body is plain markdown rendered by `marked`, with a few conventions:

- **Headings/paragraphs/lists/blockquotes/inline code/links** — standard markdown.
- **Code blocks** — use fenced blocks with a language, ```` ```js ````. The
  language label is rendered as the styled tag in the corner of the code block;
  you do not write any HTML for it.
- **Raw HTML passes through.** For anything the shared styles already cover but
  markdown can't express, drop in raw HTML:
  - `<figure><img src="/images/blog/<slug>/x.png" alt="…"><figcaption>…</figcaption></figure>`
  - A/B comparison grid: `<div class="compare">…two <figure>s…</div>` +
    optional `<div class="compare-caption">…</div>`
  - Tables: wrap in `<div class="table-scroll"><table>…</table></div>`
  - **Embed a live vibe** as an `<iframe>` — every Vibe is embeddable, so a live
    interactive demo is just an iframe (this is why we skipped MDX).
- **A closing call-to-action** (optional) — end the post with:
  ```html
  <div class="post-cta">
    <h3>Headline</h3>
    <p>Subtext.</p>
    <a href="https://links.vibes.diy/homepage" class="btn">Start building →</a>
  </div>
  ```
- **Post-specific decoration** — if a post needs bespoke CSS the shared layout
  doesn't have (a custom diagram, a gallery), put a scoped `<style>…</style>`
  block at the top of the `.md` body. Keep shared chrome (prose, figures,
  tables, code, CTA) in the layout — only one-off art goes inline. See
  `src/posts/upgrading-apps-with-screenshots.md` for an example.

## Screenshots — generate a purpose-built vibe to art-direct the shot

You can't fabricate screenshots, but you don't have to settle for whatever a
random app looks like either. Generate a vibe **for the post** with the `vibes-diy`
CLI, art-directing the look, then capture it. This is the repeatable way to get a
clean, on-message image (minimal chrome, a chosen hue, a feature mid-action).

1. **Generate, art-directed.** Put the aesthetic in the prompt — "no header or
   buttons, almost no text," "greenish-teal," "full-bleed," "show N items already
   present." The device is logged in (`VIBES_DEVICE_ID` is set in CI/cloud):
   ```sh
   npx vibes-diy@latest generate "A full-screen ambient orb … no text … teal-green glow" --app-slug blog-demo-<slug>
   ```
   It deploys live and prints `https://vibes.diy/vibe/<handle>/blog-demo-<slug>`.
2. **Make the feature visible (the auth gotcha).** A logged-out capture won't show
   data that requires a signed-in write — the app's own seed effect is gated on
   `can.create`, so a guest sees an *empty* app. Seed demo data as the owner so the
   public view is populated:
   ```sh
   npx vibes-diy@latest db put --vibe <handle>/blog-demo-<slug> --db <dbName> \
     --id seed-1 '{"type":"flower","x":12,"y":78,"authorHandle":"<your-handle>", ...}'
   ```
   `authorHandle` must equal your own handle (author-owned access rules). Repeat per
   doc. (Alternative: hand-tweak the pulled `App.jsx` and `npx vibes-diy push`.)
   Note: the streaming `edit` subcommand can drop mid-turn in cloud sessions and
   roll back ("Recovered N files from snapshots") — prefer `db put` / `push` for
   deterministic art-direction.
3. **Capture the app, not the chrome.** With the chrome-devtools MCP: set a mobile
   viewport (`resize_page` 390×844), `navigate_page` to the `/vibe` URL (the bare
   `*--*.prod-v2.vibesdiy.net` URL redirects there), `take_snapshot` to get the
   `Iframe` element's `uid`, then `take_screenshot` with that `uid` — that captures
   only the app (the floating Vibes switch and nav are excluded). The app embeds a
   small VIBES·DIY watermark, which is fine for the blog.
4. **Place + embed.** Save to `images/blog/<post-slug>/<name>.png` and reference it
   with a root-absolute path in a `<figure>` (see "Writing the body"). Caption it
   honestly and link the live vibe.

The capture is fine on cloud headless Chromium when the app supplies its own
colors (no forced-dark distortion); if a shot looks wrongly darkened, re-capture
from a real browser. See `src/posts/in-place-generation.md` and
`teaching-codegen-defaults.md` for generated-vibe figures, and
`the-vibe-owner-viewer-experience.md` for an expanded-switch capture of a live app.

## How it's wired (for reference)

- `build.js` blog pass reads `src/posts/*.md`, renders with `marked` +
  `gray-matter`, wraps each in `src/layouts/blog-post.hbs`, and writes
  `_site/blog/<slug>.html`.
- The sorted post list also generates `_site/blog/index.html`
  (`src/layouts/blog-index.hbs`), `_site/blog/feed.xml` (Atom 1.0),
  `_site/blog/rss.xml` (RSS 2.0), and the blog entries in `sitemap.ndjson`.
- Feeds use `BASE_URL` (`https://good.vibes.diy`) for absolute links; entries
  are summaries (the `summary` field), not full content.

## Don't

- Don't add posts as `.hbs` under `src/pages/blog/` — that directory is gone;
  the blog is markdown-only now.
- Don't hand-edit a blog index or feed — they're generated; edits get
  overwritten on the next build.
- Don't use `{{assetPrefix}}` or other Handlebars in a post — posts are markdown;
  use root-absolute `/images/...` paths.
