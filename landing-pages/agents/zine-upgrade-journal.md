# Zine App Upgrade Journal

**Date:** 2026-05-26  
**Session goal:** Run all 6 zine apps through the screenshot → fix → push upgrade cycle.

## Apps in scope

| Slug | Category | Title |
|------|----------|-------|
| ghost-static-band | band site | Ghost Static |
| rough-draft-zine | zine collective | Rough Draft |
| dead-letter-press | art archive | Dead Letter Press |
| void-transmissions | noise collective | Void Transmissions |
| silver-archive | photo zine | Silver Archive |
| dispatch-bureau | writers collective | The Dispatch Bureau |

All authored under `og`. Author slug used for push: `og` (prod URL: `https://<slug>--og.prod-v2.vibesdiy.net`).

## Setup

- App.jsx files pulled from prod to `vibes/zine/<slug>/App.jsx`
- 6 parallel agents dispatched — one per app
- Each agent: screenshot → identify issues → edit → push → verify

---

## Agent Results

<!-- Results filled in as agents complete -->

### dispatch-bureau — DONE

**Before:** Named "Aether Press" (wrong), placeholder tagline "a writers' collective ~ est. today", empty Reading Room with "The press is warm but the page is bare." All three sections empty shells.

**Changes made:**
1. Renamed to "The Dispatch Bureau" with tagline "A Writers' Collective · Est. 2024"
2. Seeded 3 real fake literary pieces: "Notes on Disappearing" by M. Valenti (essay), "The Cartography of Small Disasters" by T. Okafor (prose), "Vigil" by S. Birch (poem) — all with tags, summaries, tone scores
3. Hid Editor's Table behind can("write") guard for cleaner non-editor view
4. Second iteration: fixed async seed race condition — added synchronous fallback (`const seedFallback = SEED_PIECES.filter(p => !liveIds.has(p._id))`) so content renders on first paint

**After:** Reading room shows actual literary pieces on first paint — "Vigil" and "The Cartography of Small Disasters" visible with tag pills, author bylines, article body text, "↓ read more" affordance. Header correct.

**Remaining issues:** App uses warm amber/parchment palette that doesn't match landing page's dark xerox aesthetic. Visual tonal mismatch with neighboring apps — would need fuller color redesign to align with #0d0d0d / #c8e020 zine skin.

---

### void-transmissions — DONE

**Before:** Pale gray background (#CCCDC8), three empty sections (FIELD REPORTS, SHOW DATES, RECORDINGS) all showing "No X yet". Wrong color palette, generic header "STATIC // FIELD REPORTS". No character.

**Changes made:**
1. Full rewrite from compiled artifact to clean JSX — renamed to "VOID TRANSMISSIONS" in VT323 lime on void-black
2. Zine collective palette: #0d0d0d bg, #f0ead4 text, #c8e020 lime
3. Seeded 3 field reports with tags, locations, abstracts, handles (dok_null, freq_mercy, hollow_signal)
4. Seeded 3 show dates with venues/lineups, 3 recording titles with tape-culture notes
5. Seed data fallback so app never looks abandoned
6. Second iteration: added lime top borders on sections, bumped section header size 1.4→1.6rem for better hierarchy

**After:** Dark void aesthetic fully realized. VT323 title in lime. Three section cards with lime top-border lines. Reads like a real underground collective's internal archive — hostile, specific, gritty.

**Remaining issues:** Show Dates and Recordings below fold in screenshot. Audio player filter is a nice touch but untested without real files.

---

### silver-archive — DONE

**Before:** Named "CUT & PASTE" (wrong), empty archive ("No issues yet"), three blank sections, dead-end "Read-only" message. Screenshot 34KB.

**Changes made:**
1. Renamed to "Silver Archive" with lime "PHOTO ZINE" label and correct tagline
2. Complete visual redesign: #0d0d0d bg, #c8e020 lime, #f0ead4 parchment, monospace
3. Seeded 5 editorial issues: Borderlands, Overnight Freight, Salt Flat Frequency, Low Season, Foundry Days — each with documentary-photography taglines and captions
4. Two-column layout: archive index sidebar left, reader panel right with active state
5. 3-column photo grid wired to ImgGen for documentary images
6. Meta strip: issue number, season, photo count, "Edit →"

**After:** Real photo zine archive feel. 5 curated issues in clean sidebar, Borderlands open in reader. Screenshot grew 34KB → 71KB.

**Remaining issues:** ImgGen images still rendering on first load (expected, cached after first visit).

---

### rough-draft-zine — DONE

**Before:** Empty state titled "STATIC & CUT" (wrong name), white/beige background with no zine aesthetic. Three bare sections all empty with placeholder text. No content, no visual connection to landing page.

**Changes made:**
1. Corrected name to "ROUGH DRAFT" with correct tagline
2. Applied zine palette: #0d0d0d bg, #f0ead4 parchment, #c8e020 lime accent, neobrutalist offset shadow
3. Seeded 3 pieces across Issues #01 and #02 on first load
4. Second iteration: added 2 more pieces to Issue #02 for density (3 articles total: "The Halftone Lies…", "Steal This Aesthetic", "Why I Staple Wrong on Purpose")
5. Each piece has tone chips (MANIC, INCENDIARY), tag labels, italic lime blurbs, named authors

**After:** "ROUGH DRAFT" in lime on black, Issue #02 with 3 real-feeling pieces by GRIT PRESS, Blank Recto, T. Okafor. Palette matches landing page.

**Remaining issues:** Draft/Approval sections below fold (expected). Seeding is client-side — fast screenshots might catch empty state. Back issues are text labels only, not filterable.

---

### ghost-static-band — DONE

**Before:** Screenshot was completely blank/white (6KB). App.jsx was compiled/minified JSX with undefined state variables. Wrong band name ("Ironworks" not "Ghost Static").

**Changes made:**
1. Full rewrite from compiled JSX to proper source JSX with hooks (useState, useFireproof, useViewer)
2. Correct branding — "Ghost Static" with right tagline
3. Color scheme aligned to zine: lime #c8e020, dark bg #0a0a0a
4. Seed content: 5 fake tracks with durations, 4 tour dates, 3 dispatches with real band voice
5. Track metadata shows band member handles (k.voss, r.hale, m.cross)

**After:** App renders — Track Vault shows numbered playlist with play buttons/durations, Tour Ledger shows upcoming dates with TIX badges, Dispatches section below fold. Dark mono aesthetic reads well at thumbnail size.

**Remaining issues:** Dispatches section below fold in screenshot crop. TIX badges are non-functional placeholders.

---

### dead-letter-press — DONE

**Before:** App showed as "Vellum — Collective Archive" (wrong name). Three empty stacked cards with placeholder text. Generic dark UI with mint green (#7dffaf) accents — mismatched from the zine aesthetic.

**Changes made:**
1. Renamed from "Vellum" to "Dead Letter Press" with correct tagline
2. Added 6 seed artworks (Maren Voss, T. Okeke, Lena Marchand, Jovan Ruiz, Suki Brennan, Collective OG)
3. Redesigned to zine aesthetic: #0d0d0d bg, #f0ead4 text, #c8e020 lime accent, Courier New, no border-radius
4. Restructured to two-column newspaper grid — archive tiles left, curatorial panel right
5. Auto-selects first work on load
6. Each tile generates image via ImgGen with halftone/xerox prompts

**After:** Dark zine-press aesthetic matching landing page palette. Six archive tiles in grid. Right panel shows first entry with labeled fields for Title, Artist, Medium, Curatorial Note, Tags in lime.

**Remaining issues:** ImgGen shows "Generating image..." on first render — expected async behavior, cached after first load.

