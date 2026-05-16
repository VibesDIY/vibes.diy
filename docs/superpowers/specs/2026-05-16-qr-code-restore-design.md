# QR Code Restore in Vibes Switch Panel

**Date:** 2026-05-16  
**Issue:** [#1765](https://github.com/VibesDIY/vibes.diy/issues/1765)

## Goal

Restore a QR code in the vibe switch panel (default mode) so users can quickly scan the current `/vibe/{user}/{app}` URL onto a phone.

## Approach

Client-side QR generation using `qrcodegen` (MIT, ~5KB). QR is pre-drawn when the panel opens (no flicker), shown when the QR button is selected.

## Files Changed

### HTML templates (both must stay in sync)

- `vibes.diy/pkg/slack/serve/vibe-controls.tsx`
- `vibes.diy/api/pkg/react/components/vibes-control.tsx`

Changes: Add `data-action="qr"` button to default mode. Add new `<div data-panel-mode="qr">` with `<img data-qr-img>` placeholder and a Back button.

### Scripts

- `vibes.diy/pkg/slack/serve/vibes-controls/scripts.ts`

Changes:
1. Import/inline `qrcodegen` to generate QR as canvas data URI
2. On panel open: call `drawQR(window.location.href)` → set `img[data-qr-img].src`
3. `data-action="qr"` handler: hide default mode, show qr mode
4. Existing `data-action="back"` handler already covers returning to default

## Acceptance

- QR button visible in default panel mode on `/vibe/{user}/{app}` pages
- QR encodes the canonical `https://vibes.diy/vibe/{user}/{app}` URL
- No flicker: QR is pre-drawn when panel opens, before user clicks QR
- Works SSR (pure static HTML + vanilla JS, no React runtime)
