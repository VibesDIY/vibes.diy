# Sports Audience Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build three sports audience pages (World Cup Pool, Golf League, Fantasy League) — each with 5 deployed Vibes apps, a distinct visual skin, and full integration into the site index.

**Architecture:** Each page is a single `.hbs` file with `layout: "webring"`, a frontmatter JSON block declaring 5 app entries, self-contained CSS, and a Handlebars template iterating over apps. Apps are generated via `npx vibes-diy@latest generate --user-slug og` in batch scripts, then verified before the page sets `live: true`.

**Tech Stack:** Handlebars templates, plain CSS, `npx vibes-diy@latest`, `pnpm check` (build), Puppeteer (screenshots)

---

## File Map

| Action | Path                                                                       |
| ------ | -------------------------------------------------------------------------- |
| Create | `vibes/world-cup/_run.sh`                                                  |
| Create | `src/pages/world-cup-pool.hbs`                                             |
| Create | `vibes/golf-league/_run.sh`                                                |
| Create | `src/pages/golf-league.hbs`                                                |
| Create | `vibes/fantasy-league/_run.sh`                                             |
| Create | `src/pages/fantasy-league.hbs`                                             |
| Modify | `screenshot-pages.js` — add 3 slugs to SLUGS array                         |
| Modify | `src/pages/index.hbs` — add CSS for 3 new `cc-*` variants + 3 card entries |

---

## Task 1: Create World Cup batch script

**Files:**

- Create: `vibes/world-cup/_run.sh`

- [ ] **Step 1: Create the directory and script**

```bash
mkdir -p vibes/world-cup
```

Create `vibes/world-cup/_run.sh`:

```bash
#!/usr/bin/env bash
set -u
HERE="/Users/jchris/code/landing-pages/vibes/world-cup"
cd "$HERE"

USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen world-cup-bracket-picks "World Cup bracket prediction app. Group members enter picks stage by stage before kickoff. Points auto-calculate as results come in. Live leaderboard for the whole tournament. Share via link, no login needed."

gen match-score-predictor "Match score predictor for World Cup. Players guess exact scorelines before each game. Points for correct outcome plus bonus points for guessing the exact score. Running standings update live."

gen watch-party-planner "Watch party planner for World Cup matches. Propose venues and times, group votes on best option. Confirm the plan and share via link. Covers the full tournament schedule."

gen fan-loyalty-wall "World Cup fan loyalty wall. Each person claims a national team. Live board tracks whose countries are still alive through each stage. Celebrates wins and records eliminations."

gen pool-standings-board "World Cup pool leaderboard. Commissioner enters match results. Everyone watches their group ranking update in real time. One shareable link for the whole pool, no spreadsheet needed."

wait
echo "ALL DONE" >> "$HERE/_status.log"
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x vibes/world-cup/_run.sh
```

---

## Task 2: Run World Cup vibes and verify all 5 deploy

**Files:**

- Read: `vibes/world-cup/_status.log` (after run)

- [ ] **Step 1: Run the batch script**

```bash
bash vibes/world-cup/_run.sh
```

- [ ] **Step 2: Wait for all 5 to complete (poll \_status.log every 45s)**

```bash
# Run this in a loop until you see "ALL DONE"
cat vibes/world-cup/_status.log
```

Wait until `_status.log` contains `ALL DONE`. Check for any `exit=1` lines — if any exist, check the corresponding `<slug>.log` for the error.

- [ ] **Step 3: Verify each deploy has a real fsId (not "pending")**

Run these 5 curl checks:

```bash
curl -sL https://world-cup-bracket-picks--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://match-score-predictor--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://watch-party-planner--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://fan-loyalty-wall--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://pool-standings-board--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
```

Good output: `registerDependencies({…,"fsId":"z<CID>"}) … mountVibe([V1], …)`
Bad output: `"fsId":"pending"` or `mountVibe([], …)`

If a slug is stuck, pick a new slug name and regenerate just that one:

```bash
npx vibes-diy@latest generate --user-slug og --app-slug <new-slug> "<same prompt>"
```

Then update the slug in `src/pages/world-cup-pool.hbs` after the page is created.

---

## Task 3: Create World Cup Pool HBS page

**Files:**

- Create: `src/pages/world-cup-pool.hbs`

- [ ] **Step 1: Create the file with this exact content**

Create `src/pages/world-cup-pool.hbs`:

