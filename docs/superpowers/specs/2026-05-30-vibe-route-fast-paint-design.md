# Vibe Route Fast First Paint

**Date:** 2026-05-30  
**Status:** Draft

## Goal

Minimize time-to-first-paint on the `/vibe` route for world-readable apps. The iframe's source code is already embedded in its URL; the only things blocking pixels today are (a) the parent hiding the iframe until a client-side grant check returns and (b) `mountVibe` being chained after `registerDependencies`, which itself waits for the `vibe.evt.runtime.ack` handshake. This design removes both blockers for apps where any visitor is welcome, while keeping the current gate for private apps.

## Policy: Fast vs Slow

**World-readable (fast path)** — any visitor gets in without owner action:

| Setting                                             | Grant effect                        |
| --------------------------------------------------- | ----------------------------------- |
| `app.public.access: enable: true`                   | Immediate access, no login required |
| `app.request: enable: true, autoAcceptRole: viewer` | Auto-approved as viewer on login    |
| `app.request: enable: true, autoAcceptRole: editor` | Auto-approved as editor on login    |

**Gated (current behavior)** — owner action required at some point:

- `app.request: enable: true`, no `autoAcceptRole` — manual per-person approval
- `app.public.access: enable: false` — sharing explicitly off
- No AppSettings row — owner-only

Derivation:

```typescript
const isWorldReadable = settings.entry.publicAccess?.enable === true || settings.entry.enableRequest?.autoAcceptRole !== undefined;
```

## Zero-Migration Approach

No schema changes. `isWorldReadable` is derived at read time from the existing `AppSettings.settings` JSON blob. The AppSettings row is already indexed on `(userHandle, appSlug)`, so a LEFT JOIN in the existing server-side lookup is cheap (cost ~8).

If no AppSettings row exists (new app, no sharing settings), the LEFT JOIN returns NULL and `isWorldReadable` defaults to `false` — current behavior.

## Architecture

### 1. `get-vibe-og-title.ts` → `get-vibe-route-hints.ts`

Rename and extend the existing function. It already queries the `apps` table server-side (before React Router SSR) to populate `vibeOgTitle`. Add a LEFT JOIN to `AppSettings` and derive `isWorldReadable` from the loaded JSON.

**New return type:**

```typescript
interface VibeRouteHints {
  ogTitle: string | undefined;
  isWorldReadable: boolean;
}
```

**Query change** — same `apps` lookup, add LEFT JOIN:

```typescript
const row = await ctx.sql.db
  .select({
    meta: apps.meta,
    settings: appSettings.settings, // new
  })
  .from(apps)
  .leftJoin(appSettings, and(eq(appSettings.userHandle, apps.userHandle), eq(appSettings.appSlug, apps.appSlug)))
  .where(and(eq(apps.userHandle, slugs.userHandle), eq(apps.appSlug, slugs.appSlug), eq(apps.mode, "production")))
  .orderBy(desc(apps.releaseSeq))
  .limit(1)
  .then((r) => r[0]);
```

**Derivation in TypeScript** (no raw SQL JSON extraction):

```typescript
const parsed = row?.settings ? AppSettings(row.settings) : undefined;
const entry = parsed instanceof type.errors ? undefined : parsed?.entry;
const isWorldReadable = entry?.publicAccess?.enable === true || entry?.enableRequest?.autoAcceptRole !== undefined;
```

### 2. Worker context (`app.ts`)

Pass both hints into the React Router loader context alongside the existing `vibeOgTitle`:

```typescript
const hints = vibeSlugPair !== undefined
  ? await getVibeRouteHints(cfCtx.vibesCtx, vibeSlugPair)
      .then((r) => r.isOk() ? r.Ok() : { ogTitle: undefined, isWorldReadable: false })
  : { ogTitle: undefined, isWorldReadable: false };

// In getRequestHandler context:
{
  vibeDiyAppParams: cfCtx.vibesCtx.params,
  vibeOgTitle: hints.ogTitle,
  isWorldReadable: hints.isWorldReadable,   // new
}
```

The loader context type gains `isWorldReadable: boolean`.

### 3. Vibe route loader

