# Science-Kits Page Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `src/pages/science-kits.hbs` from a generic audience page to a live-vibes page using the college Slab Concrete layout with 5 deployed companion apps for science kit creators.

**Architecture:** Replace the existing standard-layout page with a `webring` layout page using the college.hbs structure (Inter + JetBrains Mono, concrete grey + phosphor green accent). Apps start as `live: false` stubs, then a CLI batch script deploys them, and each entry is flipped to `live: true` after verification.

**Tech Stack:** Handlebars templates, `npx vibes-diy@latest` CLI, `pnpm check` build, bash batch scripts.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `agents/new-audience-page.md` | Add Step 0 upgrade-path section |
| Create | `vibes/science-kits/_run.sh` | Batch CLI generation script |
| Replace | `src/pages/science-kits.hbs` | Full rewrite to college layout |

---

### Task 1: Update the runbook with the upgrade-path step

**Files:**
- Modify: `agents/new-audience-page.md`

- [ ] **Step 1: Open `agents/new-audience-page.md` and add Step 0 before the existing "## 1. Define the apps" heading**

Insert this block at the very top, before `## 1. Define the apps`:

```markdown
## 0. Upgrade path (existing page only)

If upgrading an existing audience page rather than creating a new one:

1. Note the current filename — keep it unchanged so existing index links don't break.
2. Note the current `source` tag from frontmatter — carry it forward.
3. Strip the entire `.hbs` file content below the frontmatter comment block.
4. Replace with the college-layout template (see Task 3 of the science-kits upgrade plan for the full template).
5. Update frontmatter: change `"layout"` to `"webring"`, add the `apps` array, keep `source` unchanged.
6. Proceed from Step 1 of this runbook (define the apps).

```

- [ ] **Step 2: Verify the heading sequence reads 0 → 1 → 2 → 3 → 4 → 5 → 6**

Open the file and confirm section numbering is correct.

- [ ] **Step 3: Run `pnpm check` from `/Users/jchris/code/landing-pages` to confirm the build still passes**

```sh
cd /Users/jchris/code/landing-pages && pnpm check
```

Expected: clean build, no errors.

---

### Task 2: Create the CLI batch generation script

**Files:**
- Create: `vibes/science-kits/_run.sh`

- [ ] **Step 1: Create the directory**

```sh
mkdir -p /Users/jchris/code/landing-pages/vibes/science-kits
```

- [ ] **Step 2: Write the script**

Create `/Users/jchris/code/landing-pages/vibes/science-kits/_run.sh` with this exact content:

```bash
#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/science-kits"
cd "$HERE"
USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" \
    >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen "chemistry-reaction-log" "Log observations during a chemistry experiment — step label, color change, temperature, pH, notes, photo. Timestamped entries. Shareable result card at the end."
gen "circuit-build-guide" "Step-by-step assembly checklist for an electronics kit. Check off each component as you place it. Flag where you're stuck. Show completion percentage."
gen "plant-growth-tracker" "Daily measurement log for a plant biology kit. Height, photo upload, prediction vs actual. Auto-generates a growth timeline chart. Shareable."
gen "rocket-launch-log" "Pre-launch checklist, launch data entry (weather, angle, altitude estimate), post-flight notes. Shareable mission debrief card."
gen "experiment-discovery-board" "Gallery of completed experiments — title, photo, result summary, star rating. Shareable link. Works across any kit type."

wait
echo "ALL DONE" >> "$HERE/_status.log"
```

- [ ] **Step 3: Make it executable**

```sh
chmod +x /Users/jchris/code/landing-pages/vibes/science-kits/_run.sh
```

---

### Task 3: Rewrite science-kits.hbs with the college layout

**Files:**
- Replace: `src/pages/science-kits.hbs`

- [ ] **Step 1: Replace the entire content of `src/pages/science-kits.hbs` with the following**