```handlebars
{{!--
{
  "layout": "webring",
  "title": "World Cup Pool Organizer | Vibes DIY",
  "description": "Run your 2026 World Cup prediction pool from one link — bracket picks, score predictions, watch party planning, fan loyalty wall, live standings. No accounts, no spreadsheet.",
  "ogUrl": "https://good.vibes.diy/world-cup-pool/",
  "source": "world-cup-pool",
  "apps": [
    {
      "num": "01",
      "slug": "world-cup-bracket-picks",
      "author": "og",
      "live": true,
      "title": "Bracket Picks",
      "tagline": "Everyone locks in their bracket before kickoff.",
      "desc": "Group members enter their stage-by-stage picks before the tournament starts. Points auto-calculate as results come in. Leaderboard stays live through the whole competition."
    },
    {
      "num": "02",
      "slug": "match-score-predictor",
      "author": "og",
      "live": true,
      "title": "Score Predictor",
      "tagline": "Call the exact score. Earn bonus points for precision.",
      "desc": "Players predict exact scorelines before each match. Points for getting the outcome right, plus a bonus for nailing the exact score. Running standings update after every game."
    },
    {
      "num": "03",
      "slug": "watch-party-planner",
      "author": "og",
      "live": true,
      "title": "Watch Party Planner",
      "tagline": "Vote on where to watch. Someone picks the snacks.",
      "desc": "Propose venues and kickoff times, let the group vote. Confirm the plan and share the link. Works for the whole tournament schedule."
    },
    {
      "num": "04",
      "slug": "fan-loyalty-wall",
      "author": "og",
      "live": true,
      "title": "Fan Loyalty Wall",
      "tagline": "Claim your country. Show off when they win.",
      "desc": "Each person picks their national team. A live wall tracks whose countries are still alive through each stage. Celebrate wins, mourn upsets, trash talk freely."
    },
    {
      "num": "05",
      "slug": "pool-standings-board",
      "author": "og",
      "live": true,
      "title": "Pool Standings",
      "tagline": "One link. Everyone's score. No spreadsheet.",
      "desc": "Commissioner enters match results. Everyone watches their pool ranking update in real time. One shareable link for the whole group — no Excel, no Google Sheets."
    }
  ],
  "ogImage": "https://good.vibes.diy/images/screenshots/world-cup-pool.jpg"
}
--}}

<style>
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=optional");

  :root {
    --pitch:      oklch(0.22 0.09 145);
    --pitch-mid:  oklch(0.28 0.08 145);
    --pitch-card: oklch(0.18 0.08 145);
    --line:       oklch(1 0 0 / 0.14);
    --gold:       oklch(0.88 0.18 95);
    --white:      oklch(0.99 0 0);
    --dim:        oklch(1 0 0 / 0.55);
  }

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    background: var(--pitch);
    color: var(--white);
    font-family: "Inter", system-ui, sans-serif;
    line-height: 1.55;
    min-height: 100vh;
  }
  a { color: inherit; text-decoration: none; }

  .layout { max-width: 1100px; margin: 0 auto; padding: 0 1.25rem; }

  .topbar {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1rem 0;
    border-bottom: 2px solid var(--line);
  }
  .topbar .brand { font-weight: 900; letter-spacing: -0.02em; font-size: 1.25rem; }
  .topbar .meta { font-family: "JetBrains Mono", monospace; font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--dim); }
  .topbar .meta b { background: var(--gold); color: oklch(0.10 0 0); padding: 2px 6px; }

  .crumb { padding: 0.55rem 0; font-family: "JetBrains Mono", monospace; font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--dim); border-bottom: 1px solid var(--line); }
  .crumb a { color: var(--dim); }
  .crumb a:hover { color: var(--gold); }

  .hero { padding: 4.5rem 0 3.5rem; border-bottom: 2px solid var(--line); }
  .hero .label {
    display: inline-block; padding: 4px 12px; margin-bottom: 1.5rem;
    background: var(--gold); color: oklch(0.10 0 0);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.6rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase;
  }
  .hero h1 {
    font-size: clamp(3rem, 8vw, 6.5rem);
    font-weight: 900; line-height: 0.9; letter-spacing: -0.04em;
    margin-bottom: 1.5rem;
  }
  .hero h1 .hi { color: var(--gold); }
  .hero p.lead { font-size: 1.15rem; max-width: 720px; line-height: 1.55; color: var(--dim); }
  .hero .marker { color: var(--gold); }

  .stats {
    display: grid; grid-template-columns: repeat(4, 1fr);
    border-top: 2px solid var(--line); border-bottom: 2px solid var(--line);
    margin: 2rem 0;
  }
  @media (max-width: 700px) { .stats { grid-template-columns: repeat(2, 1fr); } }
  .stat-cell { padding: 1.25rem 1.5rem; border-right: 1px solid var(--line); }
  .stat-cell:last-child { border-right: none; }
  @media (max-width: 700px) { .stat-cell { border-bottom: 1px solid var(--line); } .stat-cell:nth-child(2n) { border-right: none; } }
  .stat-cell .k { font-family: "JetBrains Mono", monospace; font-size: 0.55rem; letter-spacing: 0.25em; text-transform: uppercase; color: var(--dim); margin-bottom: 0.4rem; }
  .stat-cell .v { font-weight: 900; font-size: 1.4rem; letter-spacing: -0.02em; }

  .section-label { padding: 1rem 0 0.5rem; font-family: "JetBrains Mono", monospace; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; color: var(--dim); }
  .section-label::before { content: "// "; }

  .apps { display: flex; flex-direction: column; border-top: 2px solid var(--line); border-bottom: 2px solid var(--line); }
  .app {
    padding: 2rem 0; border-bottom: 1px solid var(--line);
    display: grid; grid-template-columns: 80px 1fr 320px;
    gap: 2rem; align-items: start;
    transition: background 0.15s;
  }
  .app:last-child { border-bottom: none; }
  @media (max-width: 800px) { .app { grid-template-columns: 1fr; gap: 1rem; } }
  .app:hover { background: var(--pitch-mid); }

  .num-cell { font-family: "JetBrains Mono", monospace; display: flex; flex-direction: column; gap: 0.4rem; }
  .app .num { font-weight: 900; font-size: 3rem; line-height: 0.85; letter-spacing: -0.04em; color: var(--gold); }
  .app .status { font-family: "JetBrains Mono", monospace; font-size: 0.55rem; letter-spacing: 0.2em; text-transform: uppercase; padding: 3px 6px; border: 1px solid var(--line); text-align: center; }
  .app--live .status { background: var(--gold); color: oklch(0.10 0 0); border-color: var(--gold); }

  .body { display: flex; flex-direction: column; gap: 0.7rem; }
  .body .title { font-size: 2rem; font-weight: 900; letter-spacing: -0.02em; line-height: 1.05; }
  .body .tagline { font-family: "JetBrains Mono", monospace; font-size: 0.85rem; padding: 5px 10px; background: var(--pitch-card); border-left: 3px solid var(--gold); display: inline-block; }
  .body .desc { font-size: 1rem; line-height: 1.55; color: var(--dim); }

  .right { display: flex; flex-direction: column; gap: 0.6rem; }
  .shot { display: block; aspect-ratio: 16/9; overflow: hidden; border: 1px solid var(--line); background: var(--pitch-mid); }
  .shot img { width: 100%; height: 100%; object-fit: cover; }
  .shot-placeholder { padding: 1rem; height: 100%; display: flex; align-items: center; justify-content: center; font-family: "JetBrains Mono", monospace; font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--dim); text-align: center; }

  .ctas { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--line); }
  .ctas--single { grid-template-columns: 1fr; }
  .btn { text-align: center; padding: 0.6rem 0.5rem; background: transparent; border-right: 1px solid var(--line); font-family: "JetBrains Mono", monospace; font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; color: var(--white); cursor: pointer; transition: background 0.12s; }
  .btn:last-child { border-right: none; }
  .btn:hover { background: var(--gold); color: oklch(0.10 0 0); }

  .prompt-link { font-family: "JetBrains Mono", monospace; font-size: 0.7rem; text-decoration: underline; color: var(--dim); }
  .prompt-link:hover { color: var(--gold); }

  .epilogue { padding: 2.5rem 0; border-bottom: 2px solid var(--line); }
  .epilogue h2 { font-family: "JetBrains Mono", monospace; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; color: var(--dim); margin-bottom: 1rem; }
  .epilogue h2::before { content: "// "; }
  .epilogue p { font-size: 1.1rem; max-width: 720px; line-height: 1.55; color: var(--dim); }
  .epilogue .hl { color: var(--gold); }

  footer.foot { padding: 1rem 0; font-family: "JetBrains Mono", monospace; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; display: flex; justify-content: space-between; color: var(--dim); }
  footer.foot a:hover { color: var(--gold); }
</style>

<div class="layout">
  <header class="topbar">
    <a class="brand" href="https://links.vibes.diy/homepage">VIBES.DIY</a>
    <span class="meta"><b>WORLD CUP 2026</b> &middot; five pool tools</span>
  </header>

  <nav class="crumb">
    <a href="/">Home</a> &nbsp;&rsaquo;&nbsp; World Cup Pool
  </nav>

  <section class="hero">
    <span class="label">For World Cup Fans</span>
    <h1>Run your pool.<br/><span class="hi">Not a spreadsheet.</span></h1>
    <p class="lead">
      Five apps for running a <span class="marker">World Cup prediction pool</span> your whole group can use from their phone.
      <span class="marker">Bracket picks</span>, <span class="marker">score predictions</span>,
      <span class="marker">watch party votes</span>, <span class="marker">fan loyalty wall</span>,
      <span class="marker">live standings</span>. No accounts. No install. Results update live.
    </p>
  </section>

  <div class="stats">
    <div class="stat-cell"><div class="k">Apps</div><div class="v">Five</div></div>
    <div class="stat-cell"><div class="k">Audience</div><div class="v">Pools &amp; Groups</div></div>
    <div class="stat-cell"><div class="k">Persistence</div><div class="v">Fireproof</div></div>
    <div class="stat-cell"><div class="k">Skin</div><div class="v">Pitch Board</div></div>
  </div>

  <div class="section-label">The Toolkit</div>

  <section class="apps">
    {{#each apps}}
    <article class="app {{#if live}}app--live{{else}}app--pending{{/if}}">
      <div class="num-cell">
        <div class="num">{{num}}</div>
        <div class="status">{{#if live}}Live{{else}}Pending{{/if}}</div>
      </div>
      <div class="body">
        <h2 class="title">{{title}}</h2>
        <span class="tagline">{{tagline}}</span>
        <p class="desc">{{desc}}</p>
      </div>
      <div class="right">
        {{#if live}}
          <a class="shot" href="https://vibes.diy/vibe/{{author}}/{{slug}}" aria-label="{{title}} screenshot"><img src="https://{{slug}}--{{author}}.prod-v2.vibesdiy.net/screenshot.jpg" alt="{{slug}}" onerror="this.onerror=null; this.src='{{@root.assetPrefix}}images/og-preview.png';"/></a>
          <div class="ctas">
            <a class="btn" href="https://vibes.diy/vibe/{{author}}/{{slug}}">Join</a>
            <a class="btn" href="https://vibes.diy/clone/{{author}}/{{slug}}">Clone</a>
            <a class="btn" href="https://vibes.diy/remix/{{author}}/{{slug}}">Remix</a>
          </div>
          <a class="prompt-link" href="https://vibes.diy/chat/prompt?prompt64={{prompt64 desc}}">// start fresh from this prompt</a>
        {{else}}
          <div class="shot"><div class="shot-placeholder">awaiting deploy</div></div>
          <div class="ctas ctas--single">
            <a class="btn" href="https://vibes.diy/chat/prompt?prompt64={{prompt64 desc}}">Start From Prompt</a>
          </div>
        {{/if}}
      </div>
    </article>
    {{/each}}
  </section>

  <div class="epilogue">
    <h2>Read Me</h2>
    <p>
      The 2026 World Cup runs from June through July. Your group chat is already a mess.
      These five apps give the pool an actual home — <span class="hl">one link per tool</span>,
      no signup required, Fireproof-backed so nothing disappears between matches.
      Clone any one to run your own variant — change the scoring rules, add more rounds,
      or remix the loyalty wall for your own league.
    </p>
  </div>

  <footer class="foot">
    <span>Vibes.diy &middot; <a href="https://links.vibes.diy/homepage">homepage</a> &middot; <a href="/fantasy-league.html">fantasy league</a></span>
    <span>// END OF TOOLKIT</span>
  </footer>
</div>
```

