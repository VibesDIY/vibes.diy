# Sugar Sync: Auto-Allow Sharing for Published Apps

## The Problem

When a user visits a published app at `/:userSlug/:appSlug`, they are interrupted by an "Allow Database Sharing" dialog before their Fireproof database can sync. This dialog asks "Allow sharing this Fireproof database?" and shows the app/user/db details, requiring an explicit click.

For published apps where users arrive via invitation to a shared URL, this is unnecessary friction. Of course they want to share data -- that is the whole point of being on that URL. The dialog breaks the flow and confuses users who do not understand what it is asking or why.

## The Principle

Each routable `userSlug/appSlug/databaseName` combo is auto-namespaced in published apps thanks to sandbox domain isolation. Users on the same URL expect to share data with other users at that URL. You can only get to the URL by invitation. So the default should be: **auto-allow sharing with all invited people on the same app URL**.

The sharing prompt should only appear for edge cases -- like when one app wants to access another app's data (cross-app data access). This is a different, more sensitive operation that warrants explicit consent.

## Current Flow

### 1. Registration (iframe runtime -> parent)

When a vibe app creates a Fireproof database, `register-dependencies.ts` intercepts `getLedgerSvc().onCreate()` and sends a `vibe.req.register.fpdb` postMessage to the parent window. The message contains `{ dbName, appSlug, userSlug, fsId }`.

### 2. Parent receives registration (srv-sandbox.ts)

`vibeRegisterFPDB()` in `srv-sandbox.ts` handles the message:
- Stores the DB info in `shareableDBs` (an LRU map) keyed by `${userSlug}-${appSlug}-${dbName}`
- Sets `attachAction: "none"` initially
- Responds with `vibe.res.register.fpdb`
- Registers an `onSet` listener so that when `attachAction` changes to `"attach"`, it fetches a cloud token and sends `vibe.evt.attach.fpdb` back to the iframe

### 3. Dialog trigger (useShareableDB.ts)

`useShareableDB()` hook listens for new entries in `shareableDBs.onSet()`. When a new DB appears (not an update):
- If user is not signed in: shows "Login Required" dialog
- If user is signed in: fetches existing user settings via `vibeDiyApi.ensureUserSettings()`
- Checks if there is already a matching grant (by appSlug + userSlug + dbName or wildcard `*`)
- If grant exists with `"allow"`: auto-attaches by setting `attachAction: "attach"` on the LRU entry
- If grant exists with `"deny"`: silently skips
- If no grant: sets state to `"ask"`, which triggers the `AllowFireproofSharing` dialog

### 4. User decision (AllowFireproofSharing.tsx)

The dialog presents Allow/Decline with an optional "Allow all databases from this app" checkbox. On acceptance:
- Calls `vibeDiyApi.ensureUserSettings()` to persist the grant
- The grant is stored server-side in `sqlUserSettings` as `{ type: "sharing", grants: [{ grant: "allow"|"deny", appSlug, userSlug, dbName }] }`

### 5. Where sharing is managed (settings.tsx)

The Settings page shows a "Data Sharing Grants" table where users can toggle individual grants between allow/deny.

## Proposed Solution

### Core change: auto-allow in `useShareableDB.ts`

The key decision point is in `useShareableDB.ts` lines 63-77, where the hook checks for an existing grant and falls through to `"ask"` if none is found. The change is:

**When the DB registration's `appSlug` and `userSlug` match the current route's `appSlug` and `userSlug`, skip the dialog and auto-allow.**

This is the "same-app" case. The user is already on the app's page, they have already been invited, and the database is namespaced to that app.

```typescript
// In useShareableDB.ts, after the grant lookup:
const grant = sharing?.grants.find(
  (g) => (g.dbName === "*" || g.dbName === dbName) && g.appSlug === appSlug && g.userSlug === userSlug
);

if (grant?.grant === "allow") {
  // existing: auto-attach
} else if (grant?.grant === "deny") {
  // existing: respect explicit deny
} else {
  // NEW: check if this is same-app (not cross-app)
  const isSameApp = isSameAppContext(pendingDbRef.data);
  if (isSameApp) {
    // Auto-allow: persist the grant and attach
    const newGrant = { grant: "allow" as const, appSlug, userSlug, dbName };
    vibeDiyApi.ensureUserSettings({
      settings: [{ type: "sharing", grants: [...(sharing?.grants ?? []), newGrant] }],
    });
    srvVibeSandbox.shareableDBs.set(v.key, { ...v, attachAction: "attach" });
    setSharingState("allowed");
  } else {
    // Cross-app access: show the dialog
    setSharingState("ask");
  }
}
```