```handlebars
{{!--
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
--}}

<style>
  @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=optional");

  :root {
    --concrete: oklch(0.88 0 0);
    --acid: oklch(0.83 0.22 145);
    --black: oklch(0.10 0 0);
    --ink: oklch(0 0 0);
    --hover: oklch(1 0 0 / 0.4);
  }

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    background: var(--concrete);
    color: var(--black);
    font-family: "Inter", system-ui, sans-serif;
    line-height: 1.55;
    min-height: 100vh;
    background-image:
      radial-gradient(circle at 20% 10%, rgba(0,0,0,0.03), transparent 50%),
      radial-gradient(circle at 80% 90%, rgba(0,0,0,0.04), transparent 50%);
  }
  a { color: inherit; text-decoration: none; }
  .mono { font-family: "JetBrains Mono", monospace; }

  .layout { max-width: 1100px; margin: 0 auto; padding: 0 1.25rem; border-left: 2px solid var(--black); border-right: 2px solid var(--black); }

  .topbar {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 4px solid var(--black);
    margin: 0 -1.25rem;
    padding-left: 1.25rem; padding-right: 1.25rem;
  }
  .topbar .brand {
    font-family: "Inter", sans-serif; font-weight: 900; letter-spacing: -0.02em;
    font-size: 1.25rem;
  }
  .topbar .meta {
    font-family: "JetBrains Mono", monospace;
    font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase;
  }
  .topbar .meta b { background: var(--acid); padding: 2px 6px; }

  .crumb {
    padding: 0.55rem 0;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.65rem; letter-spacing: 0.18em; text-transform: uppercase;
    border-bottom: 2px solid var(--black);
  }
  .crumb a:hover { background: var(--acid); }

  .hero {
    padding: 4rem 0 3.5rem;
    border-bottom: 4px solid var(--black);
    position: relative;
  }
  .hero .label {
    font-family: "JetBrains Mono", monospace;
    font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase;
    margin-bottom: 1.5rem;
    display: inline-block;
    padding: 4px 10px;
    background: var(--black); color: var(--concrete);
  }
  .hero h1 {
    font-size: clamp(3rem, 9vw, 7rem);
    font-weight: 900;
    line-height: 0.92;
    letter-spacing: -0.04em;
    margin-bottom: 1.5rem;
  }
  .hero h1 .hi {
    background: var(--acid);
    padding: 0 0.18em;
    display: inline-block;
    transform: rotate(-1.5deg);
    box-shadow: 6px 6px 0 var(--black);
    margin: 0.1em 0;
  }
  .hero p.lead {
    font-size: 1.2rem;
    max-width: 720px;
    line-height: 1.5;
  }
  .hero .marker {
    background: var(--acid);
    padding: 1px 4px;
  }

  .stats {
    display: grid; grid-template-columns: repeat(4, 1fr);
    border-bottom: 4px solid var(--black);
  }
  @media (max-width: 700px) { .stats { grid-template-columns: repeat(2, 1fr); } }
  .stat-cell {
    padding: 1.25rem 1.5rem;
    border-right: 2px solid var(--black);
  }
  .stat-cell:last-child { border-right: none; }
  @media (max-width: 700px) {
    .stat-cell { border-bottom: 2px solid var(--black); }
    .stat-cell:nth-child(2n) { border-right: none; }
  }
  .stat-cell .k {
    font-family: "JetBrains Mono", monospace;
    font-size: 0.55rem; letter-spacing: 0.25em; text-transform: uppercase;
    margin-bottom: 0.4rem;
  }
  .stat-cell .v {
    font-family: "Inter", sans-serif; font-weight: 900;
    font-size: 1.4rem; letter-spacing: -0.02em;
  }

  .section-label {
    padding: 1.5rem 0 0.75rem;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase;
    border-bottom: 2px dashed var(--black);
    margin-bottom: 1.5rem;
  }
  .section-label::before { content: "// "; }

  .apps {
    display: flex; flex-direction: column; gap: 0;
    border-top: 2px solid var(--black);
    border-bottom: 4px solid var(--black);
  }
  .app {
    padding: 2rem 1.5rem;
    border-bottom: 2px solid var(--black);
    display: grid;
    grid-template-columns: 80px 1fr 320px;
    gap: 2rem;
    align-items: start;
    transition: background 0.15s;
  }
  .app:last-child { border-bottom: none; }
  @media (max-width: 800px) { .app { grid-template-columns: 1fr; gap: 1rem; } }
  .app:hover { background: rgba(0,0,0,0.04); }

  .app .num-cell {
    font-family: "JetBrains Mono", monospace;
    display: flex; flex-direction: column; gap: 0.4rem;
  }
  .app .num {
    font-family: "Inter", sans-serif; font-weight: 900;
    font-size: 3rem; line-height: 0.85; letter-spacing: -0.04em;
  }
  .app .status {
    font-size: 0.55rem; letter-spacing: 0.2em; text-transform: uppercase;
    padding: 3px 6px; border: 2px solid var(--black);
    text-align: center;
  }
  .app--live .status { background: var(--acid); }

  .app .body { display: flex; flex-direction: column; gap: 0.7rem; }
  .app .body .title {
    font-size: 2rem; font-weight: 900; letter-spacing: -0.02em;
    line-height: 1.05;
  }
  .app .body .tagline {
    font-family: "JetBrains Mono", monospace;
    font-size: 0.85rem; padding: 6px 10px;
    background: var(--acid); display: inline-block; align-self: flex-start;
  }
  .app .body .desc { font-size: 1rem; line-height: 1.55; }

  .app .right { display: flex; flex-direction: column; gap: 0.6rem; }
  .app .shot { display: block; aspect-ratio: 16/9; overflow: hidden; border: 2px solid var(--black); background: var(--concrete); }
  .app .shot img { width: 100%; height: 100%; object-fit: cover; }
  .app .shot-placeholder {
    padding: 1rem; height: 100%; display: flex; align-items: center; justify-content: center;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase;
    text-align: center;
  }
  .app .ctas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border: 2px solid var(--black); }
  .app .ctas--single { grid-template-columns: 1fr; }
  .btn {
    text-align: center;
    padding: 0.55rem 0.5rem;
    background: transparent;
    border-right: 2px solid var(--black);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.65rem; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700;
    color: var(--black);
    cursor: pointer;
    transition: background 0.12s;
  }
  .btn:last-child { border-right: none; }
  .btn:hover { background: var(--acid); }
  .prompt-link {
    font-family: "JetBrains Mono", monospace;
    font-size: 0.7rem;
    text-decoration: underline;
  }
  .prompt-link:hover { background: var(--acid); }

  .epilogue {
    padding: 2.5rem 0;
    border-bottom: 4px solid var(--black);
  }
  .epilogue h2 {
    font-family: "JetBrains Mono", monospace;
    font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase;
    margin-bottom: 1rem;
  }
  .epilogue h2::before { content: "// "; }
  .epilogue p { font-size: 1.1rem; max-width: 720px; line-height: 1.55; }
  .epilogue .hl { background: var(--acid); padding: 1px 4px; }

  footer.term-footer {
    padding: 1rem 0;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase;
    display: flex; justify-content: space-between;
  }
  footer.term-footer a:hover { background: var(--acid); }
</style>

<div class="layout">
  <header class="topbar">
    <a class="brand" href="https://links.vibes.diy/homepage">VIBES.DIY</a>
    <span class="meta"><b>FOR SCIENCE KIT CREATORS</b> · five kit companion apps</span>
  </header>

  <nav class="crumb">
    <a href="/">Home</a> &nbsp;›&nbsp; Science Kits
  </nav>

  <section class="hero">
    <span class="label">For Science Kit Creators</span>
    <h1>Apps that ship<br/>with the <span class="hi">kit.</span></h1>
    <p class="lead">
      Five companion apps for science kit creators — one per kit type. Each turns a physical product into a <span class="marker">living experiment</span> with <span class="marker">data logging</span>, <span class="marker">step-by-step guidance</span>, and <span class="marker">shareable results</span>. Describe what your kit needs. Watch it appear.
    </p>
  </section>

  <div class="stats">
    <div class="stat-cell">
      <div class="k">Apps</div>
      <div class="v">Five</div>
    </div>
    <div class="stat-cell">
      <div class="k">Audience</div>
      <div class="v">Kit Creators</div>
    </div>
    <div class="stat-cell">
      <div class="k">Persistence</div>
      <div class="v">Fireproof</div>
    </div>
    <div class="stat-cell">
      <div class="k">Skin</div>
      <div class="v">Phosphor Lab</div>
    </div>
  </div>

  <div class="section-label">The Kit Library</div>

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
      The best science kit isn't just a box of components. It's a physical product with a <span class="hl">digital layer</span> — something that guides the experiment, captures the data, and shares the discovery. These five apps show what that layer looks like across five kit types. <span class="hl">Remix any one</span> to match your kit specifically.
    </p>
  </div>

  <footer class="term-footer">
    <span>Vibes.diy · <a href="https://links.vibes.diy/homepage">homepage</a> · <a href="/featured-apps/">featured apps</a></span>
    <span>// END OF KIT LIBRARY</span>
  </footer>
</div>
```

