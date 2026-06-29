# Group Chat Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch `good.vibes.diy/group-chat/` — four group chat modifier apps (Reply Roulette, Pirate Mode, Colbert's Here, Mood Board) in a Hot Chat amber neobrutalist skin, double-upgraded, wired into the homepage.

**Architecture:** Generate 4 apps via vibes-diy CLI → verify deploys → two rounds of parallel screenshot/fix/push upgrades → build the .hbs page → wire into indexes → OG screenshot → commit.

**Tech Stack:** Handlebars static site (build.js), vibes-diy CLI (tsx), Fireproof-backed React apps, Meta ads via create-meta-ad.js.

---

## Files

| Action | File |
|---|---|
| Create | `vibes/group-chat/_run.sh` |
| Create | `vibes/group-chat/_pull.sh` |
| Create | `src/pages/group-chat.hbs` |
| Modify | `src/pages/index.hbs` (CSS + card) |
| Modify | `src/pages/about.hbs` (list item) |
| Modify | `screenshot-pages.js` (add slug) |

---

## Task 1: Create generation script

**Files:**
- Create: `vibes/group-chat/_run.sh`

- [ ] Create `vibes/group-chat/` directory and write `_run.sh`:

```bash
#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/group-chat"
USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen group-reply-picker "Reply Roulette — a group chat reply assistant. Given an incoming message, the app generates four reply options ranked from smart to saucy: A (Thoughtful — articulate and genuine), B (Agreeable — casual and affirming), C (Playful — has some edge), D (Unhinged — chaotic and funny). Optional human input: a second field lets the user type their own draft; buttons POST IT (sends draft as-is to the thread) or USE AS SEED (generates four A/B/C/D variations of the draft). Auto mode toggle: in auto mode two players alternate — Player 1 pastes an incoming message, app auto-selects B or C and posts it, that reply becomes Player 2's incoming message, repeat. Result is a full conversation neither person typed. Conversation thread accumulates in Fireproof with each entry showing player label, message text, and option badge (A/B/C/D/YOURS). Session shared by URL. Data model: turn doc { id, player: 'p1'|'p2', incoming, option: 'a'|'b'|'c'|'d'|'human', text, ts }. The A/B/C/D labels should be visually distinct — a gradient from calm/cool for A to chaotic/red for D. Auto mode toggle should feel satisfying. Whole app should feel alive and fast, like a messaging app with personality."

gen pirate-chat-filter "Paste a message, get back a pirate translation. Shared session where the thread shows both the original and pirate version side by side. One-tap copy button to grab the pirate version and paste back to your real chat."

gen colbert-room "Drop any group chat topic or paste a recent message. The app responds as Stephen Colbert — a short satirical monologue with a build and a punchline. Works on anything: dinner plans, drama, sports takes. Stores past takes in Fireproof."

gen ambient-chat-art "Paste the last few messages from your group chat. The app generates an ambient image that captures the current vibe — non-literal, abstract color field and texture, not a scene illustration. Full-width display. Paste new messages to refresh. Stores past generations."

echo "ALL DONE" >> "$HERE/_status.log"
```

- [ ] Make it executable and run it:

```bash
chmod +x vibes/group-chat/_run.sh && bash vibes/group-chat/_run.sh
```

- [ ] Watch for completions (poll at 45s intervals):

```bash
tail -F vibes/group-chat/_status.log
```

Expected: four `DONE <slug> exit=0` lines then `ALL DONE`. If any `exit=1`, check `vibes/group-chat/<slug>.log` for error.

---

## Task 2: Verify all 4 apps are live (not stubs)

- [ ] Run the verify curl for each slug. Expected: `fsId` is a real CID (`z...`), not `"pending"`.

```bash
for slug in group-reply-picker pirate-chat-filter colbert-room ambient-chat-art; do
  echo "=== $slug ==="
  curl -sL "https://${slug}--og.prod-v2.vibesdiy.net/" | grep -oE '"fsId":"[^"]+"'
done
```

Expected output like:
```
=== group-reply-picker ===
"fsId":"zQmXxx..."
=== pirate-chat-filter ===
"fsId":"zQmYyy..."
...
```

