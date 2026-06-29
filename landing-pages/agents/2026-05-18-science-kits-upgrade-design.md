# Design: Science-Kits Page Upgrade to Live Vibes

**Date:** 2026-05-18  
**Scope:** Upgrade `src/pages/science-kits.hbs` from a generic audience page to a live-vibes page using the college layout. Also extend `agents/new-audience-page.md` with an upgrade-path step.

## What We're Building

Replace the current generic science-kits page (standard layout, no real apps) with a "Slab Concrete" skin page (webring layout) containing 5 deployed companion apps — one per kit type — showcasing what a science kit creator can build for their customers.

## Runbook Change

Add **Step 0 (upgrade path)** to `agents/new-audience-page.md`:

> If upgrading an existing audience page: note the current slug, strip the old `.hbs` content, and replace with the college-layout template. Keep the same filename so existing index links don't break. Carry forward the frontmatter `source` tag.

No other runbook changes needed.

## Page Design

**File:** `src/pages/science-kits.hbs`  
**Layout:** `webring` (brings its own chrome)

### Skin

Slab Concrete variant — same structure as `college.hbs` but accent color swapped:

- `--acid`: `oklch(0.83 0.22 145)` — phosphor green (vs college's yellow)
- `--concrete`: `oklch(0.88 0 0)`
- `--black`: `oklch(0.10 0 0)`
- Fonts: Inter (900 weight headings) + JetBrains Mono (labels, buttons, meta)

### Structure

1. **Topbar** — `VIBES.DIY` brand left · `FOR SCIENCE KIT CREATORS · five kit companion apps` meta right
2. **Breadcrumb** — Home › Science Kits
3. **Hero** — large bold headline with phosphor-green `.hi` highlight span + lead paragraph. Suggested headline: *"Apps that ship / with the <span class='hi'>kit.</span>"* Lead: something about companion apps turning physical kits into living experiments.
4. **Stats bar** — 4 cells: Apps / Audience / Persistence / Skin
5. **Section label** — `// The Kit Library`
6. **Apps list** — 5 `.app` entries from frontmatter `apps` array
7. **Epilogue** — short paragraph on why companion apps matter for kit creators
8. **Footer** — terminal-style, same as college

### Frontmatter

```json
{
  "layout": "webring",
  "title": "For Science Kit Creators | Build Companion Apps | Vibes DIY",
  "description": "Science kit creators use Vibes DIY to build step-by-step experiment companions, data loggers, and teacher dashboards — one per kit SKU, in minutes.",
  "ogUrl": "https://good.vibes.diy/science-kits",
  "source": "science-kits",
  "apps": [
    {
      "num": "01",
      "slug": "chemistry-reaction-log",
      "author": "og",
      "live": false,
      "title": "Reaction Logger",
      "tagline": "Every reaction, timestamped.",
      "desc": "Log observations during a chemistry experiment — step label, color change, temperature, pH, notes, photo. Timestamped entries. Shareable result card at the end."
    },
    {
      "num": "02",
      "slug": "circuit-build-guide",
      "author": "og",
      "live": false,
      "title": "Circuit Guide",
      "tagline": "From components to complete.",
      "desc": "Step-by-step assembly checklist for an electronics kit. Check off each component as you place it. Flag where you're stuck. Show completion percentage."
    },
    {
      "num": "03",
      "slug": "plant-growth-tracker",
      "author": "og",
      "live": false,
      "title": "Grow Tracker",
      "tagline": "Day one to harvest.",
      "desc": "Daily measurement log for a plant biology kit. Height, photo upload, prediction vs actual. Auto-generates a growth timeline chart. Shareable."
    },
    {
      "num": "04",
      "slug": "rocket-launch-log",
      "author": "og",
      "live": false,
      "title": "Mission Debrief",
      "tagline": "Pre-flight to post-flight.",
      "desc": "Pre-launch checklist, launch data entry (weather, angle, altitude estimate), post-flight notes. Shareable mission debrief card."
    },
    {
      "num": "05",
      "slug": "experiment-discovery-board",
      "author": "og",
      "live": false,
      "title": "Discovery Board",
      "tagline": "Show what you found.",
      "desc": "Gallery of completed experiments — title, photo, result summary, star rating. Shareable link. Works across any kit type."
    }
  ]
}
```

## CLI Generation

**Script location:** `vibes/science-kits/_run.sh`  
**Pattern:** standard batch gen from `agents/new-audience-page.md` with `--user-slug=og`

| slug | prompt |
|------|--------|
| `chemistry-reaction-log` | Log observations during a chemistry experiment — step label, color change, temperature, pH, notes, photo. Timestamped entries. Shareable result card at the end. |
| `circuit-build-guide` | Step-by-step assembly checklist for an electronics kit. Check off each component as you place it. Flag where you're stuck. Show completion percentage. |
| `plant-growth-tracker` | Daily measurement log for a plant biology kit. Height, photo upload, prediction vs actual. Auto-generates a growth timeline chart. Shareable. |
| `rocket-launch-log` | Pre-launch checklist, launch data entry (weather, angle, altitude estimate), post-flight notes. Shareable mission debrief card. |
| `experiment-discovery-board` | Gallery of completed experiments — title, photo, result summary, star rating. Shareable link. Works across any kit type. |

After generation: verify each slug with `curl … | grep -E "fsId|mountVibe"` — must show real `fsId`, not `pending`. Flip `live: true` for each verified app.

## Completion Criteria

- [ ] `agents/new-audience-page.md` has Step 0 upgrade-path section
- [ ] `vibes/science-kits/_run.sh` exists and all 5 apps deployed with real fsId
- [ ] `src/pages/science-kits.hbs` uses webring layout, phosphor-green Slab Concrete skin, 5 apps with `live: true`
- [ ] `pnpm check` passes clean
- [ ] Page opens and screenshots load in browser
