# Garage Sale Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `/garage-sale` — a landing page targeting neighborhood garage-sale organizers, with five deployed Fireproof apps: The Coordinator (spotlight), Sale Poster, Rate My Thrift, Gear List, Cash Box.

**Architecture:** Standard audience page pattern — `layout: "webring"` .hbs template with inline CSS (broadsheet/classifieds newspaper aesthetic), five apps generated via `vibes-diy` CLI with `--user-slug og`, verified live before page is built. Spotlight gets hero treatment; other four are gallery cards.

**Tech Stack:** Handlebars templates, `vibes-diy` CLI (`npx vibes-diy@latest`), `pnpm check` build, `screenshot-pages.js` for OG capture.

---

## Files

| Action | Path |
|--------|------|
| Create | `vibes/garage-sale/_run.sh` |
| Create | `src/pages/garage-sale.hbs` |
| Modify | `src/pages/index.hbs` — add landing card (newest first) |
| Modify | `screenshot-pages.js` — add `"garage-sale"` to SLUGS array |

---

## Task 1: Create the generation script

**Files:**
- Create: `vibes/garage-sale/_run.sh`

- [ ] **Step 1: Create the directory and script**

```bash
mkdir -p vibes/garage-sale
```

Create `vibes/garage-sale/_run.sh` with this content:

```bash
#!/usr/bin/env bash
set -euo pipefail
USER_SLUG="og"
cd "$(dirname "$0")"
> _status.log

gen() {
  local slug="$1"; local prompt="$2"
  npx vibes-diy@latest generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" \
    >> _status.log 2>&1 && echo "DONE $slug exit=0" >> _status.log \
    || echo "DONE $slug exit=1" >> _status.log &
}

gen "group-sale-signup" "Neighborhood garage sale coordinator. Organizer sets date, address, neighborhood name. Neighbors sign up: name, spot type (table/blanket), item categories (clothes/toys/tools/misc), needs-change flag. Shows live participant list and spot count. Shared link, no login."

gen "yard-sale-listing" "Yard sale listing. Seller enters address, date, hours, item categories. Each listing stored with Fireproof doc._id. Parse ?listing= from URL on load; if present, show that sale as a shareable card with Google Maps link. If absent, show create form. No login."

gen "rate-my-thrift" "Thrift find sharing app. Post a find: photo (base64 upload), item name, price paid, where found, one-line brag. Store each find as a Fireproof document. On mount, read window.location.search for ?item= param; if present, fetch that doc by _id and show it in full-screen hero view with four emoji reaction buttons: 🔥 steal, 💎 gem, 😬 overpaid, 🤌 perfect — each reaction stored as a Fireproof doc linked to the item _id, counts shown in real time. Below hero show a 'Share this find' button that copies the current URL with ?item=<doc._id> appended. If no ?item= param on load, show the community feed of all finds sorted by newest first, with a 'Post your find' CTA at top. Dark background, photo-forward layout."

gen "sale-day-checklist" "Garage sale gear tracker. Shared list: folding tables, chairs, extension cords, price sticker rolls, grocery bags, poster board + markers, cash box — each with quantity needed. Neighbors enter name and quantity they can bring, claiming items. Shows unclaimed quantities. Shared link, no login."

gen "cash-box-tracker" "Multi-seller garage sale cash tracker. Sellers register name at start. Record transactions: seller name, item description, amount. Running total per seller shown live. End-of-day summary shows each seller's total. Shared link, no login."

wait
echo "ALL DONE" >> _status.log
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x vibes/garage-sale/_run.sh
```

- [ ] **Step 3: Run the generation script**

```bash
cd vibes/garage-sale && bash _run.sh
```

Then tail the log until all five are done:

```bash
tail -F vibes/garage-sale/_status.log
```

Expected final line: `ALL DONE`

- [ ] **Step 4: Verify each deploy is real (not a stub)**

Run for each slug. A real deploy has `fsId: z<CID>` and `mountVibe([V1]`. A stub has `fsId: pending` and `mountVibe([])`.

```bash
for slug in group-sale-signup yard-sale-listing rate-my-thrift sale-day-checklist cash-box-tracker; do
  echo "=== $slug ==="
  curl -sL "https://${slug}--og.prod-v2.vibesdiy.net/" | grep -E "fsId|mountVibe"
done
```