- [ ] **Step 2: Build to verify no template errors**

```bash
pnpm check
```

Expected: build completes with no errors. Check that `_site/world-cup-pool.html` exists.

- [ ] **Step 3: Open and inspect**

```bash
open _site/world-cup-pool.html
```

Visually confirm: dark green background, gold accents, 5 apps listed as Live, screenshots loading.

---

## Task 4: Create Golf League batch script

**Files:**

- Create: `vibes/golf-league/_run.sh`

- [ ] **Step 1: Create the directory and script**

```bash
mkdir -p vibes/golf-league
```

Create `vibes/golf-league/_run.sh`:

```bash
#!/usr/bin/env bash
set -u
HERE="/Users/jchris/code/landing-pages/vibes/golf-league"
cd "$HERE"

USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen golf-scorecard "Digital golf scorecard for casual leagues. Track strokes per hole for multiple players across 18 holes. Auto-total gross and net scores. Supports stroke play and stableford. Share results with the group via link."

gen golf-handicap-tracker "Golf handicap tracker for informal leagues. Log each round score and course rating. Running handicap index updates after every entry. Shows differential trend over the season. No USGA membership needed."

gen golf-league-standings "Golf league season standings. Commissioner posts weekly round results. League table tracks points, wins, and net scores across the season. One shareable link for the whole group."

gen skins-game-tracker "Golf skins game tracker. Log hole-by-hole skins results with carryovers and side bets. End-of-round totals show who owes what. No arguments at the 19th hole."

gen tee-time-signup "Golf tee time sign-up board. Post an upcoming round with date and time. Group members sign up. Caps at 4 per tee. Shows who is committed and who is still deciding."

wait
echo "ALL DONE" >> "$HERE/_status.log"
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x vibes/golf-league/_run.sh
```

---

## Task 5: Run Golf League vibes and verify all 5 deploy

- [ ] **Step 1: Run the batch script**

```bash
bash vibes/golf-league/_run.sh
```

- [ ] **Step 2: Wait for all 5 to complete (poll every 45s)**

```bash
cat vibes/golf-league/_status.log
```

Wait until `_status.log` shows `ALL DONE`. Check for `exit=1` lines and read corresponding logs if any.

- [ ] **Step 3: Verify each deploy has a real fsId**

```bash
curl -sL https://golf-scorecard--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://golf-handicap-tracker--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://golf-league-standings--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://skins-game-tracker--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://tee-time-signup--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
```

Good: `"fsId":"z<CID>"` and `mountVibe([V1], …)`
Bad: `"fsId":"pending"` or `mountVibe([], …)` — pick a new slug and redeploy if stuck.

---

## Task 6: Create Golf League HBS page

**Files:**

- Create: `src/pages/golf-league.hbs`

- [ ] **Step 1: Create the file**

Create `src/pages/golf-league.hbs`:

