# Zine Collective Landing Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `src/pages/zine.hbs` — an SRL-aesthetic collage landing page for zine/band/collective creators — with 6 deployed vibes apps, wired into the site indexes, with OG screenshot.

**Architecture:** Single webring-layout `.hbs` page. Collage zone uses absolutely-positioned overlapping elements (portrait, notation sheet, stickers) over a dark tape-grid background. App demo cards are rendered via `{{#each apps}}` from frontmatter. All photos get CSS halftone filter treatment. FB ad copy goes in `agents/fb-ads-zine.md`.

**Tech Stack:** Handlebars `.hbs`, inline CSS (Special Elite + Caveat from Google Fonts), `vibes-diy` CLI for app generation, `pnpm check` build, `node screenshot-pages.js` for OG capture.

**Spec:** `docs/superpowers/specs/2026-05-26-zine-collective-page-design.md`

---

## Files

| File | Action |
|---|---|
| `src/pages/zine.hbs` | Create — full webring page |
| `src/pages/index.hbs` | Modify — add zine landing card + CSS |
| `src/pages/about.hbs` | Modify — add list entry |
| `screenshot-pages.js` | Modify — add `'zine'` to SLUGS |
| `images/screenshots/zine.jpg` | Capture |
| `agents/fb-ads-zine.md` | Create — ad copy doc |
| `vibes/zine/_run.sh` | Create — batch generation script |
| `vibes/zine/_status.log` | Created by _run.sh |

---

## Task 1: Enter worktree

- [ ] Enter isolated git worktree via `EnterWorktree` tool (branch: `feat/zine-page`)

---

## Task 2: Generate 6 apps in background

- [ ] Create `vibes/zine/` directory

```bash
mkdir -p vibes/zine
```

- [ ] Create `vibes/zine/_run.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
LOG="$(dirname "$0")/_status.log"
: > "$LOG"

gen() {
  local slug="$1"; local prompt="$2"
  npx vibes-diy@latest generate --user-slug=og --app-slug="$slug" "$prompt" \
    >> "$LOG" 2>&1 &
  echo "STARTED $slug" >> "$LOG"
}

gen ghost-static-band \
  "Band website with mp3 player. Upload tracks, show upcoming shows, let approved bandmates post updates. Dark industrial aesthetic."

gen rough-draft-zine \
  "Online zine with multiple contributors. Editor approves writers. Anyone can read. Issue-based layout, xerox aesthetic."

gen dead-letter-press \
  "Art collective archive. Upload images, prints, photos. Public gallery. Approved members can add work. Minimal, dark."

gen void-transmissions \
  "Noise and experimental music collective. Share recordings, show dates, field reports. Approved crew posts. Industrial, text-heavy."

gen silver-archive \
  "Personal photo zine. Upload images in batches as issues. Public archive. One editor, no contributors needed."

gen dispatch-bureau \
  "Writers collective. Submit pieces, editor approves. Public reading room. Issue-based. Typewriter aesthetic."

echo "ALL_STARTED" >> "$LOG"
wait
echo "ALL_DONE" >> "$LOG"
```

- [ ] Make executable and run in background:

```bash
chmod +x vibes/zine/_run.sh
bash vibes/zine/_run.sh
```

- [ ] Note: generation takes 3–6 minutes per app. Continue with Tasks 3–6 while apps generate. Poll `vibes/zine/_status.log` at 45s intervals.

---

## Task 3: Create `src/pages/zine.hbs`

- [ ] Create the full page file. **Do NOT run prettier on this file.**

