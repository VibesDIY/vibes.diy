# Building a featured-apps page

This guide is for an agent (or human) adding a new category page under `/featured-apps/<slug>`. The repo has three reusable templates and one CLI for generating new live vibes — picking the right template + writing the right frontmatter is most of the work.

## Where things live

| Path                                           | What                                                                        |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| `src/pages/featured-apps/<slug>.hbs`           | The page source (frontmatter + optional `<style>` skin + partial call)      |
| `src/pages/featured-apps/index.hbs`            | The category index with one `<a class="cat-card">` per page                 |
| `src/layouts/{standard,editorial,webring}.hbs` | The three layouts                                                           |
| `src/partials/featured-app-body.hbs`           | Renders the **standard** template (ivory neobrutalist)                      |
| `src/partials/featured-app-body-editorial.hbs` | Renders the **editorial** template (builders-style magazine)                |
| `featured-apps/<slug>/README.md`               | Per-category content brief — flat text list of apps the page should feature |
| `_site/featured-apps/<slug>.html`              | Build output, opened with `open _site/featured-apps/<slug>.html`            |

## The three templates

Pick the one that matches the audience.

### 1. Standard — `featured-app-body` partial · `layout: "standard"`

Ivory neobrutalist cards, accent ribbons, sticky header with logo. Best for clean utility tools.

**Examples:** `household-logistics.hbs`, `garden-and-plants.hbs`, `classroom-tools.hbs`.

**Frontmatter fields** (inside the `{{!-- { ... } --}}` block at the top of the page):

```text
layout            "standard"
title             page <title>
description       meta description
ogUrl             "https://good.vibes.diy/featured-apps/<slug>"
source            short kebab-case id (used as a Mailchimp source tag)
accent            hex color, e.g. "#009ace"
breadcrumbTitle   short title for the breadcrumb
heroTitle         text with trailing space (the accent word goes in <span>)
heroAccentWord    the colored half of the headline
heroDesc          subhead paragraph
stories           one paragraph, may use <strong>/<em>
ctaTitle          newsletter card heading
ctaText           newsletter card body
ctaButton         newsletter submit label
classics          [{ author, slug, description }]
groups            [{ description, variants: [{author, slug}] }]
```

End the file with `{{> featured-app-body}}`. Per-page skinning goes in a `<style>` block between the `--}}` and the partial call. Inspect class names in `src/partials/featured-app-styles.hbs` before overriding.

### 2. Webring — `rituals-and-goals.hbs` (one-off layout) · `layout: "webring"`

Times Roman, dark scroll, late-90s GeoCities personal page. Best for community / nostalgic / intimate categories. There is **no shared partial** — copy the entire `rituals-and-goals.hbs` file as your starting point and recolor.

**Examples:** `rituals-and-goals.hbs`, `pets.hbs`, `kitchen-and-cooking.hbs`, `neighborhood-swaps.hbs`.

**Frontmatter fields:**

```text
layout            "webring"
title             include "~ ~" flair
description       meta description
ogUrl, source     same convention as standard
classics          [{ author, slug, description, category }]
                  (category = one-word like "Recipes" / "Walks")
groups            [{ title, description, variants: [{author, slug}] }]
```

To skin: edit the inline `<style>` block — body bg, `.scroll` background/border, link colors, decorative emoji (✦ ☾ → 🐾 / ★ / 📌 / etc), and the "Best viewed in Netscape" stamp.

### 3. Editorial — `featured-app-body-editorial` partial · `layout: "editorial"`

Sharp magazine, color blocks, color stripes, fixed cream nav. Best for opinionated / loud / zeitgeisty categories.

**Examples:** `linkedin-influencers.hbs`, `party-games.hbs`, `fitness-and-sports.hbs`, `creative-studios.hbs`, `hero-at-work.hbs`, `outdoor-logs.hbs`.

**Frontmatter fields:**

```text
layout            "editorial"
title, description, ogUrl, source        (standard meta)
breadcrumbTitle
heroTitle, heroAccentWord, heroDesc      (same shape as standard)
heroPunch         1–3 lines, <br>-separated; renders inside red card
heroStatNumber    e.g. "20 apps"
heroStatLabel     yellow card body text
whyLabel          small caps label on the why-section card
whyTitle          why-section heading
whyDesc           why-section paragraph
parallels         [{ before, after, accent: "cyan"|"red"|"yellow" }] — exactly 4
classics          optional [{ author, slug, description }]

# OPTION A — flat groups (uniform grid-3):
appsLabel, appsTitle, appsIntro
groups            [{ title, description, variants: [{author, slug}] }]

# OPTION B — categorized sections (mixed layouts) — see below:
appsSections      [{ id, label, title, intro, layout, groups }]

stories, storiesQuote, storiesCite
ctaTitle, ctaText, ctaButton
```

End the file with `{{> featured-app-body-editorial}}`. Per-page skinning goes in a `<style>` block before the partial call — the simplest hook is `body { --red: #x; --cyan: #y; --yellow: #z; }` to recolor everything.

**`appsSections` (option B)** lets one page mix multiple list styles. Each section has its own label, title, intro, and layout:

```text
appsSections: [
  {
    id:           "sincere",
    label:        "01 — Sincere",
    labelFilled:  true,            // optional, makes label dark
    title:        "...",
    intro:        "...",
    layout:       "list",          // one of the values below
    groups:       [ ... ]
  },
  ...
]
```