If any shows `"fsId":"pending"`, that app is a stub. Pick a new SEO slug and re-run `gen` for just that app, then update all slug references in Tasks 3–7.

---

## Task 3: Pull App.jsx files locally

**Files:**
- Create: `vibes/group-chat/_pull.sh`
- Create: `vibes/group-chat/group-reply-picker/App.jsx`
- Create: `vibes/group-chat/pirate-chat-filter/App.jsx`
- Create: `vibes/group-chat/colbert-room/App.jsx`
- Create: `vibes/group-chat/ambient-chat-art/App.jsx`

- [ ] Create `vibes/group-chat/_pull.sh`:

```bash
#!/usr/bin/env bash
AUTHOR=og
BASE="https://%s--${AUTHOR}.prod-v2.vibesdiy.net/App.jsx"
DIR="$(cd "$(dirname "$0")" && pwd)"
SLUGS=(group-reply-picker pirate-chat-filter colbert-room ambient-chat-art)
for slug in "${SLUGS[@]}"; do
  mkdir -p "$DIR/$slug"
  curl -sfL "$(printf "$BASE" "$slug")" -o "$DIR/$slug/App.jsx" && echo "ok $slug" || echo "ERR $slug"
done
```

- [ ] Run it:

```bash
chmod +x vibes/group-chat/_pull.sh && bash vibes/group-chat/_pull.sh
```

Expected: `ok group-reply-picker`, `ok pirate-chat-filter`, `ok colbert-room`, `ok ambient-chat-art`

---

## Task 4: Upgrade round 1 — two parallel agents

Dispatch 2 agents simultaneously. Each agent follows the loop from `agents/parallel-upgrade-loop.md`.

**CLI vars for both agents:**
```
TSX=/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx
MAIN=/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts
```

- [ ] Dispatch Agent A — Reply Roulette + Pirate Mode:

> Upgrade these 2 apps in the landing-pages repo. For each app:
> 1. `curl -sfL "https://<slug>--og.prod-v2.vibesdiy.net/screenshot.jpg" -o /tmp/<slug>.jpg && wc -c /tmp/<slug>.jpg && file /tmp/<slug>.jpg`
> 2. Read `/tmp/<slug>.jpg` visually.
> 3. Read `/Users/jchris/code/landing-pages/vibes/group-chat/<slug>/App.jsx`.
> 4. Identify the most impactful real issue (broken layout, unreadable text, missing feature, bad contrast).
> 5. Edit App.jsx to fix it — improve, don't rewrite.
> 6. `cd /Users/jchris/code/landing-pages/vibes/group-chat/<slug> && /Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx /Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts push --user-slug og`
> 7. Sleep 8s, re-curl screenshot, read to verify improvement.
>
> Apps: `group-reply-picker` (A/B/C/D reply spectrum — verify spectrum is visible and auto mode toggle works), `pirate-chat-filter` (verify pirate translation shows clearly and copy button is obvious).

- [ ] Dispatch Agent B — Colbert + Mood Board:

> Same loop as above for these 2 apps:
> `colbert-room` (verify Colbert-style monologue output is readable and punchline formatting is clear), `ambient-chat-art` (verify image is full-width, abstract/ambient not literal, and paste-to-refresh flow is clear).

- [ ] Wait for both agents to complete before proceeding.

---

## Task 5: Upgrade round 2 — second pass

Same as Task 4, same agent split. Second-pass focus: polish over bug-fixing.

- [ ] Dispatch Agent A round 2 — Reply Roulette + Pirate Mode:

> Second upgrade pass. Re-pull current App.jsx from prod (re-run `_pull.sh` first), screenshot each, identify remaining issues — focus on visual polish, spacing, typography, UX clarity. Same loop: screenshot → read → identify → edit → push → verify.

- [ ] Dispatch Agent B round 2 — Colbert + Mood Board:

> Same second-pass polish loop for `colbert-room` and `ambient-chat-art`.

- [ ] Run `_pull.sh` once more to sync final App.jsx to disk:

```bash
bash vibes/group-chat/_pull.sh
```

---

## Task 6: Build group-chat.hbs

**Files:**
- Create: `src/pages/group-chat.hbs`

- [ ] Create `src/pages/group-chat.hbs` with the full Hot Chat skin:

```handlebars
{{!--
{
  "layout": "webring",
  "title": "Group Chat Mods | Vibes DIY",
  "description": "Reply Roulette, Pirate Mode, Colbert's Here, Mood Board. Four tools to remix how your group talks. Open source — clone any of them.",
  "ogUrl": "https://good.vibes.diy/group-chat/",
  "source": "group-chat"
}
--}}

<style>
  @import url('https://fonts.cdnfonts.com/css/alte-haas-grotesk');
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=optional');

  :root {
    --amber: #fbbf24;
    --amber-dark: #d97706;
    --amber-deep: #92400e;
    --ivory: #fffbeb;
    --ivory-warm: #fef3c7;
    --ink: #000000;
    --muted: #78350f;
    --card-shadow: 3px 3px 0 #000;
  }

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    font-family: 'Inter', system-ui, sans-serif;
    background: var(--ivory);
    color: var(--ink);
    line-height: 1.5;
  }

  a { color: inherit; text-decoration: none; }

  .layout { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; }

  /* NAV */
  .nav {
    background: var(--ivory);
    border-bottom: 2px solid var(--ink);
    padding: 0.85rem 0;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .nav-inner { display: flex; justify-content: space-between; align-items: center; }
  .nav-logo {
    font-family: 'Alte Haas Grotesk', sans-serif;
    font-weight: 700;
    font-size: 1.1rem;
    letter-spacing: 0.04em;
  }
  .nav-back { font-size: 0.82rem; color: var(--amber-dark); font-weight: 600; }
  .nav-back:hover { text-decoration: underline; }

  /* HERO */
  .hero {
    background: var(--amber);
    border-bottom: 3px solid var(--ink);
    padding: 3.5rem 0;
  }
  .hero-badge {
    display: inline-block;
    background: var(--ink);
    color: var(--amber);
    font-family: 'Alte Haas Grotesk', sans-serif;
    font-size: 0.68rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    font-weight: 700;
    padding: 3px 12px;
    margin-bottom: 1rem;
  }
  .hero h1 {
    font-family: 'Alte Haas Grotesk', sans-serif;
    font-size: clamp(2.4rem, 6vw, 4rem);
    font-weight: 700;
    line-height: 1.08;
    margin-bottom: 1rem;
  }
  .hero-sub {
    font-size: 1.05rem;
    color: var(--muted);
    max-width: 520px;
    margin-bottom: 1.8rem;
    line-height: 1.6;
  }
  .hero-ctas { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .btn-primary {
    background: var(--ink); color: var(--amber);
    font-family: 'Alte Haas Grotesk', sans-serif;
    font-size: 0.85rem; letter-spacing: 0.08em; font-weight: 700;
    padding: 0.65rem 1.4rem; border: 2px solid var(--ink); text-transform: uppercase;
  }
  .btn-outline {
    background: transparent; color: var(--ink);
    font-family: 'Alte Haas Grotesk', sans-serif;
    font-size: 0.85rem; letter-spacing: 0.08em; font-weight: 700;
    padding: 0.65rem 1.4rem; border: 2px solid var(--ink); text-transform: uppercase;
  }
  .btn-primary:hover { background: var(--amber-deep); border-color: var(--amber-deep); }
  .btn-outline:hover { background: var(--ink); color: var(--amber); }

  /* APP LEAD */
  .app-lead {
    padding: 3rem 0;
    border-bottom: 3px solid var(--ink);
  }
  .app-lead-inner {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 2.5rem;
    align-items: start;
  }
  @media (max-width: 720px) { .app-lead-inner { grid-template-columns: 1fr; } }
  .app-lead h2 {
    font-family: 'Alte Haas Grotesk', sans-serif;
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    font-weight: 700;
    line-height: 1.1;
    margin-bottom: 0.4rem;
  }
  .app-tagline { font-size: 1rem; font-weight: 600; color: var(--amber-dark); margin-bottom: 0.6rem; }
  .app-desc { font-size: 0.95rem; color: #444; line-height: 1.65; margin-bottom: 1.1rem; }
  .spectrum-preview {
    background: var(--ivory-warm);
    border: 2px solid var(--amber-dark);
    padding: 0.9rem 1rem;
    margin-bottom: 1.2rem;
    display: flex; flex-direction: column; gap: 0.45rem;
  }
  .spectrum-row { display: flex; gap: 0.6rem; align-items: baseline; font-size: 0.87rem; }
  .sl {
    font-family: 'Alte Haas Grotesk', sans-serif;
    font-size: 0.68rem; font-weight: 700;
    padding: 1px 6px; min-width: 22px; text-align: center; flex-shrink: 0;
  }
  .sl-a, .sl-b { background: var(--ink); color: var(--amber); }
  .sl-c { background: var(--amber-dark); color: #fff; }
  .sl-d { background: #dc2626; color: #fff; }
  .app-links { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .app-link {
    font-family: 'Alte Haas Grotesk', sans-serif;
    font-size: 0.68rem; letter-spacing: 0.12em; font-weight: 700; text-transform: uppercase;
    padding: 4px 10px; border: 2px solid var(--ink);
  }
  .app-link.primary { background: var(--amber); }
  .app-link:hover { background: var(--ink); color: var(--ivory); }
  .app-shot {
    border: 3px solid var(--ink);
    box-shadow: var(--card-shadow);
    overflow: hidden;
    aspect-ratio: 4/3;
    background: var(--ivory-warm);
  }
  .app-shot img { width: 100%; height: 100%; object-fit: cover; display: block; }

  /* GALLERY */
  .gallery { padding: 2.5rem 0; border-bottom: 3px solid var(--ink); background: #fff8e1; }
  .gallery-label {
    font-family: 'Alte Haas Grotesk', sans-serif;
    font-size: 0.62rem; letter-spacing: 0.22em; text-transform: uppercase;
    color: #888; font-weight: 700; margin-bottom: 1.2rem;
  }
  .gallery-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem; }
  @media (max-width: 560px) { .gallery-grid { grid-template-columns: 1fr; } }
  .gallery-card {
    background: var(--ivory);
    border: 3px solid var(--ink);
    box-shadow: var(--card-shadow);
    padding: 1.2rem;
  }
  .gallery-card-title {
    font-family: 'Alte Haas Grotesk', sans-serif;
    font-size: 1.1rem; font-weight: 700; margin-bottom: 0.35rem;
  }
  .gallery-card-desc { font-size: 0.87rem; color: #555; line-height: 1.55; margin-bottom: 0.8rem; }
  .gallery-shot {
    width: 100%; aspect-ratio: 4/3;
    background: var(--ivory-warm);
    border: 2px solid var(--amber-dark);
    overflow: hidden; margin-bottom: 0.8rem;
  }
  .gallery-shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .gallery-links {
    font-family: 'Alte Haas Grotesk', sans-serif;
    font-size: 0.65rem; letter-spacing: 0.1em; font-weight: 700;
    text-transform: uppercase; color: var(--amber-dark);
    display: flex; gap: 0.4rem; align-items: center;
  }
  .gallery-links a:hover { text-decoration: underline; }
  .gallery-links .sep { color: #ccc; }

  /* MOOD HERO */
  .mood-hero {
    background: linear-gradient(135deg, #1c1917, #292524);
    border-top: 3px solid var(--ink);
    border-bottom: 3px solid var(--ink);
    padding: 3.5rem 0;
    position: relative; overflow: hidden;
  }
  .mood-hero::before {
    content: '';
    position: absolute; inset: 0;
    background: repeating-linear-gradient(
      45deg,
      rgba(251,191,36,0.03) 0, rgba(251,191,36,0.03) 1px,
      transparent 1px, transparent 24px
    );
    pointer-events: none;
  }
  .mood-inner { position: relative; z-index: 1; }
  .mood-label {
    font-family: 'Alte Haas Grotesk', sans-serif;
    font-size: 0.62rem; letter-spacing: 0.28em; text-transform: uppercase;
    color: var(--amber); font-weight: 700; margin-bottom: 0.6rem;
  }
  .mood-hero h2 {
    font-family: 'Alte Haas Grotesk', sans-serif;
    font-size: clamp(2rem, 5vw, 3.5rem);
    font-weight: 700; color: #fff; line-height: 1.1; margin-bottom: 0.7rem;
  }
  .mood-desc {
    font-size: 1rem; color: #a8a29e;
    max-width: 520px; line-height: 1.6; margin-bottom: 1.8rem;
  }
  .mood-samples {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 0.75rem; margin-bottom: 1.8rem; max-width: 640px;
  }
  .mood-sample {
    aspect-ratio: 4/3; overflow: hidden;
    border: 2px solid rgba(251,191,36,0.3);
  }
  .mood-sample img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .mood-links { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .btn-amber {
    background: var(--amber); color: var(--ink);
    font-family: 'Alte Haas Grotesk', sans-serif;
    font-size: 0.85rem; letter-spacing: 0.08em; font-weight: 700;
    padding: 0.65rem 1.4rem; border: 2px solid var(--amber); text-transform: uppercase;
  }
  .btn-amber-outline {
    background: transparent; color: var(--amber);
    font-family: 'Alte Haas Grotesk', sans-serif;
    font-size: 0.85rem; letter-spacing: 0.08em; font-weight: 700;
    padding: 0.65rem 1.4rem; border: 2px solid var(--amber); text-transform: uppercase;
  }
  .btn-amber:hover { background: var(--amber-dark); border-color: var(--amber-dark); }
  .btn-amber-outline:hover { background: var(--amber); color: var(--ink); }

  /* CTA FOOTER */
  .cta-footer { background: var(--ink); color: var(--amber); padding: 2.5rem 0; text-align: center; }
  .cta-footer h2 {
    font-family: 'Alte Haas Grotesk', sans-serif;
    font-size: clamp(1.4rem, 3vw, 2rem); font-weight: 700; margin-bottom: 0.5rem;
  }
  .cta-footer p { font-size: 0.9rem; color: #a16207; margin-bottom: 1.4rem; }
</style>

<!-- NAV -->
<nav class="nav">
  <div class="layout nav-inner">
    <a class="nav-logo" href="https://links.vibes.diy/homepage">Vibes DIY</a>
    <a class="nav-back" href="https://good.vibes.diy/">← all tools</a>
  </div>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="layout">
    <div class="hero-badge">Make it yours</div>
    <h1>Your group chat.<br/>Your rules.</h1>
    <p class="hero-sub">Four tools that remix how your group talks. Open source — clone any of them and make the experience yours.</p>
    <div class="hero-ctas">
      <a class="btn-primary" href="https://vibes.diy/vibe/og/group-reply-picker">Try Reply Roulette</a>
      <a class="btn-outline" href="#mods">See all apps ↓</a>
    </div>
  </div>
</section>

<!-- REPLY ROULETTE -->
<section class="app-lead" id="mods">
  <div class="layout">
    <div class="app-lead-inner">
      <div>
        <h2>Reply Roulette</h2>
        <p class="app-tagline">Four AI replies, ranked from smart to saucy.</p>
        <p class="app-desc">Pick one, write your own, or flip on auto mode and let two people have a whole conversation without typing a word.</p>
        <div class="spectrum-preview">
          <div class="spectrum-row"><span class="sl sl-a">A</span><span>That makes total sense, I see where you're coming from.</span></div>
          <div class="spectrum-row"><span class="sl sl-b">B</span><span>Yeah honestly same, no notes.</span></div>
          <div class="spectrum-row"><span class="sl sl-c">C</span><span>Bold take. I respect the chaos.</span></div>
          <div class="spectrum-row"><span class="sl sl-d">D</span><span>Absolutely unhinged, I'm in.</span></div>
        </div>
        <div class="app-links">
          <a class="app-link primary" href="https://vibes.diy/vibe/og/group-reply-picker">Join</a>
          <a class="app-link" href="https://vibes.diy/clone/og/group-reply-picker">Clone</a>
          <a class="app-link" href="https://vibes.diy/remix/og/group-reply-picker">Remix</a>
          <a class="app-link" href="https://vibes.diy/chat/prompt?prompt64={{prompt64 'Reply Roulette — four AI replies ranked smart to saucy, with optional human message and auto mode'}}">Start fresh</a>
        </div>
      </div>
      <div>
        <div class="app-shot">
          <img
            src="https://group-reply-picker--og.prod-v2.vibesdiy.net/screenshot.jpg"
            alt="Reply Roulette"
            onerror="this.onerror=null; this.src='{{assetPrefix}}images/og-preview.png';"
          />
        </div>
      </div>
    </div>
  </div>
</section>

<!-- GALLERY -->
<section class="gallery">
  <div class="layout">
    <div class="gallery-label">More mods</div>
    <div class="gallery-grid">

      <div class="gallery-card">
        <div class="gallery-card-title">Pirate Mode ☠️</div>
        <p class="gallery-card-desc">Every message, rewritten in pirate. Paste in what they said — get back what a pirate would've said.</p>
        <div class="gallery-shot">
          <img
            src="https://pirate-chat-filter--og.prod-v2.vibesdiy.net/screenshot.jpg"
            alt="Pirate Mode"
            onerror="this.onerror=null; this.src='{{assetPrefix}}images/og-preview.png';"
          />
        </div>
        <div class="gallery-links">
          <a href="https://vibes.diy/vibe/og/pirate-chat-filter">Join</a>
          <span class="sep">·</span>
          <a href="https://vibes.diy/clone/og/pirate-chat-filter">Clone</a>
          <span class="sep">·</span>
          <a href="https://vibes.diy/remix/og/pirate-chat-filter">Remix</a>
        </div>
      </div>

      <div class="gallery-card">
        <div class="gallery-card-title">Colbert's Here 🎙️</div>
        <p class="gallery-card-desc">The man himself weighs in on your thread. Drop your topic — get a hot take with a punchline.</p>
        <div class="gallery-shot">
          <img
            src="https://colbert-room--og.prod-v2.vibesdiy.net/screenshot.jpg"
            alt="Colbert's Here"
            onerror="this.onerror=null; this.src='{{assetPrefix}}images/og-preview.png';"
          />
        </div>
        <div class="gallery-links">
          <a href="https://vibes.diy/vibe/og/colbert-room">Join</a>
          <span class="sep">·</span>
          <a href="https://vibes.diy/clone/og/colbert-room">Clone</a>
          <span class="sep">·</span>
          <a href="https://vibes.diy/remix/og/colbert-room">Remix</a>
        </div>
      </div>

    </div>
  </div>
</section>

<!-- MOOD BOARD BOTTOM HERO -->
<section class="mood-hero">
  <div class="layout mood-inner">
    <div class="mood-label">Ambient</div>
    <h2>Mood Board</h2>
    <p class="mood-desc">Your last few messages become an image. The vibe, visualized. Refreshes as the conversation moves.</p>
    <div class="mood-samples">
      <div class="mood-sample">
        <img
          src="https://ambient-chat-art--og.prod-v2.vibesdiy.net/screenshot.jpg"
          alt="Mood Board"
          onerror="this.onerror=null; this.src='{{assetPrefix}}images/og-preview.png';"
        />
      </div>
      <div class="mood-sample" style="opacity:0.7;">
        <img
          src="https://ambient-chat-art--og.prod-v2.vibesdiy.net/screenshot.jpg"
          alt="Mood Board vibe 2"
          onerror="this.onerror=null; this.src='{{assetPrefix}}images/og-preview.png';"
        />
      </div>
      <div class="mood-sample" style="opacity:0.4;">
        <img
          src="https://ambient-chat-art--og.prod-v2.vibesdiy.net/screenshot.jpg"
          alt="Mood Board vibe 3"
          onerror="this.onerror=null; this.src='{{assetPrefix}}images/og-preview.png';"
        />
      </div>
    </div>
    <div class="mood-links">
      <a class="btn-amber" href="https://vibes.diy/vibe/og/ambient-chat-art">Join</a>
      <a class="btn-amber-outline" href="https://vibes.diy/clone/og/ambient-chat-art">Clone it</a>
      <a class="btn-amber-outline" href="https://vibes.diy/remix/og/ambient-chat-art">Remix</a>
    </div>
  </div>
</section>

<!-- CTA FOOTER -->
<footer class="cta-footer">
  <div class="layout">
    <h2>Build your own mod →</h2>
    <p>Start from any of these or prompt from scratch on vibes.diy</p>
    <a class="btn-amber" href="https://links.vibes.diy/homepage">Open Vibes DIY</a>
  </div>
</footer>
```