```handlebars
{{!--
{
  "layout": "webring",
  "title": "Golf League Manager | Vibes DIY",
  "description": "Run your casual golf league from one link — digital scorecards, handicap tracker, season standings, skins game, tee time sign-ups. No paid apps, no paper, works on any phone.",
  "ogUrl": "https://good.vibes.diy/golf-league/",
  "source": "golf-league",
  "apps": [
    {
      "num": "01",
      "slug": "golf-scorecard",
      "author": "og",
      "live": true,
      "title": "Digital Scorecard",
      "tagline": "18 holes. All players. Automatic totals.",
      "desc": "Track strokes per hole for every player in your group. Net and gross scores calculate instantly. Works for stroke play, match play, and stableford. Share results via link."
    },
    {
      "num": "02",
      "slug": "golf-handicap-tracker",
      "author": "og",
      "live": true,
      "title": "Handicap Tracker",
      "tagline": "Your differential after every round.",
      "desc": "Log each round score and course rating. Your running handicap index updates after every entry. Shows your trend over the full season. No paid membership, no USGA required."
    },
    {
      "num": "03",
      "slug": "golf-league-standings",
      "author": "og",
      "live": true,
      "title": "League Standings",
      "tagline": "Season points. Week by week.",
      "desc": "Commissioner posts weekly results. League table tracks points, wins, and net scores for the whole group. One link for everyone to check the standings."
    },
    {
      "num": "04",
      "slug": "skins-game-tracker",
      "author": "og",
      "live": true,
      "title": "Skins Game",
      "tagline": "Who won the skin on 7? Who owes who?",
      "desc": "Track hole-by-hole skins with carryovers and side bets. End-of-round totals show exactly who owes what. No arguments at the 19th hole."
    },
    {
      "num": "05",
      "slug": "tee-time-signup",
      "author": "og",
      "live": true,
      "title": "Tee Time Sign-Up",
      "tagline": "Who's in Saturday? Lock in your spot.",
      "desc": "Post an upcoming round with date and time. Group members sign up. Caps at 4 per tee. Shows who is committed and who is still deciding."
    }
  ],
  "ogImage": "https://good.vibes.diy/images/screenshots/golf-league.jpg"
}
--}}

<style>
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Playfair+Display:wght@700;800&family=JetBrains+Mono:wght@400;700&display=optional");

  :root {
    --cream:    #fdfaf4;
    --sand:     #e8dfc8;
    --fairway:  #2d6a2d;
    --rough:    #1a3d1a;
    --ink:      #1a1a1a;
    --dim:      #666;
    --flag-red: #c8102e;
  }

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    background: var(--cream);
    color: var(--ink);
    font-family: "Inter", system-ui, sans-serif;
    line-height: 1.55;
    min-height: 100vh;
  }
  a { color: inherit; text-decoration: none; }

  .layout { max-width: 1100px; margin: 0 auto; padding: 0 1.25rem; border-left: 2px solid var(--sand); border-right: 2px solid var(--sand); }

  .topbar {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1rem 0;
    border-bottom: 3px solid var(--fairway);
  }
  .topbar .brand { font-weight: 900; letter-spacing: -0.02em; font-size: 1.25rem; color: var(--fairway); }
  .topbar .meta { font-family: "JetBrains Mono", monospace; font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--dim); }

  .crumb { padding: 0.55rem 0; font-family: "JetBrains Mono", monospace; font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--dim); border-bottom: 1px solid var(--sand); }
  .crumb a:hover { color: var(--fairway); }

  .hero { padding: 4rem 0 3rem; border-bottom: 3px solid var(--fairway); }
  .hero .label {
    display: inline-block; padding: 4px 12px; margin-bottom: 1.5rem;
    background: var(--fairway); color: var(--cream);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.6rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase;
  }
  .hero h1 {
    font-family: "Playfair Display", Georgia, serif;
    font-size: clamp(2.8rem, 7vw, 6rem);
    font-weight: 800; line-height: 0.95; letter-spacing: -0.02em;
    margin-bottom: 1.5rem; color: var(--rough);
  }
  .hero h1 .hi { color: var(--fairway); }
  .hero p.lead { font-size: 1.1rem; max-width: 720px; line-height: 1.6; color: var(--dim); }
  .hero .marker { background: var(--sand); padding: 1px 4px; }

  .stats {
    display: grid; grid-template-columns: repeat(4, 1fr);
    border: 2px solid var(--sand); border-radius: 4px;
    margin: 2rem 0; overflow: hidden;
  }
  @media (max-width: 700px) { .stats { grid-template-columns: repeat(2, 1fr); } }
  .stat-cell { padding: 1.25rem 1.5rem; border-right: 1px solid var(--sand); background: var(--cream); }
  .stat-cell:last-child { border-right: none; }
  @media (max-width: 700px) { .stat-cell { border-bottom: 1px solid var(--sand); } .stat-cell:nth-child(2n) { border-right: none; } }
  .stat-cell .k { font-family: "JetBrains Mono", monospace; font-size: 0.55rem; letter-spacing: 0.25em; text-transform: uppercase; color: var(--dim); margin-bottom: 0.4rem; }
  .stat-cell .v { font-family: "Playfair Display", serif; font-weight: 700; font-size: 1.4rem; color: var(--rough); }

  .section-label { padding: 1.5rem 0 0.75rem; font-family: "JetBrains Mono", monospace; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; color: var(--dim); border-bottom: 1px dashed var(--sand); margin-bottom: 1.5rem; }

  .apps { display: flex; flex-direction: column; border-top: 2px solid var(--fairway); border-bottom: 2px solid var(--fairway); }
  .app {
    padding: 2rem 0; border-bottom: 1px solid var(--sand);
    display: grid; grid-template-columns: 80px 1fr 320px;
    gap: 2rem; align-items: start;
    transition: background 0.15s;
  }
  .app:last-child { border-bottom: none; }
  @media (max-width: 800px) { .app { grid-template-columns: 1fr; gap: 1rem; } }
  .app:hover { background: oklch(0.97 0.02 145); }

  .num-cell { display: flex; flex-direction: column; gap: 0.4rem; }
  .app .num { font-family: "Playfair Display", serif; font-weight: 800; font-size: 3.5rem; line-height: 0.85; color: var(--fairway); }
  .app .status { font-family: "JetBrains Mono", monospace; font-size: 0.55rem; letter-spacing: 0.2em; text-transform: uppercase; padding: 3px 6px; border: 1px solid var(--sand); text-align: center; color: var(--dim); }
  .app--live .status { background: var(--fairway); color: var(--cream); border-color: var(--fairway); }

  .body { display: flex; flex-direction: column; gap: 0.7rem; }
  .body .title { font-family: "Playfair Display", serif; font-size: 2rem; font-weight: 700; line-height: 1.05; color: var(--rough); }
  .body .tagline { font-family: "JetBrains Mono", monospace; font-size: 0.82rem; padding: 5px 10px; background: var(--sand); border-left: 3px solid var(--fairway); display: inline-block; color: var(--rough); }
  .body .desc { font-size: 1rem; line-height: 1.55; color: var(--dim); }

  .right { display: flex; flex-direction: column; gap: 0.6rem; }
  .shot { display: block; aspect-ratio: 16/9; overflow: hidden; border: 1px solid var(--sand); background: var(--sand); }
  .shot img { width: 100%; height: 100%; object-fit: cover; }
  .shot-placeholder { padding: 1rem; height: 100%; display: flex; align-items: center; justify-content: center; font-family: "JetBrains Mono", monospace; font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--dim); text-align: center; }

  .ctas { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--sand); }
  .ctas--single { grid-template-columns: 1fr; }
  .btn { text-align: center; padding: 0.6rem 0.5rem; background: transparent; border-right: 1px solid var(--sand); font-family: "JetBrains Mono", monospace; font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; color: var(--ink); cursor: pointer; transition: background 0.12s; }
  .btn:last-child { border-right: none; }
  .btn:hover { background: var(--fairway); color: var(--cream); border-color: var(--fairway); }

  .prompt-link { font-family: "JetBrains Mono", monospace; font-size: 0.7rem; text-decoration: underline; color: var(--dim); }
  .prompt-link:hover { color: var(--fairway); }

  .epilogue { padding: 2.5rem 0; border-bottom: 2px solid var(--sand); }
  .epilogue h2 { font-family: "JetBrains Mono", monospace; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; color: var(--dim); margin-bottom: 1rem; }
  .epilogue p { font-size: 1.1rem; max-width: 720px; line-height: 1.6; color: var(--dim); }
  .epilogue .hl { background: var(--sand); padding: 1px 4px; color: var(--rough); }

  footer.foot { padding: 1rem 0; font-family: "JetBrains Mono", monospace; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; display: flex; justify-content: space-between; color: var(--dim); }
  footer.foot a:hover { color: var(--fairway); }
</style>

<div class="layout">
  <header class="topbar">
    <a class="brand" href="https://links.vibes.diy/homepage">VIBES.DIY</a>
    <span class="meta">Golf League &middot; five tools</span>
  </header>

  <nav class="crumb">
    <a href="/">Home</a> &nbsp;&rsaquo;&nbsp; Golf League
  </nav>

  <section class="hero">
    <span class="label">For Golf Leagues</span>
    <h1>Run your season.<br/><span class="hi">Lose the paper.</span></h1>
    <p class="lead">
      Five tools for casual golf leagues that don&rsquo;t want to pay for an app or track things in a spreadsheet.
      <span class="marker">Scorecards</span>, <span class="marker">handicap tracking</span>,
      <span class="marker">season standings</span>, <span class="marker">skins games</span>,
      <span class="marker">tee time sign-ups</span>. No downloads. Works on any phone.
    </p>
  </section>

  <div class="stats">
    <div class="stat-cell"><div class="k">Apps</div><div class="v">Five</div></div>
    <div class="stat-cell"><div class="k">Audience</div><div class="v">Casual Leagues</div></div>
    <div class="stat-cell"><div class="k">Persistence</div><div class="v">Fireproof</div></div>
    <div class="stat-cell"><div class="k">Skin</div><div class="v">Scorecard</div></div>
  </div>

  <div class="section-label">The Bag</div>

  <section class="apps">
    {{#each apps}}
    <article class="app {{#if live}}app--live{{else}}app--pending{{/if}}">
      <div class="num-cell">
        <div class="num">{{num}}</div>
        <div class="status">{{#if live}}Live{{else}}Pending{{/if}}</div>
      </div>
      <div class="body">
        <h2 class="title">{{title}}</h2>
        <span class="tagline">{{tagline}}</span>
        <p class="desc">{{desc}}</p>
      </div>
      <div class="right">
        {{#if live}}
          <a class="shot" href="https://vibes.diy/vibe/{{author}}/{{slug}}" aria-label="{{title}} screenshot"><img src="https://{{slug}}--{{author}}.prod-v2.vibesdiy.net/screenshot.jpg" alt="{{slug}}" onerror="this.onerror=null; this.src='{{@root.assetPrefix}}images/og-preview.png';"/></a>
          <div class="ctas">
            <a class="btn" href="https://vibes.diy/vibe/{{author}}/{{slug}}">Join</a>
            <a class="btn" href="https://vibes.diy/clone/{{author}}/{{slug}}">Clone</a>
            <a class="btn" href="https://vibes.diy/remix/{{author}}/{{slug}}">Remix</a>
          </div>
          <a class="prompt-link" href="https://vibes.diy/chat/prompt?prompt64={{prompt64 desc}}">// start fresh from this prompt</a>
        {{else}}
          <div class="shot"><div class="shot-placeholder">awaiting deploy</div></div>
          <div class="ctas ctas--single">
            <a class="btn" href="https://vibes.diy/chat/prompt?prompt64={{prompt64 desc}}">Start From Prompt</a>
          </div>
        {{/if}}
      </div>
    </article>
    {{/each}}
  </section>

  <div class="epilogue">
    <h2>Read Me</h2>
    <p>
      The USGA handicap system requires a paid membership and 54 holes of history.
      Your Saturday group needs a scorecard and a way to settle the skins.
      <span class="hl">These five are sized to the actual problem</span> — a dozen guys, a season, a running tab.
      Clone any one to adjust the rules for your specific format.
    </p>
  </div>

  <footer class="foot">
    <span>Vibes.diy &middot; <a href="https://links.vibes.diy/homepage">homepage</a> &middot; <a href="/world-cup-pool.html">world cup</a> &middot; <a href="/fantasy-league.html">fantasy</a></span>
    <span>// 19TH HOLE</span>
  </footer>
</div>
```

