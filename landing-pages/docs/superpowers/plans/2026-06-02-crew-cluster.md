# Crew Cluster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 3-page "crew" cluster (`crew/chaos`, `crew/the-list`, `crew/the-bit`) that pitches Vibes as malleable software for friend groups — "apps you can change, together" — with a shared new visual design system and 4-5 embedded apps per page.

**Architecture:** Three `.hbs` pages under `src/pages/crew/` using `layout: "webring"`. All share one visual design system — a broadside/handbill aesthetic with thick type, raw edges, and rowdy energy. Each page has a distinct accent color but the same structure: nav, hero provocation, tagline pair, 4-5 app cards with screenshots, a "change anything" manifesto section, newsletter, footer. Apps are a mix of existing deployed apps and new ones generated via the CLI.

**Tech Stack:** Handlebars templates, CSS custom properties, `vibes-diy` CLI for app generation, `pnpm check` build pipeline.

**Design System — "Broadside":**
- **Font:** `Inter` (body/UI) + `Space Mono` (labels/mono) — no serif, no elegance, just weight
- **Background:** Near-white `#f4f1ec` with a subtle noise texture via CSS (repeating-conic-gradient grain)
- **Ink:** `#111` — true black for borders, type, heavy rules
- **Accent per page:** Chaos = `#ff4d00` (siren orange), The List = `#2563eb` (marker blue), The Bit = `#a855f7` (weird purple)
- **Cards:** No border-radius. 3px solid black border. 6px 6px 0 black offset shadow. Raw, chunky.
- **Hero type:** `clamp(3rem, 9vw, 7rem)`, weight 900, letter-spacing -0.04em, line-height 0.92
- **Highlight treatment:** Accent-colored background on inline `<span>`, slight rotation (-1.5deg), like tape on a flyer
- **App cards:** 2-column grid, each card has screenshot, title, one-line tagline, and Open/Clone/Remix buttons
- **Section dividers:** 4px solid black rule, full width
- **Buttons:** Black background, accent text, mono font, uppercase, chunky padding, offset shadow

---

### Task 1: Generate apps for `crew/chaos`

**Files:**
- Create: `vibes/crew-chaos/_run.sh`

Reuse 2 existing apps. Generate 2 new ones.

**Existing apps to reuse:**
- `pub-trivia-night` by `jchris` (from trivia-night page — house-rules scoring)
- `wyr-party-mode` by `og` (from would-you-rather — party voting chaos)

**New apps to generate:**
- `house-rules-scoreboard` — "Scoreboard for any game. Anyone can change the rules mid-game. Add a bonus round. Change the point values. The app keeps up."
- `cookout-playlist-queue` — "Shared playlist queue for a cookout. Anyone adds songs. Anyone can bump. Anyone can veto. The host sees who added what."

- [ ] **Step 1: Create the batch generation script**

```bash
#!/usr/bin/env bash
set -euo pipefail

gen() {
  local slug="$1"; shift
  npx vibes-diy@latest generate --user-slug=og --app-slug="$slug" "$@" &
  echo "STARTED $slug pid=$!" >> _status.log
  wait $!
  echo "DONE $slug exit=$?" >> _status.log
}

> _status.log

gen house-rules-scoreboard \
  "Scoreboard for any game your crew plays. Anyone in the room can change the rules mid-game — add a bonus round, change point values, rename teams. Real-time sync so everyone sees the score update instantly. Big bold numbers. Team colors. A history of rule changes so you can argue about them later."

gen cookout-playlist-queue \
  "Shared playlist queue for a cookout or party. Anyone adds songs by title. Anyone can bump a song up or veto it. The host has a now-playing view. Shows who added what. No login, just a shared link."
```

- [ ] **Step 2: Run the generation script**

```bash
cd vibes/crew-chaos && chmod +x _run.sh && ./_run.sh
```

Monitor `_status.log` for completions. Poll at 45-second intervals.

- [ ] **Step 3: Verify deploys are real**

```bash
curl -sL https://house-rules-scoreboard--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://cookout-playlist-queue--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
```

Expected: `fsId:"z<CID>"` and `mountVibe([V1], …)` — not `fsId:"pending"`.

If stuck, pick a fresh slug and redeploy.

- [ ] **Step 4: Verify existing apps still live**

```bash
curl -sL https://pub-trivia-night--jchris.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://wyr-party-mode--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
```