Available `layout` values:

| Value      | Look                                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `grid-3`   | Default. 3-col card grid with full screenshot per card.                                                                                      |
| `grid-2`   | 2-col card grid; bigger cards. Good for multi-variant groups.                                                                                |
| `featured` | Single full-width banner; screenshot half + body half side-by-side.                                                                          |
| `list`     | Vertical column; small thumb left, italic text right. Contemplative tone.                                                                    |
| `compact`  | 4-col tight directory; **no screenshots**, just title + 3-line description + small Visit/Clone/Remix buttons. Good for long generator lists. |
| `tiles`    | 2-col image-dominant; screenshot fills the card, body text hidden. Good for visual mockups.                                                  |

**Multi-variant rule:** any `groups` entry with `variants.length > 1` automatically renders all variant screenshots in a horizontal `.ed-app-shots-row` (16:6 aspect ratio, equal flex width — so 50% each for 2 variants, 33% for 3) instead of one big shot. Single-variant groups render the full screenshot. The agent doesn't need to do anything special — just put each take in `variants`.

See `linkedin-influencers.hbs` for a 7-section example (sincere → silly progression).

## Picking template + skin

A skin is two things: a tight color palette (3 colors max) and one small motif (a texture, an emoji set, or a typographic tic). Don't over-design — the templates already carry most of the visual weight.

| Template  | Best for                       | Example skin                                         |
| --------- | ------------------------------ | ---------------------------------------------------- |
| Standard  | Utility tools, kid-friendly    | Chalkboard hero + blue-ruled paper (classroom-tools) |
| Webring   | Community, intimate, nostalgic | Lost-pet flyer with paw-print bg (pets)              |
| Editorial | Opinionated, loud, zeitgeisty  | Arcade neon with scanlines (party-games)             |

## Generating new vibes (the CLI)

The featured pages link to live apps deployed via `vibes-diy`. To add new ones:

```sh
npx vibes-diy login                                   # once per device
npx vibes-diy generate "your prompt" --app-slug=your-slug --user-slug=og
```

Behavior: writes `App.jsx` + `README.md` to `./<your-slug>/`, deploys, prints `https://vibes.diy/vibe/<user-slug>/<your-slug>`.

**Always pass `--user-slug` explicitly in batch scripts.** The flag pins the publishing namespace for that single command, regardless of what `vibes-diy login` set as the default. Without it, the CLI uses whatever account you happened to be logged in as, and that default can shift mid-session (e.g. after a re-auth, an account swap, or a CLI upgrade) — apps land at `<other-user>/<slug>` while the page still hard-codes `og` and every embed white-screens. Pinning the flag is robust; relying on the login default is not. Both `generate` and `push` accept `--user-slug`.

**Batch-generating in parallel:** see `vibes/<cluster>/_run.sh` (e.g. `vibes/one-bit-status/_run.sh`) for the pattern — a shell `gen()` function that backgrounds each call with `--user-slug=og --app-slug=<slug>` and appends `DONE <slug> exit=$?` to `_status.log`. Use the `Monitor` tool (or `tail -F _status.log`) to watch completions.

A typical full prompt for a single-file React vibe should specify:

- The user input surface (textarea / paste / form)
- What the AI does with the input (generate / classify / rank)
- The output shape (list of saved Fireproof docs, visual card, chart, etc.)
- The persistence model — virtually always: "save each result as a Fireproof doc, list past results below"
- Tone (parody / sincere / playful / etc)

See `featured-apps/linkedin-influencers/README.md` and any `featured-apps/<slug>/README.md` for the level of brevity the partial expects in `description` fields.

## Building the data from a category README

Each category has a flat `featured-apps/<slug>/README.md` listing apps:

```text
## Apps
- https://vibes.diy/vibe/AUTHOR/SLUG short description sentence.

## Classics
- https://vibes.diy/vibe/og/SLUG description sentence.
```

When apps share an identical (or near-identical) description, **collapse them into one `groups` entry with multiple `variants`** — that's the takes pattern that keeps the page from feeling repetitive.

For each group, invent a short product-style `title` from the description (3–5 words, title case). The first sentence becomes the `description` field that drives both the card body and the "Start fresh from this prompt" link.

## Verifying

```sh
pnpm check                                  # rebuilds _site/
npx prettier --write src/pages/featured-apps/<slug>.hbs
pnpm check                                  # again, after prettier
open _site/featured-apps/<slug>.html
```

## Wiring into the index

When the page is ready:

1. Find the matching `<a class="cat-card coming-soon">` in `src/pages/featured-apps/index.hbs`.
2. Remove the `coming-soon` modifier.
3. Rebuild and verify the card no longer renders dimmed.

(The `.cat-card.coming-soon` CSS rule keeps un-flipped cards 55% opacity with `pointer-events: none`.)

## Conventions

- All external links use the `https://links.vibes.diy/<short>` redirector, not bare URLs (Discord, YouTube, Substack, GitHub, CLI, homepage).
- Screenshot URLs follow `https://<slug>--<author>.prod-v2.vibesdiy.net/screenshot.jpg` with an `onerror` fallback to `{{@root.assetPrefix}}images/og-preview.png`.
- Run `pnpm check` before committing — the project's CLAUDE.md requires it.
- Run `npx prettier --write` on any `.hbs` you touched — CI fails on formatting drift.
- Don't commit unless the user asks.