---

## Task 7: Wire into index.hbs

**Files:**
- Modify: `src/pages/index.hbs`

- [ ] Add CSS rule for `.landing-card.group-chat` — insert after the `.landing-card.free-library:hover` rule:

```css
        .landing-card.group-chat     { border-color: #d97706; }
        .landing-card.group-chat:hover { background: linear-gradient(135deg, #fff 0%, #fffbeb 100%); }
```

- [ ] Add the card HTML — insert near the top of the cards grid (after free-library or before block-party):

```html
            <a href="group-chat.html" class="landing-card group-chat">
                <div class="card-icon">💬</div>
                <h2 class="card-title">For Group Chats</h2>
                <p class="card-description">Reply Roulette, Pirate Mode, Colbert's Here, Mood Board. Remix how your group talks.</p>
                <span class="card-cta">Make It Yours →</span>
            </a>
```

---

## Task 8: Wire into about.hbs

**Files:**
- Modify: `src/pages/about.hbs`

- [ ] Add list item — insert near existing audience page entries:

```html
    <a class="list-item" href="group-chat.html">
      <span class="li-name">Group Chat Mods</span>
      <span class="li-desc">Reply Roulette, Pirate Mode, Colbert's Here, Mood Board — remix how your group talks</span>
      <span class="li-arrow">→</span>
    </a>
```

