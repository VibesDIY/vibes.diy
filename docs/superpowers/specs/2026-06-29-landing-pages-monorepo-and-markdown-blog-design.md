# Landing-pages → public monorepo + markdown blog with feeds

**Date:** 2026-06-29
**Status:** Design finalized — all open questions resolved (see Decisions); ready for planning
**Owner:** jchris

## Decisions (resolved)

- **Cutover:** downtime acceptable; priority is not getting wedged. Gate on a green/verified
  build before it can touch the live site, not on zero-overlap.
- **Package layout:** standalone (not a pnpm workspace member); CI uses `--ignore-workspace`.
- **Blog stack:** `marked` + `gray-matter` with raw-HTML passthrough. **MDX rejected** (no
  React/bundler in this SSG; iframes cover interactivity).
- **Generated apps:** stay under `landing-pages/` alongside the site.
- **Feeds:** both Atom 1.0 and RSS 2.0, summary entries.
- **CF account:** same account the monorepo already deploys to; reuse existing credentials.

## Problem

The site at **good.vibes.diy** is built by the **private** `VibesDIY/landing-pages` repo
(a Handlebars static-site generator → `_site/`, deployed via GitHub Actions to the
Cloudflare Pages project `landing-pages`). We want to:

1. Move the public site into the **public** `VibesDIY/vibes.diy` monorepo so blog/landing
   content ships through the same repo as everything else, with merge-to-main as the only
   deploy gate.
2. Add a proper **markdown-authored blog** with a shared template and **Atom + RSS feeds**
   (today's blog posts are hand-written inline-HTML `.hbs` files and the index is
   hand-maintained cards — nothing machine-readable).
3. Do this **without** leaking the private ad/marketing tooling that also lives in
   `landing-pages` into the public repo, and **without** ending up with two copies of the
   public content.

## Constraints & key facts

- Target repo `VibesDIY/vibes.diy` is **PUBLIC**. Source repo `VibesDIY/landing-pages` is
  **private** and stays private.
- Deploy is **already** GitHub-Actions-based (`cloudflare/wrangler-action` →
  `pages deploy _site --project-name=landing-pages`), **not** Cloudflare git-integration.
  CF Pages project `landing-pages` serves `good.vibes.diy` (+ `landing-pages-coh.pages.dev`),
  account `f031392067b661e91963881fb76b4ea3`.
- Build = `node build.js`: walks `src/pages/**/*.hbs`, parses JSON front-matter from a
  leading `{{!-- ... --}}` comment, renders body + layout, writes `_site/`, emits
  `sitemap.ndjson`, copies static assets.