Propagate the flag through loader data (SSR'd in first byte):

```typescript
// LoaderData type:
readonly isWorldReadable: boolean;

// loader():
return { iframeUrl, vibeOgTitle: loaderCtx.context.vibeOgTitle, isWorldReadable: loaderCtx.context.isWorldReadable ?? false };
```

### 4. Vibe route component — conditional visibility

Current behavior (all apps):

```tsx
style={{ visibility: isAccessGranted ? "visible" : "hidden" }}
```

New behavior:

```tsx
const isWorldReadable = loaderData?.isWorldReadable ?? false;

// iframe wrapper:
style={{
  visibility: (isWorldReadable || isAccessGranted) ? "visible" : "hidden"
}}

// Pointer-blocking overlay — shown while grant is still resolving on world-readable apps:
{isWorldReadable && !isAccessGranted && cardGrant === undefined && (
  <div
    className="fixed inset-0 z-40"
    style={{ pointerEvents: "all", cursor: "default" }}
    aria-hidden
  />
)}
```

The iframe is in the DOM and painting. The transparent overlay prevents clicks until either:

- `cardGrant` resolves to an accessible grant (owner, public-access, granted-access.\*), or
- `cardGrant` resolves to a denied state (not-grant, revoked) → the standard access-denied UI appears, overlay is replaced

The overlay has no visual treatment — it is purely a pointer-events blocker. The user sees the app rendering without any spinner or blur.

`cardGrant === undefined` is the loading state. Once `cardGrant` is set (to anything), the overlay drops — either access is confirmed and the iframe is fully interactive, or the access-denied card replaces it.

### 5. Inside the iframe — deferred optimization

The natural follow-on would be to decouple `mountVibe` from `registerDependencies` so the app renders before the ack handshake completes. This is **out of scope for Phase 1** because `useFireproof` currently throws `"Firefly not initialized"` if called before `registerFirefly` runs, and `callAI` is `undefined` until `registerCallAI` runs. Calling `mountVibe` first would crash any app that uses either at render time.

Phase 2 (separate PR): make `useFireproof` return an empty loading state and make `callAI` queue or no-op when called before registration, then swap the mount order. The parent overlay already handles the non-interactive window so no new infrastructure is needed — just the vibe-runtime tolerance change.

## Data Flow: Before vs After

**Before (world-readable app, logged-in owner):**

```
Browser requests /vibe/user/app
  → SSR: iframeUrl in first byte (iframe starts fetching)
  → React hydrates
  → getAppByFsId fires (client-side API call ~100-300ms)
  → grant = "owner" → isAccessGranted = true → iframe revealed
  → Inside iframe: registerDependencies sends runtime.ready
  → SrvSandbox runs Stage C, sends runtime.ack
  → mountVibe runs → first pixels
```

**After (world-readable app, Phase 1):**

```
Browser requests /vibe/user/app
  → SSR: iframeUrl + isWorldReadable: true in first byte
  → React hydrates → isWorldReadable = true → iframe IMMEDIATELY visible
  → Transparent overlay blocks clicks
  → Inside iframe: registerDependencies → ack → mountVibe → first pixels (unchanged)
  → getAppByFsId fires in parallel (for chrome/grant details)
  → grant resolves → overlay drops → fully interactive
```

The iframe renders at the same absolute time as before — but it is now **visible during that window** rather than hidden behind the grid. The grant check no longer gates visibility.

**Private app (no change):**

```
SSR: isWorldReadable: false → iframe hidden (current behavior)
getAppByFsId returns grant → if accessible, iframe revealed
```

## Edge Cases

**Anon visitor on autoAcceptRole app**: Content renders immediately. The transparent pointer-blocker is present while `cardGrant === undefined`. Once `getAppByFsId` returns `req-login.auto-join`, `cardGrant` is set so the pointer-blocker drops — but `cardVariant = "invite"` means `!isAccessGranted`, so the grid overlay appears on top covering the iframe. Net result: the user sees the app content briefly during the loading window (~100-300ms), then the invite card takes over. This is acceptable — the teaser view entices login, and the owner explicitly enabled auto-join meaning the content is intended to be seen.

**App transitions from private → public**: The `isWorldReadable` hint is computed fresh on each SSR request. No stale state.

**App with no AppSettings row yet** (fresh app, owner hasn't configured sharing): LEFT JOIN returns NULL → `isWorldReadable = false` → current behavior. Correct: a new app defaults to owner-only.

**`getVibeRouteHints` error**: On failure, default `isWorldReadable: false` → current behavior, no regression.

## Files Changed

| File                                                     | Change                                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `vibes.diy/api/svc/intern/get-vibe-og-title.ts`          | Rename to `get-vibe-route-hints.ts`; add LEFT JOIN, return `VibeRouteHints`              |
| `vibes.diy/pkg/workers/app.ts`                           | Use `getVibeRouteHints`; pass `isWorldReadable` in loader context                        |
| `vibes.diy/pkg/app/routes/vibe.$userHandle.$appSlug.tsx` | Loader returns `isWorldReadable`; component uses it for conditional visibility + overlay |
| `vibes.diy/api/svc/intern/render-vibe.ts`                | No change (Phase 2)                                                                      |
| Loader context type (wherever it lives)                  | Add `isWorldReadable: boolean`                                                           |

No schema migrations. No new tables or columns.

## Testing

- Unit test for `deriveIsWorldReadable` covering all six policy cases
- Existing `getVibeOgTitle` tests updated/renamed for `getVibeRouteHints`
- Route loader test: `isWorldReadable: true` propagates from context to loader data
- Vibe route component test: iframe visible when `isWorldReadable: true` before grant resolves; overlay present; overlay absent once `cardGrant` is set
- Existing iframe handshake and SrvSandbox tests unaffected (ack mechanism unchanged, Phase 2 deferred)