---

## Task 9: Build and preview

- [ ] Run build:

```bash
pnpm check
```

Expected: build completes with no errors. If there are Handlebars template errors, check frontmatter JSON syntax in `group-chat.hbs`.

- [ ] Open the built page:

```bash
open _site/group-chat.html
```

Verify visually: nav, amber hero, Reply Roulette section with spectrum preview, gallery 2-col, dark Mood Board hero, black CTA footer. Screenshots may show fallback image if apps aren't live yet — that's OK.

---

## Task 10: Add slug to screenshot-pages.js and capture OG screenshot

**Files:**
- Modify: `screenshot-pages.js`

- [ ] Add `'group-chat'` to the `SLUGS` array in `screenshot-pages.js`.

- [ ] Rebuild and capture:

```bash
pnpm check && node screenshot-pages.js
```

- [ ] Verify the screenshot is a real JPEG (≥10KB):

```bash
wc -c images/screenshots/group-chat.jpg && file images/screenshots/group-chat.jpg
```

Expected: size ≥ 10000 bytes, type `JPEG image data`.

- [ ] Add `ogImage` to the frontmatter in `group-chat.hbs` — update the frontmatter block to:

```json
{
  "layout": "webring",
  "title": "Group Chat Mods | Vibes DIY",
  "description": "Reply Roulette, Pirate Mode, Colbert's Here, Mood Board. Four tools to remix how your group talks. Open source — clone any of them.",
  "ogUrl": "https://good.vibes.diy/group-chat/",
  "source": "group-chat",
  "ogImage": "https://good.vibes.diy/images/screenshots/group-chat.jpg"
}
```

- [ ] Rebuild to verify ogImage is wired:

```bash
pnpm check
```

---

## Task 11: Prettier + commit

- [ ] Run prettier on all modified non-hbs files:

```bash
npx prettier --write src/pages/index.hbs screenshot-pages.js
```

Wait — `src/pages/*.hbs` files are excluded from prettier per `.prettierignore`. Only run on `screenshot-pages.js`:

```bash
npx prettier --write screenshot-pages.js
```

- [ ] Stage and commit:

```bash
git add src/pages/group-chat.hbs src/pages/index.hbs src/pages/about.hbs \
  screenshot-pages.js images/screenshots/group-chat.jpg \
  vibes/group-chat/
git commit -m "$(cat <<'EOF'
feat: group-chat page — Reply Roulette, Pirate Mode, Colbert's Here, Mood Board

Hot Chat amber neobrutalist skin. Reply Roulette leads with A→D smart-to-saucy
spectrum and auto mode. Full-width Mood Board bottom hero. Double upgrade cycle
applied to all 4 apps. Wired into index + about.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] Open final built page for review:

```bash
open _site/group-chat.html
```