- [ ] **Step 2: Run `pnpm check`**

```sh
cd /Users/jchris/code/landing-pages && pnpm check
```

Expected: clean build. `science-kits.hbs -> science-kits.html` in output.

- [ ] **Step 3: Open in browser to verify pending state renders correctly**

```sh
open /Users/jchris/code/landing-pages/_site/science-kits.html
```

Expected: 5 app entries, all showing "Pending" badge + "awaiting deploy" placeholder + "Start From Prompt" button.

- [ ] **Step 4: Commit the page and script**

```sh
cd /Users/jchris/code/landing-pages
git add src/pages/science-kits.hbs agents/new-audience-page.md vibes/science-kits/_run.sh
git commit -m "$(cat <<'EOF'
feat: upgrade science-kits to live-vibes college layout

Replaces generic audience page with Slab Concrete / Phosphor Lab skin
matching college.hbs structure. Five kit companion apps pending deploy.
Also adds upgrade-path Step 0 to agents/new-audience-page.md runbook.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Generate the 5 apps via CLI

**Files:**
- Run: `vibes/science-kits/_run.sh`
- Watch: `vibes/science-kits/_status.log`

- [ ] **Step 1: Run the batch script**

```sh
bash /Users/jchris/code/landing-pages/vibes/science-kits/_run.sh
```

- [ ] **Step 2: Watch for completions**

```sh
tail -F /Users/jchris/code/landing-pages/vibes/science-kits/_status.log
```

Wait until `ALL DONE` appears. Each successful slug shows `DONE <slug> exit=0`.

- [ ] **Step 3: Verify each deploy is real (not a stub)**

Run for each slug:

```sh
curl -sL https://chemistry-reaction-log--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://circuit-build-guide--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://plant-growth-tracker--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://rocket-launch-log--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
curl -sL https://experiment-discovery-board--og.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
```

Good output (real deploy): `"fsId":"z<CID>"` and `mountVibe([V1]`  
Bad output (stub): `"fsId":"pending"` and `mountVibe([]` → pick a fresh slug, update `_run.sh` and frontmatter, redeploy.

---

### Task 5: Flip verified apps to live: true and commit

**Files:**
- Modify: `src/pages/science-kits.hbs`

- [ ] **Step 1: For each verified slug, change `"live": false` to `"live": true` in the frontmatter**

In `src/pages/science-kits.hbs`, update each verified app entry. Example for the first:

```json
{
  "num": "01",
  "slug": "chemistry-reaction-log",
  "author": "og",
  "live": true,
  "title": "Reaction Logger",
  ...
}
```

Repeat for all 5 (or however many verified successfully).

- [ ] **Step 2: Run `pnpm check`**

```sh
cd /Users/jchris/code/landing-pages && pnpm check
```

Expected: clean build.

- [ ] **Step 3: Open in browser and verify screenshots load**

```sh
open /Users/jchris/code/landing-pages/_site/science-kits.html
```

Expected: live entries show screenshot image, Join/Clone/Remix buttons, and `// start fresh from this prompt` link. Screenshot images may take a moment to load from the CDN.

- [ ] **Step 4: Commit**

```sh
cd /Users/jchris/code/landing-pages
git add src/pages/science-kits.hbs
git commit -m "$(cat <<'EOF'
feat: flip science-kits apps to live after deploy verification

All 5 kit companion apps verified with real fsId. Screenshots, Join,
Clone, and Remix links now active.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Notes

- **Stuck slug**: if a slug returns the same stub on repeated retries, it's pinned to a stuck state. Pick a fresh SEO slug (e.g. `chem-reaction-logger` instead of `chemistry-reaction-log`), update both `_run.sh` and the frontmatter entry, re-run just that slug.
- **`.hbs` files**: never run `npx prettier --write` on `.hbs` files — they're in `.prettierignore`.
- **Don't push**: unless the user explicitly asks.