```handlebars
{{!--
{
  "layout": "webring",
  "title": "Your World. Your Signal. | Vibes DIY",
  "description": "Build a zine, a band site, an art archive. Public reads. You decide who writes. Full style control. No templates.",
  "ogUrl": "https://good.vibes.diy/zine/",
  "source": "zine-collective",
  "apps": [
    {
      "num": "01",
      "slug": "ghost-static-band",
      "author": "og",
      "live": false,
      "category": "band site",
      "title": "Ghost Static",
      "tagline": "Upload tracks. Approved bandmates post. World listens."
    },
    {
      "num": "02",
      "slug": "rough-draft-zine",
      "author": "og",
      "live": false,
      "category": "zine collective",
      "title": "Rough Draft",
      "tagline": "Editor curates. Approved writers contribute. Anyone reads."
    },
    {
      "num": "03",
      "slug": "dead-letter-press",
      "author": "og",
      "live": false,
      "category": "art archive",
      "title": "Dead Letter Press",
      "tagline": "Public gallery. Approved members add work. Locked studio."
    },
    {
      "num": "04",
      "slug": "void-transmissions",
      "author": "og",
      "live": false,
      "category": "noise collective",
      "title": "Void Transmissions",
      "tagline": "Recordings, dates, field reports. Approved crew only."
    },
    {
      "num": "05",
      "slug": "silver-archive",
      "author": "og",
      "live": false,
      "category": "photo zine",
      "title": "Silver Archive",
      "tagline": "Images in batches as issues. Public archive. Your edit."
    },
    {
      "num": "06",
      "slug": "dispatch-bureau",
      "author": "og",
      "live": false,
      "category": "writers collective",
      "title": "The Dispatch Bureau",
      "tagline": "Submit pieces. Editor approves. Public reading room."
    }
  ]
}
--}}
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Special+Elite&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --paper: #f0ead4;
  --ink: #111;
  --bg: #0d0d0d;
  --accent: #c8e020;
  --muted: #888;
}

html, body {
  background: var(--bg);
  color: var(--paper);
  font-family: 'Special Elite', 'Courier New', monospace;
  overflow-x: hidden;
}

a { color: inherit; text-decoration: none; }

/* ── CORNER MARKS ── */
.corner-mark {
  position: fixed;
  z-index: 9999;
  background: var(--accent);
  color: var(--ink);
  font-family: 'Special Elite', monospace;
  font-size: 1.1rem;
  font-weight: 900;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.corner-mark.tl { top: 0; left: 0; }
.corner-mark.tr { top: 0; right: 0; }
.corner-mark.bl { bottom: 0; left: 0; }
.corner-mark.br { bottom: 0; right: 0; }

/* ── HERO PHOTO ── */
.hero-photo {
  width: 100%;
  height: 52vh;
  min-height: 340px;
  position: relative;
  overflow: hidden;
}
.hero-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 40%;
  filter: grayscale(0.45) contrast(1.6) brightness(0.82) sepia(0.12);
  display: block;
}
.hero-photo::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, #000 1.1px, transparent 1.1px);
  background-size: 5px 5px;
  opacity: 0.22;
  pointer-events: none;
}
.hero-fade {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 45%;
  background: linear-gradient(to bottom, transparent, var(--bg));
  z-index: 2;
}

/* ── COLLAGE ZONE ── */
.collage-zone {
  position: relative;
  min-height: 600px;
  background: var(--bg);
  overflow: hidden;
}

.tape-grid {
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 79px, rgba(255,255,255,0.04) 79px, rgba(255,255,255,0.04) 80px),
    repeating-linear-gradient(90deg, transparent, transparent 79px, rgba(255,255,255,0.04) 79px, rgba(255,255,255,0.04) 80px);
  background-size: 80px 80px;
}

.bg-text-repeat {
  position: absolute;
  inset: 0;
  overflow: hidden;
  opacity: 0.06;
  color: #fff;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 2.4;
  word-spacing: 1.2rem;
  padding: 1rem;
  user-select: none;
  pointer-events: none;
}

/* portrait — large, screen blend, halftone */
.col-portrait {
  position: absolute;
  top: -55px;
  left: 55px;
  width: 270px;
  z-index: 10;
}
.col-portrait img {
  width: 100%;
  display: block;
  filter: grayscale(1) contrast(2.8) brightness(1.05);
  mix-blend-mode: screen;
}
.col-portrait::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, rgba(0,0,0,0.88) 1.1px, transparent 1.1px);
  background-size: 3.5px 3.5px;
  mix-blend-mode: multiply;
  pointer-events: none;
}

/* notation sheet — the handwritten score */
.col-notation {
  position: absolute;
  top: 28px;
  left: 305px;
  width: 310px;
  background: #f8f5ea;
  color: var(--ink);
  padding: 1.1rem;
  transform: rotate(1.4deg);
  z-index: 12;
  box-shadow: 4px 6px 22px rgba(0,0,0,0.65);
}
.col-notation::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2'%3E%3Crect width='1' height='1' x='0' y='0' fill='%23000' opacity='0.03'/%3E%3C/svg%3E");
  background-size: 2px 2px;
  pointer-events: none;
}
.tape-piece {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 48px;
  height: 18px;
  background: rgba(255,255,220,0.38);
  border: 1px solid rgba(200,200,150,0.25);
}
.notation-header {
  font-family: 'Caveat', cursive;
  font-size: 0.7rem;
  color: #444;
  margin-bottom: 0.45rem;
  line-height: 1.4;
  position: relative;
  z-index: 1;
}
.notation-title {
  font-family: 'Caveat', cursive;
  font-size: 2.4rem;
  font-weight: 700;
  color: var(--ink);
  line-height: 0.88;
  margin-bottom: 0.75rem;
  letter-spacing: -0.02em;
  position: relative;
  z-index: 1;
}
.notation-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.15rem 0.3rem;
  position: relative;
  z-index: 1;
}
.notation-item {
  font-family: 'Caveat', cursive;
  font-size: 0.82rem;
  color: #222;
  display: flex;
  gap: 0.35rem;
  align-items: baseline;
  padding: 0.05rem 0;
}
.notation-num {
  font-size: 0.62rem;
  color: #999;
  min-width: 1.1rem;
}
.notation-footer {
  margin-top: 0.7rem;
  font-family: 'Caveat', cursive;
  font-size: 0.6rem;
  color: #888;
  border-top: 1px solid #ddd;
  padding-top: 0.35rem;
  position: relative;
  z-index: 1;
}

/* small tilted photo */
.col-photo-b {
  position: absolute;
  top: 195px;
  left: 18px;
  width: 195px;
  transform: rotate(-2.4deg);
  z-index: 8;
  border: 3px solid var(--bg);
  box-shadow: 3px 5px 16px rgba(0,0,0,0.72);
}
.col-photo-b img {
  width: 100%;
  height: 160px;
  object-fit: cover;
  display: block;
  filter: grayscale(1) contrast(2.1) brightness(0.74);
}
.col-photo-b::after {
  content: '';
  position: absolute;
  inset: 0 0 22px 0;
  background-image: radial-gradient(circle, rgba(0,0,0,0.85) 0.9px, transparent 0.9px);
  background-size: 4px 4px;
  opacity: 0.25;
  pointer-events: none;
}
.photo-cap {
  background: var(--bg);
  color: #777;
  font-size: 0.44rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  padding: 0.22rem 0.4rem;
}

/* sticker labels */
.col-sticker {
  position: absolute;
  background: var(--paper);
  border: 1.5px solid #333;
  padding: 0.28rem 0.55rem;
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ink);
  z-index: 15;
  box-shadow: 2px 2px 0 #333;
}
.col-sticker.s1 { top: 375px; left: 245px; transform: rotate(-1.8deg); }
.col-sticker.s2 { top: 428px; left: 490px; transform: rotate(1.1deg); }
.col-sticker.s3 { top: 480px; left: 125px; transform: rotate(-0.7deg); }

/* hazard stripe at bottom of collage zone */
.col-warning {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 8px;
  background: repeating-linear-gradient(
    -45deg,
    var(--ink), var(--ink) 10px,
    var(--accent) 10px, var(--accent) 20px
  );
}

/* ── DEMO SECTION ── */
.demo-section {
  background: var(--paper);
  color: var(--ink);
  position: relative;
}
.demo-section::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='3' height='3'%3E%3Ccircle cx='0.75' cy='0.75' r='0.5' fill='%23000' opacity='0.04'/%3E%3C/svg%3E");
  background-size: 3px 3px;
  pointer-events: none;
}

.demo-header-bar {
  background: var(--ink);
  color: var(--paper);
  padding: 0.6rem 1.4rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  position: relative;
  z-index: 1;
}

.demo-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  position: relative;
  z-index: 1;
}

.demo-card {
  border-right: 2px solid var(--ink);
  border-bottom: 2px solid var(--ink);
  overflow: hidden;
}
.demo-card:nth-child(3n) { border-right: none; }

.demo-card-photo {
  position: relative;
  height: 155px;
  overflow: hidden;
  border-bottom: 2px solid var(--ink);
  background: #222;
}
.demo-card-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  filter: grayscale(1) contrast(2.0) brightness(0.72);
  transition: filter 0.3s;
}
.demo-card-photo img:hover { filter: grayscale(0.6) contrast(1.5) brightness(0.85); }
.demo-card-photo::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, rgba(0,0,0,0.85) 0.9px, transparent 0.9px);
  background-size: 4px 4px;
  opacity: 0.2;
  pointer-events: none;
}

.demo-card-body {
  padding: 0.75rem 0.9rem;
  background: var(--paper);
}
.unit-id {
  font-size: 0.44rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--muted);
  margin-bottom: 0.18rem;
}
.unit-name {
  font-size: 0.88rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink);
  margin-bottom: 0.25rem;
}
.unit-tagline {
  font-size: 0.56rem;
  color: #444;
  line-height: 1.5;
  margin-bottom: 0.45rem;
}
.unit-links {
  display: flex;
  gap: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1.5px solid #bbb;
}
.unit-link {
  font-size: 0.46rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border: 1px solid #777;
  padding: 2px 6px;
  color: #333;
  transition: background 0.1s, color 0.1s;
}
.unit-link:hover { background: var(--ink); color: var(--paper); }

/* ── CTA BAR ── */
.cta-bar {
  background: var(--ink);
  color: var(--paper);
  padding: 2.2rem 1.8rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  overflow: hidden;
}
.cta-bar::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Ccircle cx='1' cy='1' r='0.75' fill='%23fff' opacity='0.04'/%3E%3C/svg%3E");
  background-size: 4px 4px;
  pointer-events: none;
}
.cta-headline {
  font-size: 2rem;
  font-weight: 900;
  text-transform: uppercase;
  line-height: 1;
  letter-spacing: -0.01em;
  position: relative;
}
.cta-btn {
  font-family: 'Special Elite', monospace;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  border: 2px solid var(--paper);
  padding: 0.75rem 1.6rem;
  color: var(--paper);
  background: transparent;
  cursor: pointer;
  position: relative;
  box-shadow: 4px 4px 0 rgba(255,255,255,0.12);
  transition: background 0.15s, color 0.15s;
}
.cta-btn:hover { background: var(--paper); color: var(--ink); }

/* ── FOOTER ── */
.doc-footer {
  background: var(--paper);
  color: var(--ink);
  padding: 0.6rem 1.4rem;
  display: flex;
  justify-content: space-between;
  font-size: 0.46rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  border-top: 2px solid var(--ink);
  position: relative;
  z-index: 1;
}

/* ── MOBILE ── */
@media (max-width: 700px) {
  .collage-zone { min-height: 900px; }
  .col-notation { left: 10px; top: 290px; width: 90%; transform: rotate(0.8deg); }
  .col-sticker.s1 { top: 700px; left: 20px; }
  .col-sticker.s2 { top: 750px; left: 180px; }
  .col-sticker.s3 { top: 800px; left: 10px; }
  .demo-grid { grid-template-columns: 1fr; }
  .demo-card { border-right: none; }
  .cta-bar { flex-direction: column; gap: 1.2rem; text-align: center; }
  .doc-footer { flex-direction: column; gap: 0.3rem; }
}
</style>

<!-- Corner marks -->
<div class="corner-mark tl">V</div>
<div class="corner-mark tr">V</div>
<div class="corner-mark bl">V</div>
<div class="corner-mark br">V</div>

<!-- Cinematic hero -->
<section class="hero-photo">
  <img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1400&q=85"
       alt="industrial performance">
  <div class="hero-fade"></div>
</section>

<!-- Collage zone -->
<section class="collage-zone">
  <div class="tape-grid"></div>
  <div class="bg-text-repeat">
    your world your signal your world your signal your world your signal your world your signal
    your world your signal your world your signal your world your signal your world your signal
    your world your signal your world your signal your world your signal your world your signal
    your world your signal your world your signal your world your signal your world your signal
    your world your signal your world your signal your world your signal your world your signal
    your world your signal your world your signal your world your signal your world your signal
  </div>

  <!-- Portrait — screen blend halftone -->
  <div class="col-portrait">
    <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80"
         alt="operator portrait">
  </div>

  <!-- Notation sheet -->
  <div class="col-notation">
    <div class="tape-piece"></div>
    <div class="notation-header">S0728 L12 / 105418 ΔΔΔ ΛXBR—<br>S0730 LSS LLR 47639</div>
    <div class="notation-title">YOUR<br>WORLD.</div>
    <div class="notation-grid">
      <div class="notation-item"><span class="notation-num">00</span> public read</div>
      <div class="notation-item"><span class="notation-num">01</span> ☆ approved write</div>
      <div class="notation-item"><span class="notation-num">02</span> ◻ full style</div>
      <div class="notation-item"><span class="notation-num">03</span> mp3 uploads</div>
      <div class="notation-item"><span class="notation-num">04</span> ⊙ collective</div>
      <div class="notation-item"><span class="notation-num">05</span> ☆ band site</div>
      <div class="notation-item"><span class="notation-num">06</span> zine / archive</div>
      <div class="notation-item"><span class="notation-num">07</span> → clone remix</div>
      <div class="notation-item"><span class="notation-num">08</span> no template</div>
      <div class="notation-item"><span class="notation-num">09</span> ↓ your rules</div>
    </div>
    <div class="notation-footer">vibes.diy / collective system / rev.04</div>
  </div>

  <!-- Small tilted photo -->
  <div class="col-photo-b">
    <img src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80"
         alt="music performance">
    <div class="photo-cap">FIG. 2 — BAND UNIT IN OPERATION</div>
  </div>

  <!-- Stickers -->
  <div class="col-sticker s1">⚠ public read · restricted write</div>
  <div class="col-sticker s2">§ operator credentials required</div>
  <div class="col-sticker s3">clone → remix → deploy</div>

  <!-- Hazard stripe -->
  <div class="col-warning"></div>
</section>

<!-- Demo units -->
<section class="demo-section">
  <div class="demo-header-bar">
    <span>§ 04 — Demonstration Units / Six Operational Instances</span>
    <span>DOC-VDY-COL-001 / Rev.04</span>
  </div>
  <div class="demo-grid">
    {{#each apps}}
    <div class="demo-card">
      <div class="demo-card-photo">
        <a href="https://vibes.diy/vibe/{{author}}/{{slug}}">
          <img src="https://{{slug}}--{{author}}.prod-v2.vibesdiy.net/screenshot.jpg"
               onerror="this.onerror=null; this.src='{{@root.assetPrefix}}images/og-preview.png';"
               alt="{{title}}">
        </a>
      </div>
      <div class="demo-card-body">
        <div class="unit-id">UNIT-{{num}} / {{category}}</div>
        <div class="unit-name">{{title}}</div>
        <div class="unit-tagline">{{tagline}}</div>
        <div class="unit-links">
          <a class="unit-link" href="https://vibes.diy/clone/{{author}}/{{slug}}">Clone</a>
          <a class="unit-link" href="https://vibes.diy/remix/{{author}}/{{slug}}">Remix</a>
          <a class="unit-link" href="https://vibes.diy/vibe/{{author}}/{{slug}}">View ↗</a>
        </div>
      </div>
    </div>
    {{/each}}
  </div>
</section>

<!-- CTA -->
<section class="cta-bar">
  <div class="cta-headline">Build your<br>world now.</div>
  <a class="cta-btn" href="https://links.vibes.diy/homepage">↗ Start Building</a>
</section>

<!-- Footer -->
<footer class="doc-footer">
  <span>Vibes DIY / Publication Division</span>
  <span>DOC-VDY-COL-001 / Rev.04 / 2026</span>
  <span>good.vibes.diy</span>
</footer>
```