- [ ] **Step 5: Commit generation artifacts**

```bash
git add vibes/crew-chaos/
git commit -m "feat: generate apps for crew/chaos page"
```

---

### Task 2: Generate apps for `crew/the-list`

**Files:**
- Create: `vibes/crew-the-list/_run.sh`

Reuse 1 existing app. Generate 3 new ones.

**Existing app to reuse:**
- `potluck-dish-signup` by `og` (from block-party — who's bringing what)

**New apps to generate:**
- `shared-grocery-run` — "Shared grocery list for roommates. Anyone adds items. Claim what you're picking up. Check off what you got. Running total of who spent what."
- `chore-rotation-board` — "Chore chart for a house. Rotating assignments every week. Anyone can swap shifts. Tracks who's behind. No guilt trips, just a board."
- `group-expense-split` — "Split expenses across a group. Add what you paid for. See who owes who. Settle up with a tap. No app to download."

- [ ] **Step 1: Create the batch generation script**

```bash
#!/usr/bin/env bash
set -euo pipefail

gen() {
  local slug="$1"; shift
  npx vibes-diy@latest generate --user-slug=og --app-slug="$slug" "$@" &
  echo "STARTED $slug pid=$!" >> _status.log
  wait $!
  echo "DONE $slug exit=$?" >> _status.log
}

> _status.log

gen shared-grocery-run \
  "Shared grocery list for a house or friend group. Anyone adds items with quantity. Claim items you're picking up so there's no duplication. Check off what you got. Running total per person of what they spent. Shared link, no login."

gen chore-rotation-board \
  "Chore rotation board for roommates or a family. Weekly rotating assignments. Anyone can propose a swap. Tracks completion streaks. Simple — just names, chores, and checkboxes. No gamification, no rewards, just accountability."

gen group-expense-split \
  "Group expense tracker for trips, dinners, shared living. Anyone adds an expense with who it was for. Calculates who owes who. Settlement suggestions. Running balance per person."
```

- [ ] **Step 2: Run the generation script**

```bash
cd vibes/crew-the-list && chmod +x _run.sh && ./_run.sh
```

Monitor `_status.log`. Poll at 45-second intervals.

- [ ] **Step 3: Verify deploys**

```bash
curl -sL https://shared-grocery-run--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://chore-rotation-board--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://group-expense-split--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
```

- [ ] **Step 4: Verify existing app**

```bash
curl -sL https://potluck-dish-signup--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
```

- [ ] **Step 5: Commit**

```bash
git add vibes/crew-the-list/
git commit -m "feat: generate apps for crew/the-list page"
```

---

### Task 3: Generate apps for `crew/the-bit`

**Files:**
- Create: `vibes/crew-the-bit/_run.sh`

All new — "the bit" apps are too weird to exist yet.

**New apps to generate:**
- `bad-movie-draft` — "Draft board for bad movie night. Each person claims a movie. Rate it after watching. Season standings. Crown the champion of terrible taste."
- `dinner-picker-tournament` — "Bracket tournament for where to eat. Add restaurants. Head-to-head matchups. Everyone votes. Single elimination. The winner feeds everyone."
- `superlatives-tracker` — "Superlatives for your friend group. Categories rotate weekly. Most likely to forget their keys. Best parking job. Worst take of the week. Everyone nominates, everyone votes."
- `bit-commitment-log` — "Log of group bits and running jokes. Add a bit. Track when it was last deployed. Rate the execution. Hall of fame for retired bits."

- [ ] **Step 1: Create the batch generation script**

```bash
#!/usr/bin/env bash
set -euo pipefail

gen() {
  local slug="$1"; shift
  npx vibes-diy@latest generate --user-slug=og --app-slug="$slug" "$@" &
  echo "STARTED $slug pid=$!" >> _status.log
  wait $!
  echo "DONE $slug exit=$?" >> _status.log
}

> _status.log

gen bad-movie-draft \
  "Draft board for bad movie night. Each person in the group claims a movie for the next session. After watching, everyone rates it 1-5 on how bad-good it was. Season standings track who picks the best worst movies. Crown a champion each season."

gen dinner-picker-tournament \
  "Bracket tournament to decide where to eat. Everyone adds restaurant options. Random seeding into a single-elimination bracket. Head-to-head matchups — everyone votes. Winner advances. Final winner is where you're eating tonight."

gen superlatives-tracker \
  "Weekly superlatives for a friend group. Rotating categories each week — most likely to fall asleep first, best parking job, worst take, best snack choice. Everyone nominates, everyone votes. Running hall of fame across weeks."

gen bit-commitment-log \
  "A log of your friend group's running bits and inside jokes. Add a bit with a name and origin story. Track the last time someone deployed it. Rate each execution. Hall of fame for retired bits that had a good run."
```

- [ ] **Step 2: Run the generation script**

```bash
cd vibes/crew-the-bit && chmod +x _run.sh && ./_run.sh
```

Monitor `_status.log`. Poll at 45-second intervals.

- [ ] **Step 3: Verify deploys**

```bash
curl -sL https://bad-movie-draft--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://dinner-picker-tournament--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://superlatives-tracker--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://bit-commitment-log--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
```

- [ ] **Step 4: Commit**

```bash
git add vibes/crew-the-bit/
git commit -m "feat: generate apps for crew/the-bit page"
```

---

### Task 4: Build shared CSS partial for the Broadside design system

**Files:**
- This CSS will be inlined in each page's `<style>` block (webring layout has no shared CSS mechanism). Write it once in the first page template; the other two pages will duplicate the shared base and override the accent color.

The shared base CSS is documented here for reference. Each page template (Tasks 5-7) includes this verbatim in its `<style>` block with only `--accent` changed.

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=optional");

:root {
  --bg: #f4f1ec;
  --ink: #111;
  --accent: /* per-page */;
  --accent-soft: /* per-page, 15% opacity version */;
  --card-bg: #fff;
  --rule: #111;
  --shadow: 6px 6px 0 var(--ink);
}

*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  background: var(--bg);
  color: var(--ink);
  font-family: "Inter", system-ui, sans-serif;
  line-height: 1.55;
  min-height: 100vh;
  background-image:
    repeating-conic-gradient(rgba(0,0,0,0.03) 0% 25%, transparent 0% 50%) 0 0 / 4px 4px;
}