Expected for each:
```
registerDependencies({..."fsId":"z<some-CID>"...})
mountVibe([V1], ...)
```

If any show `fsId: pending` or `mountVibe([])`: pick a fresh slug (e.g. `garage-coordinator` instead of `group-sale-signup`), add a new `gen` line to the script, re-run for just that slug, and update the slug in the .hbs frontmatter accordingly.

- [ ] **Step 5: Commit the generation script**

```bash
git add vibes/garage-sale/_run.sh
git commit -m "feat: add garage-sale vibe generation script"
```

---

## Task 2: Build the .hbs page

**Files:**
- Create: `src/pages/garage-sale.hbs`

- [ ] **Step 1: Create the page file**

Create `src/pages/garage-sale.hbs` with the full content below. Update any slugs if Task 1 required fallback slugs. Set `"author": "og"` and `"live": true` for all five apps once verified.

```handlebars
{{!--
{
  "layout": "webring",
  "title": "For Garage Sales | Vibes DIY",
  "description": "The Coordinator, Sale Poster, Rate My Thrift, Gear List, Cash Box. Five apps for the person running the neighborhood sale.",
  "ogUrl": "https://good.vibes.diy/garage-sale/",
  "source": "garage-sale",
  "apps": [
    {
      "num": "01",
      "slug": "group-sale-signup",
      "author": "og",
      "live": true,
      "title": "The Coordinator",
      "tagline": "One link. Everyone's in.",
      "desc": "Neighborhood garage sale coordinator. Organizer sets the date and address. Neighbors sign up with their spot preference, what they're selling, and whether they need change. Live participant list. Shared link, no login.",
      "fork": "Running a multi-block sale with assigned street sections? Clone it and add a street-segment field to each signup."
    },
    {
      "num": "02",
      "slug": "yard-sale-listing",
      "author": "og",
      "live": true,
      "title": "Sale Poster",
      "tagline": "Your sale. One link. Share anywhere.",
      "desc": "Yard sale listing with a shareable ?listing= URL. Enter address, date, hours, item categories. Share the link — anyone sees your sale card with address prominent and a Google Maps tap-to-navigate.",
      "fork": "Selling at a flea market stall instead of your driveway? Clone it and change the address field to stall number and venue name."
    },
    {
      "num": "03",
      "slug": "rate-my-thrift",
      "author": "og",
      "live": true,
      "title": "Rate My Thrift",
      "tagline": "Show off the find. Let the crowd judge.",
      "desc": "Post your thrift find — photo, price, where you got it, one-line brag. Each item gets a ?item= link you can paste anywhere. People rate it: 🔥 steal, 💎 gem, 😬 overpaid, 🤌 perfect. Reactions show live.",
      "fork": "Running a vintage market and want only your vendor's finds visible? Clone it and add a vendor filter to the feed."
    },
    {
      "num": "04",
      "slug": "sale-day-checklist",
      "author": "og",
      "live": true,
      "title": "Gear List",
      "tagline": "Tables, signs, bags — claimed or needed.",
      "desc": "Shared equipment tracker for group sales. Folding tables, chairs, extension cords, price stickers, bags, poster board, cash box. Neighbors claim what they're bringing. Shows what's still unclaimed.",
      "fork": "Hosting an estate sale with a professional setup list? Clone it and update the item list to match your specific needs."
    },
    {
      "num": "05",
      "slug": "cash-box-tracker",
      "author": "og",
      "live": true,
      "title": "Cash Box",
      "tagline": "Who sold what. Split at the end.",
      "desc": "Multi-seller cash tracker for group sales. Sellers register, then anyone logs a transaction: seller, item, amount. Running total per seller shown live. End-of-day split summary.",
      "fork": "Splitting proceeds with a charity? Clone it and add a charity percentage field that comes off the top before splitting."
    }
  ],
  "ogImage": "https://good.vibes.diy/images/screenshots/garage-sale.jpg"
}
--}}

<style>
  @import url("https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=optional");

  :root {
    --newsprint: #f2ede4;
    --ink: #1a1714;
    --rule: rgba(26,23,20,0.15);
    --rule-heavy: rgba(26,23,20,0.8);
    --muted: #6b6560;
    --accent: #c8102e;
    --accent-soft: rgba(200,16,46,0.08);
  }

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    background: var(--newsprint);
    color: var(--ink);
    font-family: "Inter", system-ui, sans-serif;
    line-height: 1.55;
    min-height: 100vh;
  }
  a { color: inherit; text-decoration: none; }

  .layout { max-width: 1080px; margin: 0 auto; padding: 0 1.5rem; }

  /* Broadsheet banner — thick rule with thin lines */
  .masthead-rule {
    height: 10px;
    background: var(--ink);
    border-top: 3px solid var(--accent);
  }

  .topbar {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 0.6rem 0;
    border-bottom: 3px double var(--ink);
    gap: 1rem;
  }
  .topbar .brand {
    font-family: "Playfair Display", serif; font-weight: 900;
    font-size: 1.4rem; letter-spacing: -0.01em;
  }
  .topbar .edition {
    font-family: "JetBrains Mono", monospace;
    font-size: 0.58rem; letter-spacing: 0.2em; text-transform: uppercase;
    color: var(--muted);
  }

  .crumb {
    padding: 0.45rem 0; font-size: 0.68rem; color: var(--muted);
    border-bottom: 1px solid var(--rule-heavy);
  }
  .crumb a:hover { color: var(--accent); }

  /* Hero — two-column broadsheet layout */
  .hero {
    padding: 2.5rem 0 2rem;
    border-bottom: 3px double var(--ink);
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 2.5rem;
    align-items: start;
  }
  @media (max-width: 760px) { .hero { grid-template-columns: 1fr; } }

  .hero-left {}
  .hero .kicker {
    font-family: "JetBrains Mono", monospace;
    font-size: 0.6rem; letter-spacing: 0.25em; text-transform: uppercase;
    color: var(--accent); font-weight: 700;
    border-top: 2px solid var(--accent);
    padding-top: 0.4rem;
    margin-bottom: 1rem;
    display: inline-block;
  }
  .hero h1 {
    font-family: "Playfair Display", serif;
    font-size: clamp(2.8rem, 6vw, 5rem);
    font-weight: 900; line-height: 0.95;
    letter-spacing: -0.02em;
    margin-bottom: 1rem;
  }
  .hero .dek {
    font-size: 1.1rem; line-height: 1.65;
    color: var(--muted); max-width: 500px;
    border-top: 1px solid var(--rule-heavy);
    padding-top: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .hero .cta-primary {
    display: inline-block;
    background: var(--ink); color: var(--newsprint);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.72rem; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700;
    padding: 0.75rem 1.5rem;
    border: 2px solid var(--ink);
    transition: background 0.12s, color 0.12s;
  }
  .hero .cta-primary:hover { background: var(--accent); border-color: var(--accent); }

  .hero-right {}
  .spotlight-shot {
    display: block; aspect-ratio: 16/9; overflow: hidden;
    border: 2px solid var(--ink);
    background: var(--rule);
  }
  .spotlight-shot img { width: 100%; height: 100%; object-fit: cover; }
  .shot-cap {
    font-family: "JetBrains Mono", monospace;
    font-size: 0.58rem; letter-spacing: 0.15em; text-transform: uppercase;
    color: var(--muted); padding-top: 0.4rem;
    border-top: 1px solid var(--rule-heavy); margin-top: 0.5rem;
  }

  /* Section rule */
  .section-rule {
    display: flex; align-items: baseline; gap: 0.75rem;
    padding: 1.25rem 0 0.75rem;
    border-bottom: 1px solid var(--rule-heavy);
    margin-bottom: 0;
  }
  .section-rule .label {
    font-family: "Playfair Display", serif; font-weight: 700;
    font-size: 1.1rem; white-space: nowrap;
  }
  .section-rule .rule-line {
    flex: 1; height: 1px; background: var(--rule-heavy); align-self: center;
  }
  .section-rule .count {
    font-family: "JetBrains Mono", monospace;
    font-size: 0.58rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted);
    white-space: nowrap;
  }

  /* App list */
  .apps { border-bottom: 3px double var(--ink); }
  .app {
    padding: 1.75rem 0;
    border-bottom: 1px solid var(--rule-heavy);
    display: grid;
    grid-template-columns: 56px 1fr 300px;
    gap: 1.75rem; align-items: start;
  }
  .app:last-child { border-bottom: none; }
  @media (max-width: 800px) { .app { grid-template-columns: 1fr; gap: 1rem; } }
  .app:hover { background: var(--accent-soft); margin: 0 -1.5rem; padding-left: 1.5rem; padding-right: 1.5rem; }

  .app .num-cell { display: flex; flex-direction: column; gap: 0.3rem; padding-top: 0.2rem; }
  .app .num {
    font-family: "Playfair Display", serif; font-weight: 900;
    font-size: 2.2rem; line-height: 0.9; letter-spacing: -0.02em;
    color: rgba(26,23,20,0.12);
  }
  .app--live .num { color: var(--accent); }
  .app .status {
    font-family: "JetBrains Mono", monospace;
    font-size: 0.48rem; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700;
    padding: 2px 5px; border: 1px solid var(--rule-heavy);
    color: var(--muted); text-align: center;
  }
  .app--live .status { background: var(--ink); color: var(--newsprint); border-color: var(--ink); }

  .app .body { display: flex; flex-direction: column; gap: 0.5rem; }
  .app .body .title {
    font-family: "Playfair Display", serif; font-size: 1.75rem; font-weight: 900;
    line-height: 1.0; letter-spacing: -0.01em;
  }
  .app .body .tagline {
    font-family: "JetBrains Mono", monospace;
    font-size: 0.75rem; color: var(--accent); font-weight: 700;
    letter-spacing: 0.04em;
    border-left: 2px solid var(--accent); padding-left: 0.5rem;
  }
  .app .body .desc { font-size: 0.95rem; line-height: 1.6; color: var(--muted); }

  .app .right { display: flex; flex-direction: column; gap: 0.5rem; }
  .app .shot {
    display: block; aspect-ratio: 16/9; overflow: hidden;
    border: 1px solid var(--ink); background: rgba(26,23,20,0.06);
  }
  .app .shot img { width: 100%; height: 100%; object-fit: cover; }
  .app .shot-placeholder {
    padding: 1rem; height: 100%; display: flex; align-items: center; justify-content: center;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase;
    text-align: center; color: var(--muted);
  }
  .app .ctas {
    display: grid; grid-template-columns: repeat(3, 1fr);
    border: 1px solid var(--ink); overflow: hidden;
  }
  .app .ctas--single { grid-template-columns: 1fr; }
  .btn {
    text-align: center; padding: 0.5rem 0.4rem;
    background: transparent; border-right: 1px solid var(--rule-heavy);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700;
    color: var(--ink); cursor: pointer; transition: background 0.1s;
  }
  .btn:last-child { border-right: none; }
  .btn:hover { background: var(--ink); color: var(--newsprint); }
  .prompt-link {
    font-family: "JetBrains Mono", monospace;
    font-size: 0.62rem; color: var(--muted); text-decoration: underline;
  }
  .prompt-link:hover { color: var(--accent); }
  .fork-note {
    font-size: 0.7rem; color: var(--muted); line-height: 1.5;
    border-left: 2px solid var(--rule-heavy); padding-left: 0.6rem;
  }

  /* Epilogue */
  .epilogue {
    padding: 2.5rem 0;
    border-bottom: 3px double var(--ink);
    display: grid; grid-template-columns: 1fr 1fr; gap: 2.5rem;
  }
  @media (max-width: 700px) { .epilogue { grid-template-columns: 1fr; } }
  .epilogue .col-head {
    font-family: "Playfair Display", serif; font-weight: 700;
    font-size: 0.85rem; border-top: 2px solid var(--ink); padding-top: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .epilogue p { font-size: 0.95rem; line-height: 1.7; color: var(--muted); }
  .epilogue .hl { color: var(--ink); font-weight: 600; }

  footer {
    padding: 1rem 0;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted);
    display: flex; justify-content: space-between;
    border-top: 1px solid var(--rule-heavy);
  }
  footer a:hover { color: var(--accent); }
</style>

<div class="masthead-rule"></div>
<div class="layout">
  <header class="topbar">
    <a class="brand" href="https://links.vibes.diy/homepage">Vibes DIY</a>
    <span class="edition">Garage Sale Edition &middot; Five tools &middot; No login</span>
  </header>

  <nav class="crumb">
    <a href="/">Home</a> &nbsp;/&nbsp; Garage Sale
  </nav>

  {{#with apps.[0]}}
  <section class="hero">
    <div class="hero-left">
      <span class="kicker">Spotlight App</span>
      <h1>One link.<br/>Everyone's in.<br/>No group chat<br/>needed.</h1>
      <p class="dek">
        The Coordinator handles neighbor sign-ups, spot claims, and the
        who-needs-change list — so you can spend Saturday selling, not texting.
      </p>
      <a class="cta-primary" href="https://vibes.diy/vibe/{{author}}/{{slug}}">Start the Sign-Up &rarr;</a>
    </div>
    <div class="hero-right">
      <a class="spotlight-shot" href="https://vibes.diy/vibe/{{author}}/{{slug}}" aria-label="The Coordinator screenshot">
        <img src="https://{{slug}}--{{author}}.prod-v2.vibesdiy.net/screenshot.jpg" alt="The Coordinator" onerror="this.onerror=null; this.src='{{@root.assetPrefix}}images/og-preview.png';"/>
      </a>
      <p class="shot-cap">The Coordinator &mdash; clone it and change the address</p>
    </div>
  </section>
  {{/with}}

  <div class="section-rule">
    <span class="label">Also in this issue</span>
    <span class="rule-line"></span>
    <span class="count">4 more tools</span>
  </div>

  <section class="apps">
    {{#each apps}}
    {{#unless @first}}
    <article class="app {{#if live}}app--live{{else}}app--pending{{/if}}">
      <div class="num-cell">
        <div class="num">{{num}}</div>
        <div class="status">{{#if live}}Live{{else}}Soon{{/if}}</div>
      </div>
      <div class="body">
        <h2 class="title">{{title}}</h2>
        <p class="tagline">{{tagline}}</p>
        <p class="desc">{{desc}}</p>
      </div>
      <div class="right">
        {{#if live}}
          <a class="shot" href="https://vibes.diy/vibe/{{author}}/{{slug}}" aria-label="{{title}} screenshot">
            <img src="https://{{slug}}--{{author}}.prod-v2.vibesdiy.net/screenshot.jpg" alt="{{slug}}" onerror="this.onerror=null; this.src='{{@root.assetPrefix}}images/og-preview.png';"/>
          </a>
          <div class="ctas">
            <a class="btn" href="https://vibes.diy/vibe/{{author}}/{{slug}}">Join</a>
            <a class="btn" href="https://vibes.diy/clone/{{author}}/{{slug}}">Clone</a>
            <a class="btn" href="https://vibes.diy/remix/{{author}}/{{slug}}">Remix</a>
          </div>
          <a class="prompt-link" href="https://vibes.diy/chat/prompt?prompt64={{prompt64 desc}}">// start fresh from this prompt</a>
          {{#if fork}}<p class="fork-note">{{fork}}</p>{{/if}}
        {{else}}
          <div class="shot"><div class="shot-placeholder">generating</div></div>
          <div class="ctas ctas--single">
            <a class="btn" href="https://vibes.diy/chat/prompt?prompt64={{prompt64 desc}}">Start From Prompt</a>
          </div>
        {{/if}}
      </div>
    </article>
    {{/unless}}
    {{/each}}
  </section>

  <div class="epilogue">
    <div>
      <div class="col-head">The situation</div>
      <p>
        Every neighborhood sale runs on <span class="hl">one person</span> who texted everyone,
        tracked who said yes, figured out who needed change, and showed up first with the folding tables.
        These five apps are sized to that exact job: one shared link, no login, everything visible to
        everyone who needs it.
      </p>
    </div>
    <div>
      <div class="col-head">Make it yours</div>
      <p>
        These were built for a generic neighborhood sale — a Saturday morning, five houses, one cash box.
        Your sale has a specific block, specific regulars, specific recurring arguments about who gets
        the corner spot. <span class="hl">Clone whichever fits closest</span> and describe your situation.
      </p>
    </div>
  </div>

  {{> newsletter}}
  <footer>
    <span>Vibes.diy &middot; <a href="https://links.vibes.diy/homepage">homepage</a> &middot; <a href="https://links.vibes.diy/discord">discord</a></span>
    <span>Garage Sale Edition</span>
  </footer>
</div>
```