- [ ] **Step 2: Build and open**

```bash
pnpm check && open _site/golf-league.html
```

Visually confirm: cream background, Playfair serif headings, fairway green accents.

---

## Task 7: Create Fantasy League batch script

**Files:**

- Create: `vibes/fantasy-league/_run.sh`

- [ ] **Step 1: Create directory and script**

```bash
mkdir -p vibes/fantasy-league
```

Create `vibes/fantasy-league/_run.sh`:

```bash
#!/usr/bin/env bash
set -u
HERE="/Users/jchris/code/landing-pages/vibes/fantasy-league"
cd "$HERE"

USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen fantasy-draft-board "Fantasy sports live draft board. Commissioner runs it in real time. Each pick logs instantly and everyone in the room sees the same board update. Works for football, baseball, and soccer drafts."

gen fantasy-power-rankings "Fantasy league weekly power rankings app. Commissioner posts rankings with a short hot take per team. League members comment and react. The whole point is the bulletin board fuel."

gen trade-proposal-tracker "Fantasy sports trade proposal tracker. Log trade offers between teams. League members vote to approve or veto each deal. Full history for the season with no disputed trades."

gen fantasy-trash-talk-wall "Fantasy league trash talk wall. Dedicated feed for smack talk, victory laps, and taunts after big wins. Reactions and reply threads. Keeps the main group chat from getting buried."

gen waiver-wire-log "Fantasy sports waiver wire log. Track every free agent claim and drop across the season. Log waiver priority order. Searchable history so nobody disputes who picked up what."

wait
echo "ALL DONE" >> "$HERE/_status.log"
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x vibes/fantasy-league/_run.sh
```