- [ ] Verify file saved: `wc -l src/pages/zine.hbs`

---

## Task 4: Wire into indexes

- [ ] Add CSS + card to `src/pages/index.hbs`:

  **CSS** — find the block with other `.landing-card.X { border-color: ... }` rules and add:
  ```css
  .landing-card.zine         { border-color: #c8e020; }
  .landing-card.zine:hover   { background: linear-gradient(135deg, #fff 0%, #faffd9 100%); }
  ```

  **Card** — find a logical grouping (near `college`, `dating`, `rec-league`) and add:
  ```html
  <a href="zine.html" class="landing-card zine">
      <div class="card-icon">📋</div>
      <h2 class="card-title">For Zines &amp; Collectives</h2>
      <p class="card-description">Build a zine, band site, or art archive. Public reads. You decide who writes. Full style control.</p>
      <span class="card-cta">Build Your World →</span>
  </a>
  ```

- [ ] Add entry to `src/pages/about.hbs` near `college.html` / `dating.html`:
  ```html
  <a class="list-item" href="zine.html">
    <span class="li-name">Zines &amp; Collectives</span>
    <span class="li-desc">Band sites, art archives, and zines in the SRL xerox collage skin</span>
    <span class="li-arrow">→</span>
  </a>
  ```

---

## Task 5: Add to screenshot-pages.js