- [ ] **Step 2: Build and open**

```bash
pnpm check
open _site/garage-sale.html
```

Expected: page renders with broadsheet aesthetic, hero shows Coordinator screenshot, four gallery cards below.

- [ ] **Step 3: Commit the page**

```bash
git add src/pages/garage-sale.hbs
git commit -m "feat: add garage-sale landing page with broadsheet skin"
```

---

## Task 3: Wire into homepage and screenshot list

**Files:**
- Modify: `src/pages/index.hbs`
- Modify: `screenshot-pages.js`

- [ ] **Step 1: Add CSS for the garage-sale card in index.hbs**

In `src/pages/index.hbs`, find the block of `.landing-card` CSS rules (around line 285). Add after the last `.landing-card` rule in that block:

```css
        .landing-card.garage-sale      { border-color: #c8102e; }
        .landing-card.garage-sale:hover { background: linear-gradient(135deg, #fff 0%, #fff0f0 100%); }
```

- [ ] **Step 2: Add the card in the cards-container in index.hbs**

In `src/pages/index.hbs`, find the first `<a href="growth-writers.html"` card (line ~682, the first card in the "For Your Situation" section). Insert the new card **before** it so it appears first:

```html
            <a href="garage-sale.html" class="landing-card garage-sale">
                <div class="card-icon">🏷</div>
                <h2 class="card-title">Garage Sale</h2>
                <p class="card-description">The Coordinator, Sale Poster, Rate My Thrift, Gear List, Cash Box. Five apps for the person running the neighborhood sale.</p>
                <span class="card-cta">Start the Sign-Up →</span>
            </a>
```