a { color: inherit; text-decoration: none; }
.mono { font-family: "Space Mono", monospace; }

.layout {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* ── Nav ── */
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 4px solid var(--rule);
}
.topbar .brand {
  font-weight: 900;
  font-size: 1.25rem;
  letter-spacing: -0.02em;
}
.topbar .crew-label {
  font-family: "Space Mono", monospace;
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: 3px 10px;
  background: var(--accent);
  color: var(--bg);
  font-weight: 700;
}

/* ── Hero ── */
.hero {
  padding: 4rem 0 3rem;
  border-bottom: 4px solid var(--rule);
}
.hero .provocation {
  font-family: "Space Mono", monospace;
  font-size: 0.65rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  margin-bottom: 1.5rem;
  display: inline-block;
  padding: 4px 12px;
  background: var(--ink);
  color: var(--bg);
}
.hero h1 {
  font-size: clamp(3rem, 9vw, 7rem);
  font-weight: 900;
  line-height: 0.92;
  letter-spacing: -0.04em;
  margin-bottom: 1.5rem;
}
.hero h1 .hi {
  background: var(--accent);
  color: var(--bg);
  padding: 0 0.15em;
  display: inline-block;
  transform: rotate(-1.5deg);
  box-shadow: var(--shadow);
  margin: 0.08em 0;
}
.hero .lead {
  font-size: 1.15rem;
  max-width: 700px;
  line-height: 1.55;
}
.hero .lead strong { font-weight: 800; }

/* ── Tagline pair ── */
.tagline-pair {
  padding: 2rem 0;
  border-bottom: 4px solid var(--rule);
  text-align: center;
}
.tagline-pair blockquote {
  font-size: clamp(1.4rem, 3.5vw, 2.2rem);
  font-weight: 900;
  line-height: 1.2;
  letter-spacing: -0.02em;
  max-width: 700px;
  margin: 0 auto;
}
.tagline-pair blockquote .paren {
  color: var(--accent);
}
.tagline-pair .sub {
  font-family: "Space Mono", monospace;
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-top: 0.75rem;
  opacity: 0.6;
}

/* ── App grid ── */
.apps-label {
  padding: 1.5rem 0 0.75rem;
  font-family: "Space Mono", monospace;
  font-size: 0.6rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  border-bottom: 2px dashed var(--rule);
  margin-bottom: 1.5rem;
}

