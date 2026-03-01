# Normalize App/Preview View

## Current State

- `ViewType` includes both `"preview"` (internal) and `"app"` (URL param `?view=app`)
- `getViewFromPath` maps `?view=app` → `"preview"`, and defaults to `"preview"`
- `PreviewApp` component renders the iframe with the app
- The URL param uses "app" but internal code uses "preview"

## Goal

Unify to a single "app" concept. The only real difference is dev vs production:
- Dev: uses vite dev server URL with `?preview=yes`
- Production: uses the deployed URL

This distinction can be handled at the iframe URL level, not the view type level.

## Files Involved

- `vibes.diy/pkg/app/utils/ViewState.ts` — `getViewFromPath`, view type mapping
- `vibes.diy/pkg/app/components/ResultPreview/ResultPreview.tsx` — switch on `currentView`
- `vibes.diy/pkg/app/components/ResultPreview/PreviewApp.tsx` — iframe rendering
- `vibes.diy/pkg/app/components/ResultPreview/ResultPreviewHeaderContent.tsx` — view controls
- `prompts/pkg/` — `ViewType` type definition

## Approach

1. Change `ViewType` to use `"app"` instead of `"preview"`
2. Update all switch/case logic to use `"app"`
3. Remove the `getViewFromPath` mapping that converts `"app"` → `"preview"`
4. Keep dev/prod URL logic internal to PreviewApp