### How to determine "same-app" (hybrid approach)

The `useShareableDB` hook needs to know what app context it is running in. We use a hybrid of two complementary checks:

1. **Route params (Option A)** — compare the hook's route context to the DB registration's `appSlug`/`userSlug`. This is the primary "same-app" signal and keeps the implementation simple (3-file change, no protocol changes).

2. **Origin verification (from Option B)** — before auto-allowing, assert that the `postMessage` event's `event.origin` matches the expected sandbox hostname pattern (`userSlug--appSlug.vibes.diy`). This prevents a compromised or malicious iframe from spoofing `appSlug`/`userSlug` in the message payload.

Neither check alone is sufficient:
- Route params alone trust the iframe's self-reported identity in the postMessage payload. A malicious iframe could claim any `appSlug`/`userSlug`.
- Origin verification alone would require parsing the subdomain and changing the message protocol, adding complexity.

Together they form defense-in-depth: the route params provide the simple same-app signal, and the origin check confirms the iframe actually lives at the domain it claims to represent.

### Implementation: pass route context + verify origin

```typescript
// Change the hook signature:
export function useShareableDB(routeContext?: { userSlug: string; appSlug: string }) {
  // ... existing code ...
  // In the grant-check effect:
  const isSameApp = routeContext
    && routeContext.appSlug === pendingDbRef.data.appSlug
    && routeContext.userSlug === pendingDbRef.data.userSlug;
}
```

In `srv-sandbox.ts`, where the `vibe.req.register.fpdb` message is received, add an origin assertion before storing the registration:

```typescript
// In vibeRegisterFPDB(), verify the iframe origin matches the claimed identity
const expectedOrigin = `https://${userSlug}--${appSlug}.${SANDBOX_HOST}`;
if (event.origin !== expectedOrigin) {
  console.warn(`Origin mismatch: expected ${expectedOrigin}, got ${event.origin}`);
  return; // reject the registration
}
```

This ensures that even if a rogue iframe sends a `vibe.req.register.fpdb` with fabricated `appSlug`/`userSlug`, the browser-enforced origin will not match, and the registration is rejected before it ever reaches the auto-allow logic.

Update call sites:
- `AppLayout.tsx`: pass the current chat's userSlug/appSlug from route params
- `vibe.$userSlug.$appSlug.tsx`: pass the route's userSlug/appSlug

### What about the "not signed in" case?

Currently, if the user is not signed in, the dialog prompts login. This should remain unchanged -- you need to be authenticated to sync. The auto-allow only applies after authentication.

### What about explicit denies in Settings?

If a user has explicitly set a grant to `"deny"` in Settings, that should be respected even for same-app. The current `grant?.grant === "deny"` check already handles this and comes before the new auto-allow logic.

## Files to Change

1. **`vibes.diy/pkg/app/hooks/useShareableDB.ts`** -- Add `routeContext` parameter, add same-app auto-allow logic in the grant-check effect
2. **`vibes.diy/pkg/app/components/AppLayout.tsx`** -- Pass route context to `useShareableDB()`
3. **`vibes.diy/pkg/app/routes/vibe.$userSlug.$appSlug.tsx`** -- Pass route context to `useShareableDB()`
4. **`vibes.diy/pkg/app/components/srv-sandbox.ts`** -- Add `event.origin` assertion in `vibeRegisterFPDB()` before storing registration

No changes needed to:
- `AllowFireproofSharing.tsx` (still used for cross-app cases)
- `msg-types.ts` (grants schema unchanged)
- `ensure-user-settings.ts` (server-side unchanged)
- `settings.tsx` (grants management unchanged)

## Summary

The sharing dialog flow is correct for cross-app data access. For same-app access (the common case), auto-allow using a hybrid approach: compare route context to the DB registration's app identity (simple, 3-file change), and verify `event.origin` matches the expected sandbox hostname to prevent spoofed registrations (defense-in-depth, 1 additional file). Persist the auto-grant so it shows up in Settings for user review. Four files change; no protocol or API changes needed.