.apps-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  padding-bottom: 2rem;
  border-bottom: 4px solid var(--rule);
}
@media (max-width: 700px) { .apps-grid { grid-template-columns: 1fr; } }

.app-card {
  background: var(--card-bg);
  border: 3px solid var(--ink);
  box-shadow: var(--shadow);
  padding: 0;
  display: flex;
  flex-direction: column;
}
.app-card .app-shot {
  aspect-ratio: 16/9;
  overflow: hidden;
  border-bottom: 3px solid var(--ink);
  background: var(--bg);
}
.app-card .app-shot img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.app-card .app-info {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}
.app-card .app-title {
  font-size: 1.3rem;
  font-weight: 900;
  letter-spacing: -0.02em;
  line-height: 1.1;
}
.app-card .app-tagline {
  font-family: "Space Mono", monospace;
  font-size: 0.75rem;
  color: #555;
}
.app-card .app-ctas {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 3px solid var(--ink);
  margin-top: auto;
}
.btn-card {
  text-align: center;
  padding: 0.55rem 0.4rem;
  font-family: "Space Mono", monospace;
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  font-weight: 700;
  border-right: 3px solid var(--ink);
  transition: background 0.12s;
}
.btn-card:last-child { border-right: none; }
.btn-card:hover { background: var(--accent); color: var(--bg); }