---

## Task 8: Run Fantasy League vibes and verify all 5 deploy

- [ ] **Step 1: Run the batch script**

```bash
bash vibes/fantasy-league/_run.sh
```

- [ ] **Step 2: Wait for all 5 (poll every 45s)**

```bash
cat vibes/fantasy-league/_status.log
```

- [ ] **Step 3: Verify each deploy**

```bash
curl -sL https://fantasy-draft-board--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://fantasy-power-rankings--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://trade-proposal-tracker--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://fantasy-trash-talk-wall--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://waiver-wire-log--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
```

---

## Task 9: Create Fantasy League HBS page

**Files:**

- Create: `src/pages/fantasy-league.hbs`

- [ ] **Step 1: Create the file**

Create `src/pages/fantasy-league.hbs`:

```handlebars
{{!--
{
  "layout": "webring",
  "title": "Fantasy League Commissioner Tools | Vibes DIY",
  "description": "Build custom tools your fantasy league actually uses — live draft board, power rankings, trade tracker, trash talk wall, waiver wire log. Your rules, your data.",
  "ogUrl": "https://good.vibes.diy/fantasy-league/",
  "source": "fantasy-league",
  "apps": [
    {
      "num": "01",
      "slug": "fantasy-draft-board",
      "author": "og",
      "live": true,
      "title": "Live Draft Board",
      "tagline": "Real-time pick tracking. Everyone sees it at once.",
      "desc": "Commissioner runs the board. Each pick logs instantly. Everyone in the room sees the same view update — no spreadsheet on a projector, no refresh lag."
    },
    {
      "num": "02",
      "slug": "fantasy-power-rankings",
      "author": "og",
      "live": true,
      "title": "Power Rankings",
      "tagline": "Commissioner's take. League debates.",
      "desc": "Post weekly power rankings with a hot take per team. League members comment and react. The bulletin board fuel is the whole point — post early, stir the pot."
    },
    {
      "num": "03",
      "slug": "trade-proposal-tracker",
      "author": "og",
      "live": true,
      "title": "Trade Tracker",
      "tagline": "Propose it. Review it. Vote to veto.",
      "desc": "Log trade proposals between teams. League votes approve or veto. Every deal on record for the full season. No disputed trades, no \"wait, I never agreed to that.\""
    },
    {
      "num": "04",
      "slug": "fantasy-trash-talk-wall",
      "author": "og",
      "live": true,
      "title": "Trash Talk Wall",
      "tagline": "The banter belongs somewhere.",
      "desc": "Dedicated feed for smack talk, victory laps, and reactions after big wins or crushing upsets. Keeps the main group chat clean. Threads, reactions, full chaos."
    },
    {
      "num": "05",
      "slug": "waiver-wire-log",
      "author": "og",
      "live": true,
      "title": "Waiver Wire Log",
      "tagline": "Who dropped who. Who picked up who. No disputes.",
      "desc": "Log every waiver claim and free agent pickup across the season. Track priority order. Searchable history. Nobody questions what happened in Week 9."
    }
  ],
  "ogImage": "https://good.vibes.diy/images/screenshots/fantasy-league.jpg"
}
--}}

<style>
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Barlow+Condensed:wght@700;800;900&family=JetBrains+Mono:wght@400;700&display=optional");

  :root {
    --field:  oklch(0.10 0.04 265);
    --card:   oklch(0.15 0.04 265);
    --line:   oklch(1 0 0 / 0.12);
    --red:    oklch(0.50 0.22 25);
    --red-hi: oklch(0.55 0.22 25);
    --gold:   oklch(0.88 0.18 95);
    --white:  oklch(0.99 0 0);
    --dim:    oklch(1 0 0 / 0.5);
  }

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    background: var(--field);
    color: var(--white);
    font-family: "Inter", system-ui, sans-serif;
    line-height: 1.55;
    min-height: 100vh;
  }
  a { color: inherit; text-decoration: none; }

  .layout { max-width: 1100px; margin: 0 auto; padding: 0 1.25rem; }

  .topbar {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1rem 0;
    border-bottom: 3px solid var(--red);
  }
  .topbar .brand { font-family: "Barlow Condensed", sans-serif; font-weight: 900; letter-spacing: 0.02em; font-size: 1.4rem; }
  .topbar .meta { font-family: "JetBrains Mono", monospace; font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--dim); }
  .topbar .meta b { background: var(--red); padding: 2px 6px; }

  .crumb { padding: 0.55rem 0; font-family: "JetBrains Mono", monospace; font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--dim); border-bottom: 1px solid var(--line); }
  .crumb a:hover { color: var(--gold); }

  .hero { padding: 4.5rem 0 3.5rem; border-bottom: 3px solid var(--red); }
  .hero .label {
    display: inline-block; padding: 4px 12px; margin-bottom: 1.5rem;
    background: var(--red); color: var(--white);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.6rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase;
  }
  .hero h1 {
    font-family: "Barlow Condensed", sans-serif;
    font-size: clamp(4rem, 11vw, 8.5rem);
    font-weight: 900; line-height: 0.88; letter-spacing: 0.01em;
    text-transform: uppercase;
    margin-bottom: 1.5rem;
  }
  .hero h1 .hi { color: var(--red); }
  .hero p.lead { font-size: 1.15rem; max-width: 720px; line-height: 1.55; color: var(--dim); }
  .hero .marker { color: var(--gold); }

  .stats {
    display: grid; grid-template-columns: repeat(4, 1fr);
    border-top: 2px solid var(--line); border-bottom: 2px solid var(--line);
    margin: 2rem 0;
  }
  @media (max-width: 700px) { .stats { grid-template-columns: repeat(2, 1fr); } }
  .stat-cell { padding: 1.25rem 1.5rem; border-right: 1px solid var(--line); }
  .stat-cell:last-child { border-right: none; }
  @media (max-width: 700px) { .stat-cell { border-bottom: 1px solid var(--line); } .stat-cell:nth-child(2n) { border-right: none; } }
  .stat-cell .k { font-family: "JetBrains Mono", monospace; font-size: 0.55rem; letter-spacing: 0.25em; text-transform: uppercase; color: var(--dim); margin-bottom: 0.4rem; }
  .stat-cell .v { font-family: "Barlow Condensed", sans-serif; font-weight: 700; font-size: 1.4rem; letter-spacing: 0.01em; }

  .section-label { padding: 1rem 0 0.5rem; font-family: "JetBrains Mono", monospace; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; color: var(--dim); }
  .section-label::before { content: "// "; }

  .apps { display: flex; flex-direction: column; border-top: 2px solid var(--line); border-bottom: 2px solid var(--line); }
  .app {
    padding: 2rem 0; border-bottom: 1px solid var(--line);
    display: grid; grid-template-columns: 80px 1fr 320px;
    gap: 2rem; align-items: start;
    transition: background 0.15s;
  }
  .app:last-child { border-bottom: none; }
  @media (max-width: 800px) { .app { grid-template-columns: 1fr; gap: 1rem; } }
  .app:hover { background: var(--card); }

  .num-cell { display: flex; flex-direction: column; gap: 0.4rem; }
  .app .num { font-family: "Barlow Condensed", sans-serif; font-weight: 900; font-size: 3.5rem; line-height: 0.85; letter-spacing: 0.01em; color: var(--red); }
  .app .status { font-family: "JetBrains Mono", monospace; font-size: 0.55rem; letter-spacing: 0.2em; text-transform: uppercase; padding: 3px 6px; border: 1px solid var(--line); text-align: center; }
  .app--live .status { background: var(--red); border-color: var(--red); }

  .body { display: flex; flex-direction: column; gap: 0.7rem; }
  .body .title { font-family: "Barlow Condensed", sans-serif; font-size: 2.4rem; font-weight: 900; line-height: 0.95; text-transform: uppercase; letter-spacing: 0.01em; }
  .body .tagline { font-family: "JetBrains Mono", monospace; font-size: 0.82rem; padding: 5px 10px; background: var(--card); border-left: 3px solid var(--red); display: inline-block; color: var(--dim); }
  .body .desc { font-size: 1rem; line-height: 1.55; color: var(--dim); }

  .right { display: flex; flex-direction: column; gap: 0.6rem; }
  .shot { display: block; aspect-ratio: 16/9; overflow: hidden; border: 1px solid var(--line); background: var(--card); }
  .shot img { width: 100%; height: 100%; object-fit: cover; }
  .shot-placeholder { padding: 1rem; height: 100%; display: flex; align-items: center; justify-content: center; font-family: "JetBrains Mono", monospace; font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--dim); text-align: center; }

  .ctas { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid var(--line); }
  .ctas--single { grid-template-columns: 1fr; }
  .btn { text-align: center; padding: 0.6rem 0.5rem; background: transparent; border-right: 1px solid var(--line); font-family: "JetBrains Mono", monospace; font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; color: var(--white); cursor: pointer; transition: background 0.12s; }
  .btn:last-child { border-right: none; }
  .btn:hover { background: var(--red); border-color: var(--red); }

  .prompt-link { font-family: "JetBrains Mono", monospace; font-size: 0.7rem; text-decoration: underline; color: var(--dim); }
  .prompt-link:hover { color: var(--gold); }

  .epilogue { padding: 2.5rem 0; border-bottom: 2px solid var(--line); }
  .epilogue h2 { font-family: "JetBrains Mono", monospace; font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase; color: var(--dim); margin-bottom: 1rem; }
  .epilogue h2::before { content: "// "; }
  .epilogue p { font-size: 1.1rem; max-width: 720px; line-height: 1.55; color: var(--dim); }
  .epilogue .hl { color: var(--gold); }

  footer.foot { padding: 1rem 0; font-family: "JetBrains Mono", monospace; font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; display: flex; justify-content: space-between; color: var(--dim); }
  footer.foot a:hover { color: var(--gold); }
</style>

<div class="layout">
  <header class="topbar">
    <a class="brand" href="https://links.vibes.diy/homepage">VIBES.DIY</a>
    <span class="meta"><b>FANTASY LEAGUE</b> &middot; five commissioner tools</span>
  </header>

  <nav class="crumb">
    <a href="/">Home</a> &nbsp;&rsaquo;&nbsp; Fantasy League
  </nav>

  <section class="hero">
    <span class="label">For Fantasy Commissioners</span>
    <h1>Your league.<br/><span class="hi">Your tools.</span></h1>
    <p class="lead">
      Five custom tools for fantasy leagues that want more than ESPN and Discord threads.
      <span class="marker">Live draft board</span>, <span class="marker">power rankings</span>,
      <span class="marker">trade tracker</span>, <span class="marker">trash talk wall</span>,
      <span class="marker">waiver log</span>. Your rules, your data, no platform owning it.
    </p>
  </section>

  <div class="stats">
    <div class="stat-cell"><div class="k">Apps</div><div class="v">Five</div></div>
    <div class="stat-cell"><div class="k">Audience</div><div class="v">Commissioners</div></div>
    <div class="stat-cell"><div class="k">Persistence</div><div class="v">Fireproof</div></div>
    <div class="stat-cell"><div class="k">Skin</div><div class="v">Blitz</div></div>
  </div>

  <div class="section-label">The Playbook</div>

  <section class="apps">
    {{#each apps}}
    <article class="app {{#if live}}app--live{{else}}app--pending{{/if}}">
      <div class="num-cell">
        <div class="num">{{num}}</div>
        <div class="status">{{#if live}}Live{{else}}Pending{{/if}}</div>
      </div>
      <div class="body">
        <h2 class="title">{{title}}</h2>
        <span class="tagline">{{tagline}}</span>
        <p class="desc">{{desc}}</p>
      </div>
      <div class="right">
        {{#if live}}
          <a class="shot" href="https://vibes.diy/vibe/{{author}}/{{slug}}" aria-label="{{title}} screenshot"><img src="https://{{slug}}--{{author}}.prod-v2.vibesdiy.net/screenshot.jpg" alt="{{slug}}" onerror="this.onerror=null; this.src='{{@root.assetPrefix}}images/og-preview.png';"/></a>
          <div class="ctas">
            <a class="btn" href="https://vibes.diy/vibe/{{author}}/{{slug}}">Join</a>
            <a class="btn" href="https://vibes.diy/clone/{{author}}/{{slug}}">Clone</a>
            <a class="btn" href="https://vibes.diy/remix/{{author}}/{{slug}}">Remix</a>
          </div>
          <a class="prompt-link" href="https://vibes.diy/chat/prompt?prompt64={{prompt64 desc}}">// start fresh from this prompt</a>
        {{else}}
          <div class="shot"><div class="shot-placeholder">awaiting deploy</div></div>
          <div class="ctas ctas--single">
            <a class="btn" href="https://vibes.diy/chat/prompt?prompt64={{prompt64 desc}}">Start From Prompt</a>
          </div>
        {{/if}}
      </div>
    </article>
    {{/each}}
  </section>

  <div class="epilogue">
    <h2>Read Me</h2>
    <p>
      ESPN and Yahoo lock you into their format. Discord threads bury everything.
      Draft day is always chaos. These five give the commissioner
      <span class="hl">actual tools sized to an actual league</span> — not enterprise software,
      not a glorified group chat. Clone any one to change the rules for your specific format.
    </p>
  </div>

  <footer class="foot">
    <span>Vibes.diy &middot; <a href="https://links.vibes.diy/homepage">homepage</a> &middot; <a href="/world-cup-pool.html">world cup</a> &middot; <a href="/golf-league.html">golf</a></span>
    <span>// COMMISSIONER OUT</span>
  </footer>
</div>
```

