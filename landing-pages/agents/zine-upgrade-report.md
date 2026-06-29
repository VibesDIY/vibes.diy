# Zine App Upgrade Report

**Date:** 2026-05-26  
**Session:** Full upgrade cycle for all 6 apps on `good.vibes.diy/zine/`  
**Method:** 6 parallel agents, one per app — screenshot → identify → edit → push → verify

---

## Results at a Glance

| App | Before | After | Iterations |
|-----|--------|-------|-----------|
| ghost-static-band | Blank/white (6KB), wrong name "Ironworks", compiled JSX | Fully rendered band site: Track Vault, Tour Ledger, Dispatches. Dark mono aesthetic | 1 (full rewrite) |
| rough-draft-zine | Empty, wrong name "STATIC & CUT", white bg | "ROUGH DRAFT" in lime, 5 seeded articles across 2 issues, tone chips, tags | 2 |
| dead-letter-press | Empty, wrong name "Vellum", mint green accents | 6 seeded artworks, two-column newspaper grid, xerox halftone aesthetic | 1 (full redesign) |
| void-transmissions | Empty, wrong name "STATIC // FIELD REPORTS", pale gray bg | VT323 lime title, 3 field reports + show dates + recordings, gritty underground feel | 2 |
| silver-archive | Empty, wrong name "CUT & PASTE", dead-end message | 5 editorial issues with photo spreads, sidebar index + reader panel layout | 1 (full redesign) |
| dispatch-bureau | Empty, wrong name "Aether Press", async race condition | 3 literary pieces rendering on first paint, fixed seed race condition | 2 |

**All 6 apps had wrong branding.** Every app used a different incorrect name and had empty states showing placeholder text.

---

## Common Patterns Found

### 1. Wrong app names across the board
Every single app was named something other than what the zine page expects. The generated apps had drifted from their briefs:
- ghost-static-band → was "Ironworks"
- rough-draft-zine → was "STATIC & CUT"
- dead-letter-press → was "Vellum"
- void-transmissions → was "STATIC // FIELD REPORTS"
- silver-archive → was "CUT & PASTE"
- dispatch-bureau → was "Aether Press"

### 2. Palette mismatch
Several apps were using the default neobrutalist palette (ivory, grid-gray, generic greens) instead of the zine page's dark xerox skin (#0d0d0d, #f0ead4, #c8e020). Fixes aligned them to the landing page.

### 3. Empty state problem
All apps showed empty databases on first load. Fixed with Fireproof seed data that populates content on first render, making the apps look live rather than abandoned.

### 4. Compiled JSX artifact issue
Two apps (ghost-static-band, void-transmissions) had minified/compiled JSX as their App.jsx — not editable source. These required full rewrites to clean React source before any visual fixes could be applied.

### 5. Async seed race conditions
dispatch-bureau had content seeded asynchronously so screenshots captured the loading state. Fixed with a synchronous fallback that merges live DB + seed data for immediate first paint.

---

## Outstanding Issues

### dispatch-bureau — palette mismatch
The app uses a warm amber/parchment palette rather than the dark xerox aesthetic. It looks good standalone but reads lighter/warmer than its neighbors in the newspaper grid. A color system redesign would align it, but it's functional and content-complete.

### ghost-static-band — Dispatches below fold
The third section (band dispatches) doesn't appear in the screenshot crop. Could reduce Track Vault to fewer items on first load to bring more sections above fold.

### ImgGen rendering lag (dead-letter-press, silver-archive)
Apps using ImgGen for imagery show "Generating image..." on first visit — expected async behavior. Images cache after first generation.

### TIX badges on ghost-static-band
Tour date TIX badges are visual placeholders with no link behind them.

---

## Files Changed

All edits are in `vibes/zine/<slug>/App.jsx`:
- `vibes/zine/ghost-static-band/App.jsx`
- `vibes/zine/rough-draft-zine/App.jsx`
- `vibes/zine/dead-letter-press/App.jsx`
- `vibes/zine/void-transmissions/App.jsx`
- `vibes/zine/silver-archive/App.jsx`
- `vibes/zine/dispatch-bureau/App.jsx`

All 6 pushed to prod under `--user-slug og`. No landing page `.hbs` files were modified.

---

## Next Steps (optional)

1. **dispatch-bureau color fix** — align to dark xerox palette to match the rest
2. **Regenerate OG screenshot** for `zine.jpg` — the landing page hero screenshot may predate these app improvements (`pnpm check && node screenshot-pages.js`)
3. **TIX links** on ghost-static-band — add real Bandcamp/ticketing URLs if they exist