- [ ] Find the `SLUGS` array in `screenshot-pages.js` and add `'zine'`:
  ```js
  // existing slugs...
  'zine',
  // ...
  ```

---

## Task 6: Build and open

- [ ] Run build: `pnpm check`
- [ ] Expected: exits 0, `_site/zine.html` created, no template errors
- [ ] Open: `open _site/zine.html`

---

## Task 7: Verify app deployments

- [ ] Check status log: `cat vibes/zine/_status.log`
- [ ] For each app, verify it is not a stub:

```bash
for slug in ghost-static-band rough-draft-zine dead-letter-press void-transmissions silver-archive dispatch-bureau; do
  result=$(curl -sL "https://${slug}--og.prod-v2.vibesdiy.net/" | grep -oE '"fsId":"[^"]*"' | head -1)
  echo "$slug: $result"
done
```

Expected per app: `"fsId":"z..."` (not `"pending"`).

- [ ] For any app with `fsId: pending`, wait 45s and retry. If still pending after 3 retries, use a fresh slug.

- [ ] Once all 6 verified: set `"live": true` for each app in `zine.hbs` frontmatter. Re-run `pnpm check`. Reload browser tab.

---

## Task 8: OG screenshot + FB ad doc + commit

- [ ] Capture OG screenshot:
  ```bash
  node screenshot-pages.js
  ```
  Verify `images/screenshots/zine.jpg` exists and is > 10KB.

