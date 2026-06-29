# Camping Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `src/pages/camping.hbs` — a WPA-poster-styled audience page for campers with 5 deployed Vibes apps and a local NPS data seed script.

**Architecture:** Enter a git worktree, run the NPS seed script to generate park fixture data, generate 5 Vibes apps in parallel (Park Finder uses the seeded data embedded in its prompt), build the .hbs page with WPA poster skin, capture OG screenshot, update index/about, write the Fireproof data pattern runbook, commit and open PR. Merge PR before activating any Meta ads.

**Tech Stack:** Handlebars templates, vanilla CSS (inline in .hbs), Node.js CommonJS (seed script), `npx vibes-diy@latest` CLI, Fireproof (in-app local-first storage, seeded from a JS const on first load).

---

## Files

| File | Action |
|---|---|
| `scripts/seed-parks.js` | Create — fetches NPS API → parks-data.json + parks-data-slim.json |
| `scripts/parks-data.json` | Create (generated) — 63 national parks, full fields |
| `scripts/parks-data-slim.json` | Create (generated) — top 40 parks, trimmed for prompt embedding |
| `vibes/camping/_run.sh` | Create — batch generate script for all 5 apps |
| `vibes/camping/_status.log` | Create (generated) — generate job output |
| `src/pages/camping.hbs` | Create — WPA poster skin, 5 apps |
| `images/screenshots/camping.jpg` | Create (captured) — OG social image |
| `screenshot-pages.js` | Modify — add `camping` to SLUGS array |
| `src/pages/index.hbs` | Modify — add camping landing card + CSS |
| `src/pages/about.hbs` | Modify — add camping entry |
| `agents/backend-fireproof-data.md` | Create — Fireproof fixture data pattern runbook |

---

## Task 1: Enter Worktree

**Files:** none (git operation)

- [ ] **Step 1.1: Invoke the worktree skill**

Use `superpowers:using-git-worktrees` to enter an isolated workspace. Branch name: `worktree-camping`.

- [ ] **Step 1.2: Verify branch**

```bash
git branch --show-current
# Expected: worktree-camping
```

---

## Task 2: Write and Run the NPS Seed Script

**Files:**
- Create: `scripts/seed-parks.js`
- Create (generated): `scripts/parks-data.json`, `scripts/parks-data-slim.json`

- [ ] **Step 2.1: Create `scripts/seed-parks.js`**

