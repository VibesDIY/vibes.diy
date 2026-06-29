# Zine Collective Landing Page — Design Spec

**Date:** 2026-05-26
**Slug:** `zine` (URL: `good.vibes.diy/zine/`)
**Source tag:** `zine-collective`
**Layout:** `webring` (brings its own full CSS, no chrome)

---

## Overview

A single landing page targeting the Tumblr/Pinterest/zine crowd who want to build their own styled media environments — online zines, band sites, art archives, photo collectives. The page targets people who care intensely about aesthetics and the politics of owning their own corner of the internet.

Visual reference: [feintly.co](https://feintly.co/) — collage layers, overlapping objects, dark tape-grid background, cinematic full-bleed photos, handwritten notation elements. NOT a grid-based design.

**Hero user:** Zine collective editor — one person who sets the vibe and controls who writes. Public reads, approved inner circle contributes.

**Secondary audience:** Bands/music crews (upload mp3s, approved bandmates post, world listens).

---

## Aesthetic Specification

**Style:** SRL (Survival Research Laboratories) technical manual meets xerox zine collage.

- **Background:** `#0d0d0d` — nearly black
- **Paper:** `#f0ead4` — warm cream, not white
- **Ink:** `#111`
- **Accent:** `#c8e020` — sharp yellow-green, used sparingly (corner marks, warning stripe)
- **Typography:**
  - `Special Elite` (Google Fonts) — the primary typeface; typewriter-distressed serif
  - `Caveat` (Google Fonts) — handwritten, used for the notation sheet and organic labels
- **Photo treatment:** All photos processed with CSS filter stack: `grayscale(1) contrast(1.9–2.8) brightness(0.72–0.75)` + halftone dot screen overlay via `radial-gradient` SVG pattern (`3–5px` spacing, `opacity: 0.2–0.3`). Photos with `mix-blend-mode: screen` in dark sections for the blown-out xerox look.
- **Dither/grain:** Two-pixel repeating SVG pattern over paper sections for paper texture.
- **No borders with `border-radius`** — everything sharp corners or freeform/rotated.
- **Corner marks:** Fixed `V` logo marks in `#c8e020` at all four corners.

---

## Page Sections

### 1. Cinematic Hero Photo (full viewport width)

- Height: `52vh`
- Unsplash photo: industrial/performance/dramatic sky — heavily filtered (grayscale + contrast + halftone screen)
- Gradient fade-to-black at bottom into collage zone
- No text overlay — the photo speaks for itself

### 2. Collage Zone (dark, `min-height: 720px`)

Background: `#0d0d0d` with:
- Tape-grid pattern: `repeating-linear-gradient` lines at `80px` intervals, faint white (`opacity: 0.04`)
- Faint repeating bg text layer: "your world your signal" looping, `opacity: 0.07`, `Special Elite`, all-caps
- Yellow-green warning stripe along bottom edge (hazard chevrons)

**Layered collage elements (absolutely positioned, overlapping):**

| Element | Description |
|---|---|
| **Portrait** | Large Unsplash portrait, `mix-blend-mode: screen`, `grayscale + contrast(2.8)` + halftone dot screen. Floats top-left, overlaps hero fade. |
| **Notation sheet** | White `#f8f5ea` paper, slightly rotated (`+1.5deg`), taped to page with semi-transparent tape div. Contains `Caveat` handwritten text: cryptic header codes, `YOUR WORLD.` title, numbered list of features (public read, approved write, mp3, style override, collective, band site, zine, art port…). Hand-drawn arrow characters scattered. Drop shadow. |
| **Small tilted photo** | Secondary Unsplash photo, `rotate(-2.5deg)`, same filter stack, caption bar underneath in dark. |
| **Sticker labels** | 3 cream paper stickers at various rotations: "⚠ public read · restricted write", "§ operator credentials required", "clone → remix → deploy" |

### 3. Demo Units / App Gallery (paper section)

Background: `#f0ead4` (warm cream) with dither grain overlay.

- Header bar: `#111` background, white text — "§ 04 — Demonstration Units / Six Operational Instances" + doc reference number right-aligned
- 3-column grid, 2 rows = **6 app cards**
- Each card: filtered photo (same halftone treatment), card body on cream — unit ID, name, desc, three links:
  - **Clone** → `https://vibes.diy/clone/og/<slug>`
  - **Remix** → `https://vibes.diy/remix/og/<slug>`
  - **View ↗** → `https://vibes.diy/vibe/og/<slug>`
- Screenshot thumbnail: `https://<slug>--og.prod-v2.vibesdiy.net/screenshot.jpg` with `og-preview.png` fallback
- Cards separated by `2px solid #111` borders, no rounding

### 4. CTA Bar

- `#111` background with cream dither grain
- Left: large bold headline "Build your / world now." in `Special Elite`
- Right: outlined button "↗ Start Building" → `https://links.vibes.diy/homepage`

### 5. Footer

- Cream background, `2px solid #111` top border
- Three columns: "Vibes DIY / Publication Division" | doc reference | "good.vibes.diy"
- Font: `Special Elite`, tiny, uppercase, tracked

---

## App List — Six Demonstration Units

All apps generated via `npx vibes-diy@latest generate --user-slug=og`. Prompts kept under 50 words.

| Unit | Slug | Title | Category | Photo theme |
|---|---|---|---|---|
| 01 | `ghost-static-band` | Ghost Static | band site + mp3 | concert/performance |
| 02 | `rough-draft-zine` | Rough Draft Collective | multi-contributor zine | paper/printing press |
| 03 | `dead-letter-press` | Dead Letter Press | art/printmaking archive | darkroom/prints |
| 04 | `void-transmissions` | Void Transmissions | noise collective / 2nd band | industrial/machinery |
| 05 | `silver-archive` | Silver Archive | personal photo zine | analog photography |
| 06 | `dispatch-bureau` | The Dispatch Bureau | writers collective | typewriter/desk |

### App Generation Prompts

```
ghost-static-band:
"Band website with mp3 player. Upload tracks, show upcoming shows, let approved bandmates post updates. Dark industrial aesthetic."

rough-draft-zine:
"Online zine with multiple contributors. Editor approves writers. Anyone can read. Issue-based layout, xerox aesthetic."

dead-letter-press:
"Art collective archive. Upload images, prints, photos. Public gallery. Approved members can add work. Minimal, dark."

void-transmissions:
"Noise/experimental music collective. Share recordings, show dates, field reports. Approved crew posts. Industrial, text-heavy."

silver-archive:
"Personal photo zine. Upload images in batches as 'issues'. Public archive. One editor, no contributors needed."

dispatch-bureau:
"Writers collective. Submit pieces, editor approves. Public reading room. Issue-based. Typewriter aesthetic."
```

---

## Unsplash Photo Plan

All photos use the filter stack: `grayscale(1) contrast(1.9–2.8) brightness(0.72–0.75)` + halftone dot overlay.

| Section | Query / ID | Notes |
|---|---|---|
| Hero | `photo-1558618666-fcd25c85cd64` | Industrial/fire sky — already tested |
| Portrait collage | `photo-1534528741775-53994a69daeb` | High-contrast portrait, screen blend |
| Small tilted photo | `photo-1511671782779-c97d3d27a1d4` | Music performance |
| Unit-01 (band) | `photo-1471478331149-c72f17e33c73` | Concert |
| Unit-02 (zine) | `photo-1518281361980-b26bfd556770` | Print/paper |
| Unit-03 (art) | `photo-1561214115-f2f134cc4912` | Darkroom |
| Unit-04 (noise) | Search: industrial machinery | Unsplash |
| Unit-05 (photo zine) | Search: analog photography darkroom | Unsplash |
| Unit-06 (writers) | Search: typewriter vintage | Unsplash |

---

## Facebook Ad Campaign

Three ad concepts targeting overlapping audiences. All use halftone-processed images from the page.

### Ad 1 — "Your Internet Back" (Tumblr refugees)

**Audience:** 25–40, interests: Tumblr, Pinterest, Neocities, zines, indie music
**Hook:** Nostalgia for personal web, against algorithmic feeds
**Headline:** "Your corner of the internet. Nobody else's algorithm."
**Body:** "Build a zine, a band site, an art archive. Public reads. You decide who writes. Full style control — halftone, xerox, whatever. No templates. Vibes DIY."
**CTA:** Learn More
**Creative:** Hero photo with "YOUR WORLD." notation sheet overlay (halftone processed)

### Ad 2 — "For the Collective" (art/music communities)

**Audience:** 20–35, interests: art collective, independent music, screen printing, zine culture, DIY
**Hook:** You already have the crew. Now give them a place.
**Headline:** "Anyone reads. Only your crew writes."
**Body:** "One editor sets the vibe. Approved contributors post. The rest of the internet just watches. Upload mp3s. Post photos. Write whatever. Style it yourself."
**CTA:** Learn More
**Creative:** Three-panel: Ghost Static band card, Rough Draft zine card, Dead Letter Press art card — all halftone

### Ad 3 — "The Document" (SRL/industrial art crowd)

**Audience:** 25–45, interests: industrial art, performance art, experimental music, Dada, zines
**Hook:** The page itself looks like the work
**Headline:** "Deploy your collective media system."
**Body:** "Public read. Approved write. Full aesthetic control. No template. No algorithm. Vibes DIY — your world, your signal."
**CTA:** Learn More
**Creative:** Full collage zone screenshot — tape grid, notation sheet, portrait — as the ad image

---

## OG / Screenshot

- Run `pnpm check` then `node screenshot-pages.js` after adding `zine` to SLUGS array
- Add `"ogImage": "https://good.vibes.diy/images/screenshots/zine.jpg"` to frontmatter
- OG dimensions: 1200×630

---

## Files to Create / Modify

| File | Action |
|---|---|
| `src/pages/zine.hbs` | Create — full webring page with all CSS + HTML |
| `src/pages/index.hbs` | Add card for zine page |
| `src/pages/about.hbs` | Add entry |
| `screenshot-pages.js` | Add `'zine'` to SLUGS array |
| `images/screenshots/zine.jpg` | Capture after build |
| `agents/fb-ads-zine.md` | Ad copy and targeting spec for campaign |

---

## Constraints

- `.hbs` files are excluded from Prettier — do not run prettier on the template
- Run `pnpm check` before every commit to catch build errors
- All external links use `https://links.vibes.diy/` redirector
- Apps must have verified `fsId` (not `"pending"`) before page goes live
- Do not commit `.claude/` or `.superpowers/` directories