- [ ] **Step 3: Add to screenshot-pages.js**

In `screenshot-pages.js`, find the `SLUGS` array (line 22). Add `"garage-sale"` to it (alphabetical order puts it after `"fantasy-league"` and before `"golf-league"`):

```js
  "garage-sale",
```

- [ ] **Step 4: Build and verify the homepage card**

```bash
pnpm check
open _site/index.html
```

Expected: garage-sale card appears first in the "For Your Situation" grid.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.hbs screenshot-pages.js
git commit -m "feat: wire garage-sale into homepage and screenshot list"
```

---

## Task 4: Capture OG screenshot and finalize

**Files:**
- Create: `images/screenshots/garage-sale.jpg`

- [ ] **Step 1: Capture the screenshot**

```bash
pnpm check
node screenshot-pages.js garage-sale
```

Expected: `images/screenshots/garage-sale.jpg` created.

- [ ] **Step 2: Verify the screenshot file is real**

```bash
file images/screenshots/garage-sale.jpg
ls -lh images/screenshots/garage-sale.jpg
```

Expected: JPEG image data, size > 20K. If it's tiny or not JPEG, re-run `node screenshot-pages.js garage-sale`.

- [ ] **Step 3: Confirm ogImage is in the frontmatter**

The .hbs frontmatter already includes:
```json
"ogImage": "https://good.vibes.diy/images/screenshots/garage-sale.jpg"
```

No edit needed — verify it's there with a quick scan of the file top.

- [ ] **Step 4: Final build check**

```bash
pnpm check
open _site/garage-sale.html
```

Verify: hero loads Coordinator screenshot, gallery shows four app cards with screenshots, footer renders.

- [ ] **Step 5: Final commit**

```bash
git add images/screenshots/garage-sale.jpg
git commit -m "feat: add garage-sale OG screenshot"
```

---

## Self-review notes

- Spec requires `?listing=doc._id` for Sale Poster → included in generation prompt (Task 1, Step 1)
- Spec requires `?item=doc._id` routing + emoji reactions for Rate My Thrift → included in detailed prompt
- Spec requires broadsheet skin → Playfair Display headlines, newsprint background `#f2ede4`, ink rules, accent red `#c8102e`
- Spotlight app (01) uses `{{#with apps.[0]}}` — safe Handlebars array index notation, no custom helper needed.
- The `{{#unless @first}}` in the gallery skips the spotlight in the gallery loop — correct.
- `--user-slug og` is pinned in the run script — correct.
- No prettier on .hbs files — not touched.