```js
#!/usr/bin/env node
const { writeFileSync } = require('fs');
const { join } = require('path');
const https = require('https');

const API_KEY = process.env.NPS_API_KEY;
if (!API_KEY) {
  console.error('NPS_API_KEY env var required. Register free at https://www.nps.gov/subjects/developer/get-started.htm');
  process.exit(1);
}

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  const { data } = await get(
    `https://developer.nps.gov/api/v1/parks?limit=500&api_key=${API_KEY}`
  );

  const national = data
    .filter(p => p.designation === 'National Park')
    .map(p => ({
      id: p.parkCode,
      name: p.fullName,
      states: p.states,
      description: p.description.slice(0, 300),
      activities: p.activities.slice(0, 6).map(a => a.name),
      image: (p.images && p.images[0]) ? p.images[0].url : null,
      fee: (p.entranceFees && p.entranceFees[0]) ? p.entranceFees[0].cost : '0.00',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  writeFileSync(join(__dirname, 'parks-data.json'), JSON.stringify(national, null, 2));
  console.log(`Wrote ${national.length} parks to parks-data.json`);

  const slim = national.slice(0, 40).map(p => ({
    id: p.id,
    name: p.name,
    states: p.states,
    description: p.description.slice(0, 150),
    activities: p.activities,
    fee: p.fee,
  }));
  writeFileSync(join(__dirname, 'parks-data-slim.json'), JSON.stringify(slim));
  console.log(`Wrote ${slim.length} parks to parks-data-slim.json`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2.2: Run the script**

Register a free NPS API key at https://www.nps.gov/subjects/developer/get-started.htm (instant, no approval needed), then:

```bash
NPS_API_KEY=<your-key> node scripts/seed-parks.js
# Expected:
# Wrote 63 parks to parks-data.json
# Wrote 40 parks to parks-data-slim.json
```

- [ ] **Step 2.3: Verify output**

```bash
node -e "const d = JSON.parse(require('fs').readFileSync('scripts/parks-data.json')); console.log(d.length, d[0].name)"
# Expected: 63  Acadia National Park
```

- [ ] **Step 2.4: Commit**

```bash
git add scripts/seed-parks.js scripts/parks-data.json scripts/parks-data-slim.json
git commit -m "feat: NPS park data seed script + generated parks-data.json"
```

---

## Task 3: Generate the 5 Vibes Apps

**Files:**
- Create: `vibes/camping/_run.sh`, `vibes/camping/_status.log`

All 5 apps run in parallel via background jobs.

- [ ] **Step 3.1: Login**

```bash
npx vibes-diy@latest login
# Follow browser auth if not already logged in
```

- [ ] **Step 3.2: Build the Park Finder prompt file**

```bash
mkdir -p vibes/camping

# Build prompt by prepending instructions, appending slim park JSON
cat > vibes/camping/park-finder-prompt.txt << 'HEADER'
National park finder. Hard-code this exact array as a JavaScript const PARKS (do not fetch it at runtime — it must be inline in the source):
HEADER

cat scripts/parks-data-slim.json >> vibes/camping/park-finder-prompt.txt

cat >> vibes/camping/park-finder-prompt.txt << 'FOOTER'

On first render, check Fireproof for a "__seeded" record. If absent, bulk-insert all PARKS with db.put(park.id, park), then db.put("__seeded", {v:1}). All filtering queries run against Fireproof — no runtime network calls.

Filter controls: state dropdown (populated from unique states values in PARKS), activity filter chips (Hiking, Camping, Swimming, Rock Climbing, Wildlife Viewing, Fishing — match against each park's activities array), text search input (matches park name).

Each park card: name, state abbreviations badge, photo (<img src={park.image}> with a green rectangle CSS placeholder on error), entrance fee formatted as $N, top 3 activities as small chips. Clicking a card opens vibes.diy (href="#" placeholder is fine).

Design — topographic map skin: background #F5F2EC with a tiled SVG of faint wavy contour lines (stroke rgba(80,60,20,0.05), three lines per 300px tile). Charcoal #2C2C2C text. Bright orange #E85D04 accent for chips, active filters, and hover states. Load JetBrains Mono from Google Fonts for park names and metadata. Clean and cartographic.
FOOTER
```

- [ ] **Step 3.3: Create `vibes/camping/_run.sh`**

```bash
cat > vibes/camping/_run.sh << 'EOF'
#!/bin/bash
LOG=vibes/camping/_status.log
> "$LOG"

gen() {
  local slug="$1"
  local prompt="$2"
  npx vibes-diy@latest generate --user-slug=og --app-slug="$slug" "$prompt" \
    >> "$LOG" 2>&1
  echo "DONE $slug exit=$?" >> "$LOG"
}

# Park Finder — prompt from file (contains embedded JSON)
(npx vibes-diy@latest generate --user-slug=og --app-slug="national-park-search" \
  "$(cat vibes/camping/park-finder-prompt.txt)" >> "$LOG" 2>&1
  echo "DONE national-park-search exit=$?" >> "$LOG") &

# Packing List
gen camp-gear-list "Camping group packing list. Categories: Shelter, Kitchen, Safety, Navigation, Personal. Each item: name, category, claimedBy (null if unclaimed), weight badge (light / medium / heavy). UI: items grouped by category. Each row shows item name, weight badge, and a Claim button — clicking prompts for the claimer's name and saves to Fireproof. Header per category shows count of unclaimed items. Add-item form at bottom: name input, category dropdown, weight dropdown. Persist all data in Fireproof. Simple and offline-first." &

gen camp-meal-plan "Camping meal planner for a trip. User can set number of days (2-7, default 3). Per day: Breakfast, Lunch, Dinner slots. Each slot: meal name and cook (Dinner slot only — who is cooking). UI: card grid, one column per day. Click any meal slot to edit name/cook inline. Below the grid: a shared shopping list textarea (persists in Fireproof). All data persists in Fireproof." &

gen group-trail-log "Group hiking log for a camping trip. Each entry: trailName, date (YYYY-MM-DD), distanceMi (number), elevationFt (number), difficulty (easy / moderate / hard / epic), hikers (comma-separated names), notes. UI: add-hike form at top. Below: list of all hikes, default sorted by date descending, toggle to sort by difficulty. Difficulty color badges: easy=green, moderate=yellow, hard=orange, epic=red. Stats bar at top: total miles, total elevation gain, hike count. Persist in Fireproof." &

gen camping-adventure-story "Choose-your-own-adventure camping story to read aloud at a campfire. Premise: you and your friends arrive at the trailhead as night falls. Three branching decision points, at least four different endings. One ending must involve a bear that is RIGHT THERE — not a far-off bear — a bear that is RIGHT THERE. Story tone: funny, warm, slightly spooky, written to be read aloud with dramatic pauses marked with ellipses. Each scene: title (h2), prose (2-3 paragraphs), 2-3 choice buttons. Terminal ending scenes show a star rating card (1-5 camp stars out of 5) with a Start Over button. Illustrated scenes: pure CSS art per scene (trees, mountains, moon, campfire, tent, bear as needed) — no external images. Design: dark navy #0D1117 background, warm amber #F4A300 for choice buttons and highlights, cream #FFF8E7 body text. Load Cinzel Decorative (Google Fonts) for scene titles, Crimson Text for prose." &

wait
echo "=== All generators finished ===" >> "$LOG"
EOF
chmod +x vibes/camping/_run.sh
```

- [ ] **Step 3.4: Run the generate script**

```bash
bash vibes/camping/_run.sh &
```

Watch progress (each app takes 3–10 minutes):

```bash
tail -F vibes/camping/_status.log
# Stop watching with Ctrl-C once you see "All generators finished"
```

Wait until `=== All generators finished ===` appears in the log.

- [ ] **Step 3.5: Commit run script**

```bash
git add vibes/camping/
git commit -m "feat: camping app generate scripts and status log"
```

---

## Task 4: Verify All 5 App Deploys

**Files:** none

- [ ] **Step 4.1: Check each app's fsId**

```bash
for slug in national-park-search camp-gear-list camp-meal-plan group-trail-log camping-adventure-story; do
  echo -n "$slug: "
  curl -sL "https://${slug}--og.prod-v2.vibesdiy.net/" | grep -oE '"fsId":"[^"]+"'
done
```

Each must output `"fsId":"z..."` (a CID starting with `z`, ~50 chars). `"fsId":"pending"` means the deploy is stuck.

- [ ] **Step 4.2: Re-generate any stuck apps**

If any show `"fsId":"pending"`, re-generate with a fresh slug (the same slug can get stuck — don't retry the same slug):

```bash
# Example: if national-park-search is stuck:
npx vibes-diy@latest generate --user-slug=og --app-slug="nps-park-finder" \
  "$(cat vibes/camping/park-finder-prompt.txt)"
# Then update slug in camping.hbs frontmatter in Task 5
```

---

## Task 5: Build camping.hbs

**Files:**
- Create: `src/pages/camping.hbs`

- [ ] **Step 5.1: Create `src/pages/camping.hbs`**

Note: if any slugs changed during re-generation in Task 4, update the corresponding `"slug"` values in the frontmatter below.

```handlebars
{{!--
{
  "layout": "webring",
  "title": "For Campers | Vibes DIY",
  "description": "Park finder, packing list, meal planner, trail log, and a campfire storytime. Five tools for your next camping trip — all yours to customize.",
  "ogUrl": "https://good.vibes.diy/camping/",
  "source": "camping",
  "apps": [
    {
      "num": "01",
      "slug": "national-park-search",
      "author": "og",
      "live": true,
      "title": "Park Finder",
      "tagline": "63 parks. Which one's yours?",
      "desc": "Browse and filter all 63 major US national parks by state, activity, and name. Each card shows the park photo, entrance fee, and top activities. Data lives in Fireproof — no internet required after first load.",
      "fork": "Only hiking in the Southwest? Clone it and set the default state filter to AZ, UT, NM, or CO."
    },
    {
      "num": "02",
      "slug": "camp-gear-list",
      "author": "og",
      "live": true,
      "title": "Packing List",
      "tagline": "Who's got the bear canister?",
      "desc": "Group gear checklist organized by category — Shelter, Kitchen, Safety, Navigation, Personal. Each item shows who's bringing it and what's still unclaimed.",
      "fork": "Going on a canoe trip instead of backpacking? Clone it and swap the gear categories to match your kit."
    },
    {
      "num": "03",
      "slug": "camp-meal-plan",
      "author": "og",
      "live": true,
      "title": "Meal Planner",
      "tagline": "Day 3 dinner: somebody's problem.",
      "desc": "Day-by-day meal grid for 2–7 days. Set each meal, note who's cooking dinner, and build a shared shopping list. No surprises at the trailhead.",
      "fork": "Doing a 10-day trip? Clone it and extend the day count. Add dietary notes per slot."
    },
    {
      "num": "04",
      "slug": "group-trail-log",
      "author": "og",
      "live": true,
      "title": "Trail Log",
      "tagline": "We did that. Barely.",
      "desc": "Group hiking log for a multi-day trip. Each entry: trail name, date, distance, elevation gain, difficulty, who hiked it, notes. Trip totals at the top.",
      "fork": "Running a hiking club with year-round logs? Clone it and remove the trip-date filter — keep every hike ever."
    },
    {
      "num": "05",
      "slug": "camping-adventure-story",
      "author": "og",
      "live": true,
      "title": "Story Time",
      "tagline": "Chapter 2: the bear was right there.",
      "desc": "Choose-your-own-adventure camping story to read aloud at the campfire. Three branching decision points, four different endings, pure CSS illustrated scenes. One ending involves a bear that is RIGHT THERE.",
      "fork": "Want a river rafting adventure instead? Clone it and rewrite the opening scene — the branching structure is already built."
    }
  ],
  "ogImage": "https://good.vibes.diy/images/screenshots/camping.jpg"
}
--}}

<style>
  @import url("https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@400;600;700&family=Inter:wght@400;500;600;700&display=optional");

  :root {
    --parchment: #F4EDD0;
    --parchment-soft: #EDE3BD;
    --forest: #1E3D1A;
    --gold: #C4A03A;
    --gold-soft: rgba(196,160,58,0.15);
    --terra: #9E3B1C;
    --smoke: #7B7460;
    --border: rgba(30,61,26,0.15);
  }

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    background: var(--parchment);
    color: var(--forest);
    font-family: "Inter", system-ui, sans-serif;
    line-height: 1.55;
    min-height: 100vh;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Cpath d='M0 60 Q75 45 150 60 T300 60' fill='none' stroke='%231E3D1A' stroke-opacity='0.04' stroke-width='1.5'/%3E%3Cpath d='M0 110 Q75 95 150 110 T300 110' fill='none' stroke='%231E3D1A' stroke-opacity='0.04' stroke-width='1.5'/%3E%3Cpath d='M0 160 Q75 145 150 160 T300 160' fill='none' stroke='%231E3D1A' stroke-opacity='0.04' stroke-width='1.5'/%3E%3Cpath d='M0 210 Q75 195 150 210 T300 210' fill='none' stroke='%231E3D1A' stroke-opacity='0.04' stroke-width='1.5'/%3E%3Cpath d='M0 260 Q75 245 150 260 T300 260' fill='none' stroke='%231E3D1A' stroke-opacity='0.04' stroke-width='1.5'/%3E%3C/svg%3E");
  }

  a { color: inherit; text-decoration: none; }
  .layout { max-width: 1060px; margin: 0 auto; padding: 0 1.5rem; }

  .banner {
    height: 7px;
    background: repeating-linear-gradient(90deg,
      var(--forest) 0px,  var(--forest) 24px,
      var(--gold)   24px, var(--gold)   48px,
      var(--terra)  48px, var(--terra)  72px);
  }

  .topbar {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1.25rem 0; border-bottom: 3px solid var(--forest);
  }
  .topbar .brand { font-family: "Zilla Slab", serif; font-weight: 700; font-size: 1.1rem; letter-spacing: 0.04em; }
  .topbar .meta  { font-size: 0.68rem; letter-spacing: 0.1em; color: var(--smoke); font-weight: 600; text-transform: uppercase; }

  .crumb { padding: 0.5rem 0; font-size: 0.68rem; color: var(--smoke); border-bottom: 1px solid var(--border); }
  .crumb a:hover { color: var(--terra); }

  .hero { padding: 4rem 0 3.5rem; border-bottom: 3px solid var(--forest); }
  .hero .label {
    font-size: 0.65rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
    background: var(--gold); color: var(--forest); padding: 5px 14px;
    display: inline-block; margin-bottom: 1.5rem; border: 2px solid var(--forest);
  }
  .hero h1 {
    font-family: "Zilla Slab", serif;
    font-size: clamp(2.8rem, 7vw, 5.5rem);
    font-weight: 700; line-height: 0.95; letter-spacing: -0.01em;
    margin-bottom: 1.5rem; text-transform: uppercase;
  }
  .hero h1 .accent { color: var(--terra); }
  .hero p.lead { font-size: 1.1rem; max-width: 640px; line-height: 1.7; color: var(--smoke); }

  .stats {
    display: grid; grid-template-columns: repeat(4, 1fr);
    border: 3px solid var(--forest); margin: 2rem 0; background: var(--parchment-soft);
  }
  @media (max-width: 700px) { .stats { grid-template-columns: repeat(2, 1fr); } }
  .stat-cell { padding: 1.25rem 1.5rem; border-right: 2px solid var(--forest); }
  .stat-cell:last-child { border-right: none; }
  .stat-cell .k { font-size: 0.55rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--smoke); font-weight: 700; margin-bottom: 0.4rem; }
  .stat-cell .v { font-family: "Zilla Slab", serif; font-weight: 700; font-size: 1.35rem; }

  .section-label {
    padding: 1.5rem 0 0.75rem;
    font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--smoke); font-weight: 700; border-bottom: 1px dashed var(--border); margin-bottom: 1.5rem;
  }

  .apps { display: flex; flex-direction: column; border: 3px solid var(--forest); background: #FEFBF0; }
  .app {
    padding: 2rem 1.75rem; border-bottom: 2px solid var(--forest);
    display: grid; grid-template-columns: 80px 1fr 300px;
    gap: 2rem; align-items: start; transition: background 0.12s;
  }
  .app:last-child { border-bottom: none; }
  @media (max-width: 800px) { .app { grid-template-columns: 1fr; gap: 1rem; } }
  .app:hover { background: var(--gold-soft); }

  .app .num-cell { display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start; }
  .app .badge {
    font-size: 0.52rem; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700;
    padding: 4px 10px; background: var(--gold); color: var(--forest); border: 2px solid var(--forest);
  }
  .app--live .badge { background: var(--terra); color: var(--parchment); border-color: var(--terra); }
  .app .num { font-family: "Zilla Slab", serif; font-weight: 700; font-size: 2.4rem; line-height: 0.9; color: rgba(30,61,26,0.12); }
  .app--live .num { color: var(--terra); }

  .app .body { display: flex; flex-direction: column; gap: 0.6rem; }
  .app .body .title { font-family: "Zilla Slab", serif; font-size: 1.85rem; font-weight: 700; line-height: 1.05; text-transform: uppercase; }
  .app .body .tagline { font-size: 0.88rem; line-height: 1.5; color: var(--terra); font-weight: 600; font-style: italic; }
  .app .body .desc { font-size: 0.95rem; line-height: 1.65; color: var(--smoke); }
  .app .body .fork { font-size: 0.8rem; line-height: 1.5; color: var(--smoke); border-left: 3px solid var(--gold); padding-left: 0.75rem; margin-top: 0.25rem; }

  .app .right { display: flex; flex-direction: column; gap: 0.6rem; }
  .app .shot { display: block; aspect-ratio: 16/9; overflow: hidden; border: 2px solid var(--forest); background: var(--parchment-soft); }
  .app .shot img { width: 100%; height: 100%; object-fit: cover; }
  .app .ctas { display: grid; grid-template-columns: repeat(3, 1fr); border: 2px solid var(--forest); overflow: hidden; }
  .btn {
    text-align: center; padding: 0.6rem 0.5rem; background: transparent; border-right: 1px solid var(--border);
    font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--forest); transition: background 0.1s, color 0.1s; cursor: pointer;
  }
  .btn:last-child { border-right: none; }
  .btn:hover { background: var(--terra); color: var(--parchment); }

  .cta-block {
    margin: 3rem 0; background: var(--forest); color: var(--parchment);
    padding: 3rem; border: 3px solid var(--forest);
  }
  .cta-block h2 { font-family: "Zilla Slab", serif; font-size: 2rem; font-weight: 700; text-transform: uppercase; margin-bottom: 0.75rem; }
  .cta-block p { max-width: 520px; line-height: 1.65; opacity: 0.8; margin-bottom: 1.5rem; }
  .cta-btn {
    display: inline-block; background: var(--gold); color: var(--forest);
    padding: 0.75rem 2rem; font-weight: 700; font-size: 0.8rem; letter-spacing: 0.12em; text-transform: uppercase;
    border: 2px solid var(--gold); transition: background 0.12s;
  }
  .cta-btn:hover { background: var(--terra); color: var(--parchment); border-color: var(--terra); }

  footer {
    border-top: 3px solid var(--forest); padding: 2rem 0;
    font-size: 0.72rem; color: var(--smoke);
    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;
  }
  footer a:hover { color: var(--terra); }
</style>

<div class="banner"></div>

<div class="layout">
  <nav class="topbar">
    <a href="https://links.vibes.diy/homepage" class="brand">Vibes DIY</a>
    <span class="meta">Field Tools for Campers</span>
  </nav>

  <div class="crumb">
    <a href="{{assetPrefix}}index.html">Home</a> &rsaquo; Camping
  </div>

  <section class="hero">
    <span class="label">Camping Tools</span>
    <h1>Built for<br><span class="accent">the trail.</span></h1>
    <p class="lead">Five tools for planning and living a camping trip — park finder, gear list, meal planner, trail log, and a campfire storytime. All yours to customize.</p>
    <div class="stats">
      <div class="stat-cell"><div class="k">Apps</div><div class="v">5</div></div>
      <div class="stat-cell"><div class="k">Login</div><div class="v">Free</div></div>
      <div class="stat-cell"><div class="k">Parks</div><div class="v">63</div></div>
      <div class="stat-cell"><div class="k">Works</div><div class="v">Offline</div></div>
    </div>
  </section>

  <div class="section-label">Tools — Click to open, clone, or remix</div>

  <div class="apps">
    {{#each apps}}
    <div class="app {{#if live}}app--live{{/if}}">
      <div class="num-cell">
        <span class="badge">TOOL {{num}}</span>
        <span class="num">{{num}}</span>
      </div>
      <div class="body">
        <h2 class="title">{{title}}</h2>
        <p class="tagline">{{tagline}}</p>
        <p class="desc">{{desc}}</p>
        {{#if fork}}<p class="fork">{{fork}}</p>{{/if}}
      </div>
      <div class="right">
        <a class="shot" href="https://vibes.diy/vibe/{{author}}/{{slug}}" target="_blank" rel="noopener">
          <img
            src="https://{{slug}}--{{author}}.prod-v2.vibesdiy.net/screenshot.jpg"
            onerror="this.onerror=null; this.src='{{@root.assetPrefix}}images/og-preview.png';"
            alt="{{title}}" />
        </a>
        <div class="ctas">
          <a class="btn" href="https://vibes.diy/vibe/{{author}}/{{slug}}" target="_blank" rel="noopener">Open</a>
          <a class="btn" href="https://vibes.diy/clone/{{author}}/{{slug}}" target="_blank" rel="noopener">Clone</a>
          <a class="btn" href="https://vibes.diy/remix/{{author}}/{{slug}}" target="_blank" rel="noopener">Remix</a>
        </div>
      </div>
    </div>
    {{/each}}
  </div>

  <div class="cta-block">
    <h2>Make it yours.</h2>
    <p>Every tool on this page is an open app — clone any of them and customize for your trip, your group, your trail. No lock-in.</p>
    <a href="https://links.vibes.diy/homepage" class="cta-btn">Start Building &rarr;</a>
  </div>

  <footer>
    <span>&copy; 2025 Vibes DIY &mdash; <a href="https://links.vibes.diy/homepage">vibes.diy</a></span>
    <span>
      <a href="https://links.vibes.diy/discord">Discord</a> &middot;
      <a href="https://links.vibes.diy/YouTube">YouTube</a> &middot;
      <a href="https://links.vibes.diy/Bluesky">Bluesky</a>
    </span>
  </footer>
</div>
```

- [ ] **Step 5.2: Run pnpm check**

```bash
pnpm check
# Expected: Build succeeds — "Built N pages to _site/"
# Fix any Handlebars syntax errors before continuing
```

- [ ] **Step 5.3: Open the built page**

```bash
open _site/camping.html
```

Verify: WPA poster aesthetic renders (parchment background, Zilla Slab headings, forest/gold/terra palette, faint topo contour lines), 5 app rows visible, banner stripe at top. Screenshots may show the fallback image — that's fine.

- [ ] **Step 5.4: Commit**

```bash
git add src/pages/camping.hbs
git commit -m "feat: camping.hbs — WPA poster skin, 5 apps"
```

---

## Task 6: Capture OG Screenshot

**Files:**
- Modify: `screenshot-pages.js`
- Create: `images/screenshots/camping.jpg`

- [ ] **Step 6.1: Add camping to screenshot-pages.js**

Open `screenshot-pages.js`. Find the `SLUGS` array and append `'camping'`:

```js
// In the SLUGS array, add:
'camping',
```

- [ ] **Step 6.2: Capture**

```bash
pnpm check
node screenshot-pages.js
```

- [ ] **Step 6.3: Verify**

```bash
ls -lh images/screenshots/camping.jpg
# Expected: exists, size > 20K
# A tiny file (<5K) means a blank/error capture — re-run screenshot-pages.js
```

- [ ] **Step 6.4: Commit**

```bash
git add screenshot-pages.js images/screenshots/camping.jpg
git commit -m "feat: camping OG screenshot"
```

---

## Task 7: Update index.hbs and about.hbs

**Files:**
- Modify: `src/pages/index.hbs`
- Modify: `src/pages/about.hbs`

- [ ] **Step 7.1: Add camping CSS to index.hbs**

Open `src/pages/index.hbs`. Find the block of `.landing-card.*` CSS rules (around line 285). Add after the last `.landing-card.*` rule in that block:

```css
        .landing-card.camping     { border-color: #1E3D1A; }
        .landing-card.camping:hover { background: linear-gradient(135deg, #fff 0%, #f0f5ee 100%); }
```

- [ ] **Step 7.2: Add camping card to index.hbs**

In the same file, find the `<a href="summer-camp.html"` card (around line 761). Add the camping card immediately before or after it (both are outdoors-adjacent):

```handlebars
            <a href="camping.html" class="landing-card camping">
                <div class="card-icon">🏕️</div>
                <h2 class="card-title">For Campers</h2>
                <p class="card-description">Park finder, packing list, meal planner, trail log, and a campfire storytime. Five tools for your next trip.</p>
                <span class="card-cta">Hit the Trail →</span>
            </a>
```

- [ ] **Step 7.3: Add camping to about.hbs**

Open `src/pages/about.hbs`. Find where other audience pages are listed (look for `summer-camp` or `block-party`). Add a camping entry following the exact same pattern as the surrounding entries.

- [ ] **Step 7.4: Verify**

```bash
pnpm check
open _site/index.html
# Verify camping card appears in the grid with forest-green border on hover
```

- [ ] **Step 7.5: Commit**

```bash
git add src/pages/index.hbs src/pages/about.hbs
git commit -m "feat: add camping to index.hbs and about.hbs"
```

---

## Task 8: Write agents/backend-fireproof-data.md

**Files:**
- Create: `agents/backend-fireproof-data.md`

- [ ] **Step 8.1: Create the runbook**

Write `agents/backend-fireproof-data.md` with this exact content:

```markdown
# Backend Fireproof Data — Pattern Runbook

Use this pattern when a Vibes app needs a substantial read-only dataset without shipping an API key in the deployed app.

## When to Use

- Data comes from an external API that requires a key
- Dataset is too large to type by hand but small enough to embed in a prompt after trimming (~10–15KB max)
- Users need offline access after first load
- Data changes infrequently (update by re-seeding + re-generating the app)

## Pattern

### 1. Local seed script (never deployed)

- Reads API key from env var only — never hard-code it
- Fetches from the external API, normalizes to a lean schema (only fields the app needs)
- Writes two files:
  - `scripts/<name>-data.json` — full dataset for reference
  - `scripts/<name>-data-slim.json` — top N records, trimmed fields, target under 15KB

### 2. Build the Vibes app prompt

Embed the slim JSON into the app prompt:

```bash
cat > vibes/<cluster>/app-prompt.txt << 'HEADER'
<App description>. Hard-code this exact array as a JavaScript const DATA:
HEADER
cat scripts/<name>-data-slim.json >> vibes/<cluster>/app-prompt.txt
cat >> vibes/<cluster>/app-prompt.txt << 'FOOTER'
<Rest of prompt: Fireproof seeding instructions, UI, design skin>
FOOTER
```

Then generate:
```bash
npx vibes-diy@latest generate --user-slug=og --app-slug="<slug>" \
  "$(cat vibes/<cluster>/app-prompt.txt)"
```

### 3. Fireproof seeding in the app

Tell the app in the prompt:

> On first render, check Fireproof for a "__seeded" record. If absent, bulk-insert all DATA records with `db.put(item.id, item)`, then `db.put("__seeded", {v:1})`. All queries run against Fireproof — no runtime network calls.

### 4. Verification

After generate + deploy, confirm the app is real (not a stub):

```bash
curl -sL https://<slug>--og.prod-v2.vibesdiy.net/ | grep -oE '"fsId":"[^"]+"'
# Must show "fsId":"z<CID>" — not "pending"
```

Then open the app and verify data loads (filter/search works with real records).

## Prompt Size Limits

The vibes-diy CLI handles long prompts but performance can degrade above ~20KB total.
Keep the embedded JSON under 15KB by:
- Limiting to top 40 records in the slim file
- Truncating descriptions to 150 chars
- Dropping redundant or unused fields

## Example: NPS Park Finder

- **Seed script:** `scripts/seed-parks.js` — fetches from `developer.nps.gov/api/v1/parks`
- **Full output:** `scripts/parks-data.json` (63 parks, ~80KB)
- **Slim output:** `scripts/parks-data-slim.json` (40 parks, ~12KB)
- **App:** `national-park-search` — park finder, topo map skin, filters by state and activity
- **API key in app?** No — key only in `NPS_API_KEY` env var for the seed script
```

- [ ] **Step 8.2: Commit**

```bash
git add agents/backend-fireproof-data.md
git commit -m "docs: backend-fireproof-data pattern runbook — seed script to Fireproof const load"
```

---

## Task 9: Open Pull Request

**Files:** none (git + GitHub)

- [ ] **Step 9.1: Final build check**

```bash
pnpm check
# Must pass with no errors
```

- [ ] **Step 9.2: Push branch**

```bash
git push -u origin worktree-camping
```

- [ ] **Step 9.3: Open PR**

```bash
gh pr create \
  --title "feat: camping audience page — WPA poster, 5 apps, NPS park finder" \
  --body "$(cat <<'EOF'
## Summary

- New audience page `camping.hbs` — WPA vintage national park poster aesthetic (Zilla Slab, parchment/forest/gold/terra palette, faint topo contour line background)
- 5 deployed Vibes apps: Park Finder (topo map skin, Fireproof-backed NPS data), Packing List, Meal Planner, Trail Log, Choose-Your-Own-Adventure Story Time
- `scripts/seed-parks.js` — fetches 63 NPS national parks, writes slim JSON for embedding in app prompts; API key stays local, never ships in deployed app
- `agents/backend-fireproof-data.md` — new runbook for the seed-script → Fireproof const pattern
- OG screenshot committed; index.hbs and about.hbs updated

## Test plan

- [ ] `pnpm check` passes with no errors
- [ ] `open _site/camping.html` — WPA skin renders, all 5 apps show screenshots (or fallback)
- [ ] All 5 app slugs return real fsId (not "pending") via curl check
- [ ] `open _site/index.html` — camping card visible with forest-green border on hover
- [ ] `images/screenshots/camping.jpg` exists and is > 20KB

**Do not activate Meta ads until this PR is merged.**

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 9.4: Share the PR URL**

Print and share the PR URL from the output above.

---

## Self-Review

**Spec coverage:** All files from the spec are covered. All 5 apps have tasks (generate + verify). PR policy (merge before ads) is documented in the PR body and in memory. ✓

**Placeholder scan:** No TBDs. The `about.hbs` step (7.3) says "find where other pages are listed" — this is intentionally loose because the about.hbs structure varies and the executing agent must read the file first. ✓

**Type consistency:** `assetPrefix` used directly in breadcrumb (outside loop), `@root.assetPrefix` used inside `{{#each apps}}` loop — consistent with block-party.hbs pattern. ✓

**Seed script:** Uses CommonJS (`require`) — correct, since `package.json` has no `"type": "module"`. ✓
