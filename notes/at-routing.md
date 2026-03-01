# Plan: Update routing from `/vibe/` to `/@`

## Context

The app currently uses `/vibe/userSlug/appSlug` for vibe viewer URLs. We want `/@userSlug/appSlug` instead — shorter, more social, aligns with the url-structure.md proposal. React Router v7 supports literal `@` in route patterns natively, so no catch-all hack needed.

Featured/published vibes currently use a single-slug pattern (`/vibe/excited-wombat-4753`) which doesn't have a userSlug. Decision: drop that pattern — featured vibes should use their real `/@userSlug/appSlug`.

## Changes

### 1. Route definition
**File:** `vibes.diy/pkg/app/routes.ts` (line 33)
- Change: `"vibe/:userSlug/:appSlug/:fsId?"` → `"@:userSlug/:appSlug/:fsId?"`
- Keep same component file, same route ID

### 2. Navigation links (4 files, ~5 lines)
All `/vibe/${...}` → `/@${...}`:

- **`vibes.diy/pkg/app/routes/chat/chat.$userSlug.$appSlug.tsx`** (line 202)
  - `window.open(\`/vibe/${userSlug}/${appSlug}/${fsId}\`)` → `/@${...}`
- **`vibes.diy/pkg/app/routes/vibes/mine.tsx`** (line 199)
  - `const appUrl = \`/vibe/${...}\`` → `/@${...}`
- **`vibes.diy/pkg/app/components/ResultPreview/ResultPreviewHeaderContent.tsx`** (line 65)
  - share URL: `/vibe/${userSlug}/${appSlug}` → `/@${userSlug}/${appSlug}`
- **`vibes.diy/pkg/app/components/PublishedVibeCard.tsx`** (line 60)
  - Change from single slug `/vibe/${slug}` to `/@${userSlug}/${appSlug}` — requires updating the featured vibes data to include userSlug + appSlug instead of just slug

### 3. Featured vibes data update
**File:** `vibes.diy/pkg/app/components/FeaturedVibes.tsx`
- Each featured vibe entry needs `userSlug` and `appSlug` fields instead of just `slug`
- PublishedVibeCard needs to accept and use both fields

### 4. Legacy cleanup (low priority, same commit)
- **`vibes.diy/pkg/app/components/ResultPreview/ShareModal.tsx`** (line 40) — update published URL pattern
- **`vibes.diy/pkg/app/routes/$.tsx`** — the catch-all already has commented-out `@` handling code; clean up or uncomment as a redirect from old `/vibe/` URLs

### 5. Skip (not in scope)
- `vibes.diy/pkg/app/utils/appSlug.ts` — old URL parser for titleId/installId format, likely dead code
- `vibes.diy/pkg/app/routes/groups.tsx` — not routed, old format
- `vibes.diy/pkg/slack/serve/` — old Slack integration, separate concern

## Verification

1. `pnpm build` passes (TypeScript compiles)
2. `pnpm lint` passes for changed files
3. Dev server starts — navigate to `/@userSlug/appSlug` and verify vibe loads
4. Check "My Vibes" page links point to `/@...` URLs
5. Check "Open App" from chat view opens `/@...` URL
6. Check featured vibes on home page link to `/@...` URLs
7. Verify old `/vibe/...` URLs hit 404 (or optionally redirect)