- [ ] **Step 2: Build and open**

```bash
pnpm check && open _site/fantasy-league.html
```

Visually confirm: dark navy background, Barlow Condensed headings, red accents, uppercase energy.

---

## Task 10: Add 3 slugs to screenshot-pages.js

**Files:**

- Modify: `screenshot-pages.js`

- [ ] **Step 1: Add slugs to the SLUGS array**

In `screenshot-pages.js`, find the SLUGS array (around line 22). Add these three entries in alphabetical order:

```javascript
// Add after "fantasy-league" position (alphabetical: after "electric-psych-rock", before "food-trucks"):
  "fantasy-league",
// Add after "golf-league" position (after "generate", before "homeschoolers"):
  "golf-league",
// Add after "world-cup-pool" position (after "would-you-rather", before "youtubers"):
  "world-cup-pool",
```

The resulting sorted section should look like:

```javascript
const SLUGS = [
  "accountability",
  "babylon-3d",
  "bike-summer",
  "builders",
  "coaches",
  "college",
  "connect-backend-data",
  "contractors",
  "creator-documentation",
  "creators",
  "dating",
  "electric-psych-rock",
  "engineers",
  "fantasy-league",    // ← new
  "food-trucks",
  "generate",
  "golf-league",       // ← new
  "homeschoolers",
  // ... rest of list ...
  "world-cup-pool",    // ← new
  "would-you-rather",
  "youtubers",
  // ... edu/ entries stay at end ...
```