- [ ] Add `"ogImage"` to frontmatter in `zine.hbs` (after the `apps` array, inside the JSON block):
  ```json
  "ogImage": "https://good.vibes.diy/images/screenshots/zine.jpg"
  ```

- [ ] Create `agents/fb-ads-zine.md`:

```markdown
# FB Ad Campaign — Zine Collective

Target page: good.vibes.diy/zine/
Pixel: vibes-diy-web (set on all ads)

## Ad 1 — Your Internet Back (Tumblr refugees)

Audience: 25–40, interests: Tumblr, Pinterest, Neocities, zines, indie music
Headline: Your corner of the internet. Nobody else's algorithm.
Body: Build a zine, a band site, an art archive. Public reads. You decide who writes. Full style control — halftone, xerox, whatever. No templates. Vibes DIY.
CTA: Learn More
Creative: Hero photo from zine page (halftone processed, "YOUR WORLD." notation sheet overlaid)

## Ad 2 — For the Collective (art/music communities)

Audience: 20–35, interests: art collective, independent music, screen printing, zine culture, DIY
Headline: Anyone reads. Only your crew writes.
Body: One editor sets the vibe. Approved contributors post. The rest of the internet just watches. Upload mp3s. Post photos. Write whatever. Style it yourself.
CTA: Learn More
Creative: Three-panel grid of Ghost Static / Rough Draft / Dead Letter Press cards (all halftone filtered)

## Ad 3 — The Document (SRL/industrial art crowd)

Audience: 25–45, interests: industrial art, performance art, experimental music, Dada, zines
Headline: Deploy your collective media system.
Body: Public read. Approved write. Full aesthetic control. No template. No algorithm. Vibes DIY — your world, your signal.
CTA: Learn More
Creative: Full collage zone screenshot — tape grid, notation sheet, portrait — as the ad image
```

- [ ] Run prettier on changed non-hbs files:
  ```bash
  npx prettier --write screenshot-pages.js agents/fb-ads-zine.md
  ```

- [ ] Final build check: `pnpm check`

- [ ] Stage and commit:
  ```bash
  git add src/pages/zine.hbs src/pages/index.hbs src/pages/about.hbs \
          screenshot-pages.js images/screenshots/zine.jpg \
          agents/fb-ads-zine.md docs/superpowers/plans/2026-05-26-zine-collective-build.md
  git commit -m "feat: zine collective landing page — SRL xerox collage skin with 6 apps"
  ```

- [ ] Say completion message: `echo 'zine page live' | say`