- A privacy audit of the tracked tree found **no live secrets** (nothing to rotate), but a
  cluster of ad/marketing tooling and personal info that must NOT go public — see
  [Split](#1-the-split-public-vs-private).
- Repo policy: rebase-only (no squash); specs under `docs/superpowers/` go on a review PR
  (tag CharlieHelps), not direct to main.

## 1. The split (public vs private)

The private `landing-pages` repo **stays private and stays alive** — it becomes the home of
just the ad/marketing tooling. The public site moves out. After the move, the moved content
is deleted from the private repo so there is exactly **one copy** of each thing.

### Moves to public `vibes.diy/landing-pages/`

- The SSG: `src/` (pages, layouts, partials), `build.js`, `package.json`, `pnpm-lock.yaml`.
- Static assets: `images/`, `_headers`, `vibes-diy-logo.svg`, `Vibes-Toggle-1-Transparent.png`.
- The **generated apps** (owner wants these public — interesting/useful):
  `roommate-grocery-list`, `spanish-learning`, `trip-expense-split`,
  `weekly-chore-rotation`, `volunteer-signup-tasks`, `vibes/`, `featured-apps/`.
- The `research/` syllabus-harvest pipeline.
- The **safe** `agents/` and `docs/` content (everything except the ad-tooling files listed
  below) and `README.md`.
- Build-side tooling that is safe and useful: `screenshot-pages.js`, `test-sitemap.js`,
  `verify_apps.sh`, `scripts/` **except** the ad/campaign items below.
- **Meta pixel + fbclid plumbing in `build.js` comes along** — it ships in every page and is
  public by design (pixel ID `1310410873948425`).

### Stays in private `landing-pages` (ad-posting/management gear)

> **Note:** the initial privacy audit undercounted this set. A precise scan during the staging
> copy (commit `5ad9b84c6` on this branch is the **authoritative moved/public set**; the
> private set is its complement) found substantially more ad tooling. The real exclusion set:

- **Ad/marketing agents (24):** `agents/{ad-copy-rules,ad-preview-server,campaign-health-check,
content-map-ads-vs-creator,fb-ads-campaign,fb-ads-zine,full-audience-playbook,geofence-campaigns,
meta-ads-setup,new-audience-page,task-business-ad-account-setup,task-create-test-ad,
lessons-from-good-ads,lessons-from-good-ads-bad-pages}.md` and every
  `agents/handoff-*-ads.md` (camping, chess, free-library, group-chat, group-ranker,
  growth-writers, meta-ads-access, stanford, tailgate, zine).
- **Ad/marketing scripts (~18):** `scripts/campaigns/` and `scripts/{ab-report,ad-preview-server,
backfill-utm-campaign,campaign-health,create-camping-ads,create-campus-ads,create-direct-ads,
create-direct-ads-remix,create-garage-sale-ads,create-meta-ad,create-photo-ads-batch,
fetch-adset-ids,fix-cta,fix-stanford-creatives,gen-photo-creatives,upload-photo-batch}.js`,
  `scripts/photo-ab-work.json`.
- **Ad-posting plan/spec docs:** `docs/superpowers/plans/2026-05-25-ut-austin-campus-ads.md`,
  `docs/superpowers/plans/2026-05-27-road-trip-page.md` (both embed Meta Graph API ad-creation
  code), and `docs/superpowers/specs/2026-05-25-ut-austin-campus-ads-design.md`.
- `notes/web-advertising-strategy.md`.
- **Not carried into the monorepo subdir** (repo-config / private-repo artifacts): the private
  repo's `CLAUDE.md`, `.github/`, `.vscode/`, `.prettierignore`, `MIGRATION.md` — the subdir
  gets its own scoped agents pointer instead.
- Rationale: these contain real Meta business/app/page/account IDs, a personal FB ad account
  tied to a real name, internal budgets, geofence coordinates, and A/B ad copy — written for
  the team, not the public. (No live secrets — only env-var names — but PII + ad strategy.)
- **`vibes/og/**/\*.log`** run logs were left behind as cruft (the source `.gitignore` already
  ignores them); not real content.

### Cross-repo bookkeeping

- Add `vibes.diy/landing-pages/agents/ad-tooling.md` (pointer): ad-posting/management tooling
  lives in the private `VibesDIY/landing-pages` repo.
- Add a note in the private repo about the move (what left, where it went, the monorepo PR).
- File an issue on `VibesDIY/landing-pages` to **retarget the ad scripts to work cross-repo**
  (they may reference the now-moved site/app paths). **The retarget work is deferred** — the
  issue just tracks it. (Filed: `VibesDIY/landing-pages#114`.)
- **Cloudflare account:** `f031392067b661e91963881fb76b4ea3` is the **same account the
  monorepo already uses** for its worker deploys. So this is not a new exposure — the account
  ID already appears in this repo's CI, and the new workflow **reuses the monorepo's existing
  Cloudflare credentials** (same `CLOUDFLARE_API_TOKEN` secret / account config the existing
  deploy workflows use). No new secret/variable needs creating; match whatever pattern the
  current monorepo CF deploy uses.

## 2. Deploy

- New workflow `.github/workflows/landing-pages-deploy.yml` (top-level `.github/`, the git
  root), adapted from the current `deploy.yml`:
  - **Path-scoped** to `landing-pages/**` so unrelated monorepo commits don't redeploy.
  - Build step runs inside `landing-pages/`. Because it is **not** a pnpm workspace member,
    install with `pnpm install --ignore-workspace` (prevents the monorepo root from claiming
    it). Then `pnpm build`.
  - Deploy `pages deploy _site --project-name=landing-pages` → **good.vibes.diy unchanged**.
  - **Same Cloudflare account the monorepo already deploys to** — reuse the existing
    `CLOUDFLARE_API_TOKEN` secret + account config the current CF workflows use (don't invent
    a new secret/var). **Prerequisite to verify:** that token has Pages:Edit.
  - Keep the existing PR-preview job (path-scoped) so blog/landing PRs get a preview URL.
- Working dir / lockfile note: `package-lock.json` is gitignored in the source repo; the
  tracked lockfile is `pnpm-lock.yaml`. CI uses pnpm.

### Cutover sequence (downtime OK, just don't get wedged)

Owner decision: a little downtime is acceptable — the priority is **never landing in a wedged
state** (broken build deployed, or both repos fighting over the Pages project). So the gate is
"build is verified green before it can touch the live site," not "zero overlap."

1. Monorepo PR adds `landing-pages/` + the workflow; **CI build + PR preview must be green and
   verified** to produce an equivalent `_site` (spot-check `good.vibes.diy` pages + blog +
   feeds) before merge. This is the anti-wedge gate — a broken build never reaches good.vibes.diy.
2. Merge → monorepo deploys `good.vibes.diy` from the new workflow.
3. Remove the old repo's `.github/workflows/deploy.yml` so the two repos don't both deploy to
   the same Pages project. A brief overlap or short gap is fine (content is identical) — the
   only thing to avoid is leaving both live indefinitely.
4. Delete the moved (public) content from the private repo; add the move note there.
5. Confirm `good.vibes.diy` still serves correctly post-cutover.

## 3. Markdown blog + feeds

### Authoring model

- Posts become **`src/posts/*.md`** with YAML front-matter:
  `title`, `date` (ISO `YYYY-MM-DD`), `summary`, `author`, `thumb` (optional image path),
  `draft` (optional bool, excluded from index/feed when true).
- `build.js` gains a **blog pass**:
  - New deps: `gray-matter` (front-matter) + `marked` (md → HTML). No other deps.
  - Render each post body with `marked`, wrap in one shared **`blog-post` layout** that owns
    the styling currently copy-pasted into each post's `<style>`. Output to
    `_site/blog/<slug>.html`.
  - Collect all non-draft posts, sort by `date` descending → the canonical post list.
- Landing pages stay `.hbs`. Only the **blog** moves to markdown. The page walk keeps working
  for `.hbs`; the blog pass is additive and reads `src/posts/`.

### Rich content without MDX (decision)

MDX was considered and **rejected** for this stack. The SSG is plain Node + Handlebars with
**no React and no bundler**; MDX would require `@mdx-js/mdx` + a React/Preact SSR runtime +
a bundler (esbuild) — either bloating the standalone package or coupling the blog build to the
app's React/vite toolchain (undoing the standalone decision). Its main payoff (inline React
components) is largely redundant here because **every Vibe is an embeddable iframe**, so a
live interactive demo in a post is just an `<iframe>`. Instead:

