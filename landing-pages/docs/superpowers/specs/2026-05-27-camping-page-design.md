# Camping Trip Page — Design Spec

**Date:** 2026-05-27  
**Status:** Approved  
**PR policy:** Merge PR before activating any ads for this page.

---

## What We're Building

A new audience page `src/pages/camping.hbs` for campers and outdoor enthusiasts. Five deployed Vibes apps embedded in the page. One supporting seed script for park data.

The landing page uses a **WPA vintage national park poster** aesthetic. The Park Finder app uses a distinct **topographic map** skin.

---

## Page

**File:** `src/pages/camping.hbs`  
**Layout:** `webring`  
**Source tag:** `camping`  
**OG URL:** `https://good.vibes.diy/camping/`

Structure mirrors `block-party.hbs` — same responsive 3-column app grid (num, body, screenshot+CTAs), same top banner stripe, same breadcrumb and topbar.

---

## Visual Design — WPA Poster Skin

| CSS Token | Value | Role |
|---|---|---|
| `--parchment` | `#F4EDD0` | page background |
| `--forest` | `#1E3D1A` | primary text, borders |
| `--gold` | `#C4A03A` | hero accent, badges |
| `--terra` | `#9E3B1C` | CTA buttons, hover |
| `--smoke` | `#7B7460` | muted text |

**Fonts:** Zilla Slab (Google Fonts) for all headings — slab-serif woodblock feel. Inter for body copy. No Fraunces.

**Decorations:**
- Top banner: repeating forest/gold/terra stripe (3 colors, 20px each, same pattern as block-party but ranger-station palette)
- Hero headline: all-caps condensed, very large (clamp 3rem–6rem), letter-spacing tight
- App cards: `3px solid var(--forest)` border, no offset ink shadow (unlike block-party)
- App number badges: WPA-style chip label (`TOOL 01`, etc.) in gold background, forest text
- Background: faint topo contour SVG at 6% opacity — nods to the Park Finder's topo skin without being the full treatment

---

## The Five Apps

| # | Title | Slug | Author | Tagline |
|---|---|---|---|---|
| 01 | Park Finder | `national-park-search` | og | "63 parks. Which one's yours?" |
| 02 | Packing List | `camp-gear-list` | og | "Who's got the bear canister?" |
| 03 | Meal Planner | `camp-meal-plan` | og | "Day 3 dinner: somebody's problem." |
| 04 | Trail Log | `group-trail-log` | og | "We did that. Barely." |
| 05 | Story Time | `camping-adventure-story` | og | "Chapter 2: the bear was right there." |

### App Descriptions

**01 — Park Finder**  
Browse and filter all 63 major NPS national parks. Filter by state, activity type (hiking, camping, swimming, climbing), and park designation. Each card shows park name, states, a photo, and entrance fee. App uses topographic map skin (off-white, charcoal, bright orange accent, JetBrains Mono for metadata). Data is seeded into Fireproof from `scripts/seed-parks.js`; the app loads it on first run from local Fireproof storage — no API key ships in the deployed app.

**02 — Packing List**  
Group camping gear checklist. Categories: Shelter, Kitchen, Safety, Navigation, Personal. Each item: what it is, who's bringing it, claimed or unclaimed. Shows "still needed" summary at top. Clone and update categories for your trip.

**03 — Meal Planner**  
Day-by-day meal grid for a camping trip. Set number of days, assign breakfast/lunch/dinner per day, note who's cooking each evening. Generates a combined shopping list from all meals. Clone and update days/meals for your trip.

**04 — Trail Log**  
Group hike log for a multi-day trip. Each entry: trail name, distance (mi), elevation gain (ft), difficulty (easy/moderate/hard/epic), who hiked it, notes. Sortable by difficulty or date. Clone and start fresh for your trip.

**05 — Camping Story Time**  
Choose-your-own-adventure camping story with illustrated scenes. Branching narrative paths with CSS-illustrated or described images. Designed to be read aloud around a campfire. At least 3 branching decision points, at least 4 different endings. One ending involves a bear being right there.

---

## Park Finder Data Pipeline

### `scripts/seed-parks.js`

Node.js script. Does **not** ship in the deployed app.

1. Reads `NPS_API_KEY` from env (`.env` or shell)
2. Fetches parks from `https://developer.nps.gov/api/v1/parks?limit=500` 
3. Filters to the ~63 `designation: "National Park"` entries
4. Normalizes to: `{ id, name, designation, states, description, activities[], images[], entranceFees[] }`
5. Writes `scripts/parks-data.json`

The Park Finder app's **prompt** includes the full `parks-data.json` inline. On first load, the app bulk-puts all parks into Fireproof. Subsequent queries are fully local — no network, no key.

### No API key in deployed app

The NPS API key lives only in the seed script. Once `parks-data.json` is generated and baked into the app prompt, the deployed app is self-contained.

---

## Fork Prompts

Each app's `fork` field in the frontmatter suggests a remix angle:

- **Park Finder:** "Only hike in the Southwest? Clone it and filter the default view to AZ/NM/UT/CO parks."
- **Packing List:** "Going on a canoe trip instead of backpacking? Clone it and swap the gear categories."
- **Meal Planner:** "Doing a 10-day trip instead of 3? Clone it and update the day count and meal ideas."
- **Trail Log:** "Running a club with year-round logs instead of one trip? Clone it and remove the trip-scoped date filter."
- **Story Time:** "Want to make it about a different outdoor adventure — river rafting, a ski trip? Clone it and rewrite the opening scene."

---

## Files To Create / Modify

| File | Action |
|---|---|
| `src/pages/camping.hbs` | Create — main page |
| `scripts/seed-parks.js` | Create — NPS data seeder |
| `scripts/parks-data.json` | Create (generated by seed script) |
| `src/pages/index.hbs` | Update — add camping card |
| `src/pages/about.hbs` | Update — add camping entry |
| `screenshot-pages.js` | Update — add `camping` slug |

---

## Workflow

1. Enter worktree
2. Run seed script to generate `parks-data.json`
3. Generate 5 apps via `npx vibes-diy@latest generate --user-slug=og`
4. Verify all apps have real `fsId` (not `pending`)
5. Build `src/pages/camping.hbs` with WPA skin
6. Run `pnpm check`, open `_site/camping.html`
7. Capture OG screenshot → `images/screenshots/camping.jpg`
8. Update index.hbs and about.hbs
9. Commit, push, open PR
10. **Merge PR before activating any Meta ads for this page**