/* ── Manifesto section ── */
.manifesto {
  padding: 3rem 0;
  border-bottom: 4px solid var(--rule);
}
.manifesto h2 {
  font-family: "Space Mono", monospace;
  font-size: 0.6rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  margin-bottom: 1.25rem;
}
.manifesto .pull {
  font-weight: 900;
  font-size: clamp(1.6rem, 3.5vw, 2.6rem);
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin: 1rem 0;
  max-width: 800px;
}
.manifesto .pull .hi {
  background: var(--accent-soft);
  padding: 0 0.2em;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.manifesto p {
  font-size: 1.05rem;
  max-width: 700px;
  line-height: 1.6;
  margin-bottom: 0.85rem;
}

/* ── CTA ── */
.cta-bar {
  background: var(--ink);
  color: var(--bg);
  padding: 2.5rem 0;
  text-align: center;
}
.cta-bar h2 {
  font-size: clamp(1.4rem, 3vw, 2rem);
  font-weight: 900;
  margin-bottom: 0.5rem;
}
.cta-bar p {
  font-family: "Space Mono", monospace;
  font-size: 0.8rem;
  opacity: 0.6;
  margin-bottom: 1.2rem;
}
.btn-cta {
  display: inline-block;
  padding: 1rem 2.5rem;
  background: var(--accent);
  color: var(--bg);
  font-family: "Space Mono", monospace;
  font-size: 0.85rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  font-weight: 700;
  border: 3px solid var(--accent);
  transition: transform 0.1s, box-shadow 0.1s;
  box-shadow: 4px 4px 0 rgba(255,255,255,0.2);
}
.btn-cta:hover {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 rgba(255,255,255,0.2);
}

/* ── Footer ── */
.crew-footer {
  padding: 1rem 0;
  font-family: "Space Mono", monospace;
  font-size: 0.6rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  display: flex;
  justify-content: space-between;
  border-top: 4px solid var(--rule);
}
.crew-footer a:hover { background: var(--accent-soft); }

/* ── Cluster nav (links between crew pages) ── */
.cluster-nav {
  display: flex;
  gap: 0;
  border-bottom: 4px solid var(--rule);
}
.cluster-nav a {
  flex: 1;
  text-align: center;
  padding: 0.7rem 0.5rem;
  font-family: "Space Mono", monospace;
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  font-weight: 700;
  border-right: 3px solid var(--ink);
  transition: background 0.12s;
}
.cluster-nav a:last-child { border-right: none; }
.cluster-nav a:hover { background: var(--accent-soft); }
.cluster-nav a.active { background: var(--ink); color: var(--bg); }
```

This CSS is not a separate file — it's inlined in each page template. Task 5 includes the full template; Tasks 6-7 duplicate the CSS with only `--accent` and `--accent-soft` changed.

---

### Task 5: Build `crew/chaos.hbs`

**Files:**
- Create: `src/pages/crew/chaos.hbs`

- [ ] **Step 1: Create the crew directory**

```bash
mkdir -p src/pages/crew
```

- [ ] **Step 2: Write the full template**

Create `src/pages/crew/chaos.hbs` with the full Broadside design system CSS (from Task 4), accent `--accent: #ff4d00; --accent-soft: rgba(255, 77, 0, 0.15);`, and these apps in frontmatter:

```json
{
  "layout": "webring",
  "title": "Who Changed the Rules? | Vibes DIY",
  "description": "Game night, cookout, the group trip. Someone always changes something. That's not a bug. Your app should be as rowdy as your crew.",
  "ogUrl": "https://good.vibes.diy/crew/chaos/",
  "source": "crew-chaos",
  "apps": [
    {
      "slug": "house-rules-scoreboard",
      "author": "og",
      "live": true,
      "title": "House Rules Scoreboard",
      "tagline": "Someone just changed the point values. Again."
    },
    {
      "slug": "wyr-party-mode",
      "author": "og",
      "live": true,
      "title": "Party Mode",
      "tagline": "Two choices. Everyone votes. Someone's lying."
    },
    {
      "slug": "cookout-playlist-queue",
      "author": "og",
      "live": true,
      "title": "Playlist Queue",
      "tagline": "Anyone adds songs. Anyone bumps. Anyone vetoes."
    },
    {
      "slug": "pub-trivia-night",
      "author": "jchris",
      "live": true,
      "title": "Pub Trivia",
      "tagline": "The host taps one button. Every phone flips."
    }
  ]
}
```

Page structure (HTML body after frontmatter):

1. **Full `<style>` block** — the complete Broadside CSS from Task 4, with `--accent: #ff4d00; --accent-soft: rgba(255, 77, 0, 0.15);`

2. **Nav** — `.topbar` with `VIBES.DIY` brand link (to `https://links.vibes.diy/homepage`) and `.crew-label` badge saying `CREW // CHAOS`

3. **Cluster nav** — 3 links: `CHAOS` (active), `THE LIST` (`../crew/the-list`), `THE BIT` (`../crew/the-bit`). Use `{{assetPrefix}}` for relative paths: `href="{{assetPrefix}}crew/chaos"` etc.

4. **Hero** — `.provocation` label: "WHO CHANGED THE RULES?" then `<h1>` with highlight spans:
   ```
   Your crew
   <span class="hi">house-rules</span>
   everything.
   Now the app
   keeps up.
   ```
   `.lead` paragraph: "Game night. Cookout. The group trip. Someone always changes something — the scoring, the playlist, the plan. That's not a bug. That's the point. Your app should be as rowdy as your crew."

5. **Tagline pair** — blockquote: `Invite anyone you want to <span class="paren">(change)</span> your app.` then `.sub`: "Your app is the party."

6. **Apps grid** — `.apps-label`: "APPS YOUR CREW ACTUALLY CHANGED" then `.apps-grid` with `{{#each apps}}` loop:
   ```handlebars
   {{#each apps}}
   <article class="app-card">
     <a class="app-shot" href="https://vibes.diy/vibe/{{author}}/{{slug}}">
       <img src="https://{{slug}}--{{author}}.prod-v2.vibesdiy.net/screenshot.jpg"
            alt="{{title}}"
            onerror="this.onerror=null; this.src='{{@root.assetPrefix}}images/og-preview.png';"/>
     </a>
     <div class="app-info">
       <h3 class="app-title">{{title}}</h3>
       <span class="app-tagline">{{tagline}}</span>
     </div>
     <div class="app-ctas">
       <a class="btn-card" href="https://vibes.diy/vibe/{{author}}/{{slug}}">Open</a>
       <a class="btn-card" href="https://vibes.diy/clone/{{author}}/{{slug}}">Clone</a>
       <a class="btn-card" href="https://vibes.diy/remix/{{author}}/{{slug}}">Remix</a>
     </div>
   </article>
   {{/each}}
   ```

7. **Manifesto** — `h2`: "CHANGE ANYTHING" then `.pull`: "Someone added a <span class="hi">bonus round</span>. Someone else fixed the scoring. The app is the table." then `p`: "Every app on this page is live. Every one of them was changed by the people using it. That's how it works — you make a thing, you share the link, and anyone you invite can change it. Not 'request a feature.' Not 'submit a ticket.' Just: change it."

8. **CTA bar** — dark background: `h2`: "Make something rowdy." `p`: "Start from any of these or make your own." `btn-cta` linking to `https://links.vibes.diy/homepage`: "OPEN VIBES DIY"

9. **Newsletter** — `{{> newsletter}}`

10. **Footer** — `.crew-footer`: left side "Vibes.diy · [homepage](https://links.vibes.diy/homepage) · [expressions](/expressions/)", right side "// YOUR APP IS THE PARTY"

- [ ] **Step 3: Build and verify**

```bash
pnpm check
open _site/crew/chaos.html
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/crew/chaos.hbs
git commit -m "feat: add crew/chaos landing page"
```

---

### Task 6: Build `crew/the-list.hbs`

**Files:**
- Create: `src/pages/crew/the-list.hbs`

- [ ] **Step 1: Write the template**

Same structure as `chaos.hbs` but with these changes:

**Accent:** `--accent: #2563eb; --accent-soft: rgba(37, 99, 235, 0.15);`

**Frontmatter:**
```json
{
  "layout": "webring",
  "title": "The Spreadsheet No One Updates | Vibes DIY",
  "description": "Groceries, chores, IOUs, the thing someone made in Google Sheets that died in two weeks. Now everyone can change it because it's actually theirs.",
  "ogUrl": "https://good.vibes.diy/crew/the-list/",
  "source": "crew-the-list",
  "apps": [
    {
      "slug": "shared-grocery-run",
      "author": "og",
      "live": true,
      "title": "Grocery Run",
      "tagline": "Anyone adds. Anyone claims. Running total."
    },
    {
      "slug": "chore-rotation-board",
      "author": "og",
      "live": true,
      "title": "Chore Rotation",
      "tagline": "Rotating weekly. Anyone can swap."
    },
    {
      "slug": "group-expense-split",
      "author": "og",
      "live": true,
      "title": "Expense Split",
      "tagline": "Who paid. Who owes. Settle up."
    },
    {
      "slug": "potluck-dish-signup",
      "author": "og",
      "live": true,
      "title": "Potluck Signup",
      "tagline": "Who's bringing what. No fourth potato salad."
    }
  ]
}
```

**Crew label:** `CREW // THE LIST`

**Cluster nav:** `THE LIST` is active.

**Hero:** `.provocation`: "THE SPREADSHEET NO ONE UPDATES" then `<h1>`:
```
The shared
doc
<span class="hi">died</span>
in two weeks.
This won't.
```
`.lead`: "Groceries, chores, IOUs, the thing someone made in a spreadsheet that everyone ignored. The reason it died is nobody could change it without asking. Now everyone can change it. Because it's actually theirs."

**Tagline pair:** Same as chaos.

**Apps label:** "LISTS THAT ACTUALLY GET USED"

**Manifesto:** `h2`: "EVERYONE EDITS" then `.pull`: "The person who does the <span class="hi">most shopping</span> decides the categories. The person who hates vacuuming negotiates a swap. The list fits the house." then `p`: "Shared docs die because one person owns them. These apps don't have an owner — they have a crew. Anyone with the link can change the structure, not just the data. Add a column. Rename a category. The app fits how you actually live."

**CTA bar:** Same as chaos.

- [ ] **Step 2: Build and verify**

```bash
pnpm check
open _site/crew/the-list.html
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/crew/the-list.hbs
git commit -m "feat: add crew/the-list landing page"
```

---

### Task 7: Build `crew/the-bit.hbs`

**Files:**
- Create: `src/pages/crew/the-bit.hbs`

- [ ] **Step 1: Write the template**

Same structure, different accent and content.

**Accent:** `--accent: #a855f7; --accent-soft: rgba(168, 85, 247, 0.15);`

**Frontmatter:**
```json
{
  "layout": "webring",
  "title": "Software for an Inside Joke | Vibes DIY",
  "description": "The rating system for bad movies. The draft board for who picks dinner. The app nobody else would understand. That's the point.",
  "ogUrl": "https://good.vibes.diy/crew/the-bit/",
  "source": "crew-the-bit",
  "apps": [
    {
      "slug": "bad-movie-draft",
      "author": "og",
      "live": true,
      "title": "Bad Movie Draft",
      "tagline": "Claim a movie. Watch it. Rate the suffering."
    },
    {
      "slug": "dinner-picker-tournament",
      "author": "og",
      "live": true,
      "title": "Dinner Tournament",
      "tagline": "Bracket. Vote. Eat."
    },
    {
      "slug": "superlatives-tracker",
      "author": "og",
      "live": true,
      "title": "Superlatives",
      "tagline": "Most likely to forget their keys. Weekly."
    },
    {
      "slug": "bit-commitment-log",
      "author": "og",
      "live": true,
      "title": "The Bit Log",
      "tagline": "Track every running joke. Rate the execution."
    }
  ]
}
```

**Crew label:** `CREW // THE BIT`

**Cluster nav:** `THE BIT` is active.

**Hero:** `.provocation`: "SOFTWARE FOR AN INSIDE JOKE" then `<h1>`:
```
The app
nobody else
would
<span class="hi">understand</span>.
That's
the point.
```
`.lead`: "The rating system for bad movies. The draft board for who picks dinner. The superlatives nobody asked for. Software so specific to your crew that explaining it to someone outside would take longer than building it."

**Tagline pair:** Same.

**Apps label:** "APPS NOBODY ELSE WOULD GET"

**Manifesto:** `h2`: "ODDLY SPECIFIC" then `.pull`: "The best software is <span class="hi">too weird</span> for a product. It only makes sense to the people who use it. That's why they love it." then `p`: "These apps exist because someone had a bit and turned it into a thing. A bad movie draft board. A superlatives tracker. A log of inside jokes. Nobody would build this as a startup. But for the crew that uses it, it's essential. That's the kind of software Vibes is for."

**CTA bar:** Same as chaos.

- [ ] **Step 2: Build and verify**

```bash
pnpm check
open _site/crew/the-bit.html
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/crew/the-bit.hbs
git commit -m "feat: add crew/the-bit landing page"
```

---

### Task 8: Add crew cluster to the homepage index

**Files:**
- Modify: `src/pages/index.hbs`

- [ ] **Step 1: Read the current index to find where landing cards are listed**

Read `src/pages/index.hbs` to find the pattern for adding new page cards.

- [ ] **Step 2: Add a "Crew" section or cards**

Add cards for the three crew pages following the existing card pattern in `index.hbs`. Each card links to its page and uses the page's accent color for the border/hover.

- [ ] **Step 3: Build and verify**

```bash
pnpm check
open _site/index.html
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.hbs
git commit -m "feat: add crew cluster cards to homepage"
```

---

### Task 9: Add crew pages to about.hbs

**Files:**
- Modify: `src/pages/about.hbs`

- [ ] **Step 1: Read about.hbs to find the page listing pattern**

- [ ] **Step 2: Add crew pages to the listing**

Add entries for `crew/chaos`, `crew/the-list`, and `crew/the-bit` following the existing pattern.

- [ ] **Step 3: Build and verify**

```bash
pnpm check
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/about.hbs
git commit -m "feat: add crew pages to about index"
```

---

### Task 10: OG screenshots

**Files:**
- Modify: `screenshot-pages.js` — add crew page slugs

- [ ] **Step 1: Add slugs to screenshot-pages.js**

Add `"crew/chaos"`, `"crew/the-list"`, `"crew/the-bit"` to the `SLUGS` array.

- [ ] **Step 2: Generate screenshots**

```bash
pnpm check
node screenshot-pages.js
```

- [ ] **Step 3: Add ogImage to each page's frontmatter**

Add to each crew page's frontmatter:
- chaos: `"ogImage": "https://good.vibes.diy/images/screenshots/crew/chaos.jpg"`
- the-list: `"ogImage": "https://good.vibes.diy/images/screenshots/crew/the-list.jpg"`
- the-bit: `"ogImage": "https://good.vibes.diy/images/screenshots/crew/the-bit.jpg"`

- [ ] **Step 4: Rebuild and commit**

```bash
pnpm check
git add images/screenshots/crew/ src/pages/crew/ screenshot-pages.js
git commit -m "feat: add OG screenshots for crew cluster"
```

---

### Task 11: Final build and prettier

- [ ] **Step 1: Run prettier on all non-hbs changed files**

```bash
npx prettier --write screenshot-pages.js
```

(Do NOT run prettier on .hbs files — they are excluded.)

- [ ] **Step 2: Final build**

```bash
pnpm check
```

- [ ] **Step 3: Open all three pages and verify**

```bash
open _site/crew/chaos.html
open _site/crew/the-list.html
open _site/crew/the-bit.html
```

Verify:
- All app screenshots load (not fallback image)
- Open/Clone/Remix links point to correct slugs and authors
- Cluster nav links work between pages
- Newsletter form renders
- Design system looks consistent across all three
- Accent colors are distinct per page

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix: crew cluster polish"
```