- `marked` is configured to **pass raw HTML through**, so a `.md` post can include styled
  callouts, custom blocks, and `<iframe>` embeds of live vibes when richer content is needed.
- If a rich pattern starts repeating, add a small **shortcode/partial** vocabulary later — no
  React required. Revisit MDX only if we hit a concrete need to SSR _shared React components_
  inside posts.

### Generated index + feeds (from the one post list)

- **Blog index** (`_site/blog/index.html`) is generated from the sorted post list via a
  `blog-index` template — no more hand-maintained cards. Replaces today's
  `src/pages/blog/index.hbs` card block.
- **Feeds:** emit both
  - `_site/blog/feed.xml` — **Atom 1.0**
  - `_site/blog/rss.xml` — **RSS 2.0**
    Entries are **summary** (front-matter `summary`) + canonical link + date (not full content).
    Both built from the same post list using `BASE_URL` (already in `build.js`).
- **Autodiscovery:** blog `<head>` gets
  `<link rel="alternate" type="application/atom+xml" href="/blog/feed.xml">` and the RSS
  equivalent. Add via the blog templates' `<head>` (blog-post + blog-index).
- **Sitemap:** the blog pass also emits its pages into the existing `sitemap.ndjson` so the
  generated posts stay in the sitemap.

### Migrating the 3 existing posts

The current inline-HTML `.hbs` posts
(`upgrading-apps-with-screenshots`, `how-we-eval-the-generator`,
`can-a-prompt-rebuild-the-pickathon-app`) are converted **one-time** to content-only
markdown under the new template:

- Lift `title` → front-matter; set `date` (June 9, 2026 per current cards), `summary` from the
  existing card copy, `author`, and `thumb` where a card image exists.
- Convert the prose body to markdown; drop the per-post `<style>` (now provided by the shared
  `blog-post` layout). Preserve images (`images/blog/...` paths already copied as assets).
- Remove the old `src/pages/blog/*.hbs` (including `index.hbs`) once the markdown versions
  render equivalently.

## Components & boundaries

| Unit                              | Purpose                                                     | Depends on                                                        |
| --------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `build.js` page walk              | Render `.hbs` landing pages + sitemap (unchanged)           | Handlebars, `src/pages/`, `src/layouts/`                          |
| `build.js` blog pass (new)        | md → HTML posts, generated index, Atom+RSS, sitemap entries | `marked`, `gray-matter`, `src/posts/`, blog templates, `BASE_URL` |
| `blog-post` layout (new)          | Shared chrome + styling + feed autodiscovery for a post     | —                                                                 |
| `blog-index` template (new)       | Render post cards from the sorted list                      | post list                                                         |
| feed emitter (new, in `build.js`) | Serialize Atom + RSS from the post list                     | post list, `BASE_URL`                                             |
| deploy workflow (moved)           | Build in `landing-pages/`, deploy to CF Pages               | pnpm, `CLOUDFLARE_API_TOKEN`, account var                         |

## Testing / verification

- `pnpm install --ignore-workspace && pnpm build` in `landing-pages/` succeeds; `_site/`
  contains the existing pages, the 3 migrated posts, a generated `blog/index.html`, and
  `blog/feed.xml` + `blog/rss.xml`.
- Feeds validate: well-formed XML, correct item count, dates, canonical absolute URLs against
  `BASE_URL`. (Use `test-sitemap.js`-style check or a quick XML parse in CI/local.)
- Autodiscovery `<link rel="alternate">` present on blog pages.
- PR preview renders `good.vibes.diy` content equivalently (spot-check homepage + a landing
  page + blog index + a post + both feeds).
- Post-cutover: `good.vibes.diy` live, old repo no longer deploying.

## Out of scope (explicit)

- Retargeting the ad/marketing scripts to work cross-repo (tracked by a deferred issue).
- Moving ad tooling to a third repo (biz-ops) — rejected in favor of leaving it in the
  now-private-only `landing-pages` repo.
- Making `landing-pages/` a pnpm workspace member.
- MDX / inline React components in posts — rejected; raw-HTML passthrough + iframe embeds
  cover rich content for now.
- Full-content (vs summary) feed entries.
- Archiving the `landing-pages` repo (it stays as the private ad-tooling home).