- [ ] **Step 2: Run prettier on screenshot-pages.js**

```bash
npx prettier --write screenshot-pages.js
```

---

## Task 11: Add 3 cards to index.hbs

**Files:**

- Modify: `src/pages/index.hbs`

- [ ] **Step 1: Add 3 new cc-\* color CSS rules**

In `src/pages/index.hbs`, find the block of `.cc-*` CSS rules (around line 213). Add these three after the existing rules:

```css
.cc-pitch .collection-card-accent {
  background: #006233;
}
.cc-fairway .collection-card-accent {
  background: #2d6a2d;
}
.cc-blitz .collection-card-accent {
  background: #c8102e;
}
```

- [ ] **Step 2: Add 3 card entries**

Find the section in index.hbs where `college.html` and `dating.html` cards appear (around line 488). Add the 3 new cards after the dating card (after line 512):

```html
<a href="world-cup-pool.html" class="collection-card cc-pitch">
  <div class="collection-card-accent"></div>
  <div class="collection-card-body">
    <div class="collection-card-top">
      <div class="collection-card-icon">⚽</div>
      <span class="collection-badge">5 apps live</span>
    </div>
    <h2>World Cup Pool</h2>
    <p>
      Bracket picks, score predictions, watch party votes, fan wall, live
      standings. Run your 2026 pool without a spreadsheet.
    </p>
    <span class="collection-cta">Start Your Pool →</span>
  </div>
</a>

<a href="golf-league.html" class="collection-card cc-fairway">
  <div class="collection-card-accent"></div>
  <div class="collection-card-body">
    <div class="collection-card-top">
      <div class="collection-card-icon">⛳</div>
      <span class="collection-badge">5 apps live</span>
    </div>
    <h2>Golf League</h2>
    <p>
      Digital scorecards, handicap tracker, season standings, skins game, tee
      time sign-ups. Lose the paper, keep the game.
    </p>
    <span class="collection-cta">Tee It Up →</span>
  </div>
</a>

<a href="fantasy-league.html" class="collection-card cc-blitz">
  <div class="collection-card-accent"></div>
  <div class="collection-card-body">
    <div class="collection-card-top">
      <div class="collection-card-icon">🏆</div>
      <span class="collection-badge">5 apps live</span>
    </div>
    <h2>Fantasy League</h2>
    <p>
      Live draft board, power rankings, trade tracker, trash talk wall, waiver
      log. Commissioner tools ESPN doesn't give you.
    </p>
    <span class="collection-cta">Run Your League →</span>
  </div>
</a>
```

- [ ] **Step 3: Run prettier on index.hbs**

index.hbs is excluded from prettier (per `.prettierignore`). Do NOT run prettier on it.

---

## Task 12: Final build verification

- [ ] **Step 1: Run pnpm check**

```bash
pnpm check
```

Expected: completes with no errors. Verify these files exist:

```bash
ls _site/world-cup-pool.html _site/golf-league.html _site/fantasy-league.html
```

- [ ] **Step 2: Open all 3 pages**

```bash
open _site/world-cup-pool.html
open _site/golf-league.html
open _site/fantasy-league.html
```

- [ ] **Step 3: Open index**

```bash
open _site/index.html
```

Confirm the 3 new cards appear with correct colors and emoji.

---

## Task 13: Capture OG screenshots

- [ ] **Step 1: Run screenshot script**

```bash
node screenshot-pages.js --all
```

Expected: creates `images/screenshots/world-cup-pool.jpg`, `images/screenshots/golf-league.jpg`, `images/screenshots/fantasy-league.jpg`.

- [ ] **Step 2: Verify screenshots are real JPGs**

```bash
file images/screenshots/world-cup-pool.jpg
file images/screenshots/golf-league.jpg
file images/screenshots/fantasy-league.jpg
```

Each should report `JPEG image data`. If any report something else, the page may have errored during capture — re-run for that slug only.

---

## Task 14: Commit

- [ ] **Step 1: Stage changed files**

```bash
git add src/pages/world-cup-pool.hbs \
        src/pages/golf-league.hbs \
        src/pages/fantasy-league.hbs \
        src/pages/index.hbs \
        screenshot-pages.js \
        vibes/world-cup/_run.sh \
        vibes/golf-league/_run.sh \
        vibes/fantasy-league/_run.sh \
        images/screenshots/world-cup-pool.jpg \
        images/screenshots/golf-league.jpg \
        images/screenshots/fantasy-league.jpg
```

- [ ] **Step 2: Run prettier on non-hbs changed files**

```bash
npx prettier --write screenshot-pages.js
```

(index.hbs and \*.hbs files are excluded by `.prettierignore` — do NOT run prettier on them.)

- [ ] **Step 3: Final build check**

```bash
pnpm check
```

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add World Cup Pool, Golf League, Fantasy League audience pages

Three sports-themed audience pages targeting 2026 FIFA World Cup pool
organizers, casual golf league managers, and fantasy sports commissioners.
Each has 5 deployed Vibes apps and a distinct visual skin.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Announce completion**

```bash
echo 'three sports pages' | say
```
