# Auto-Allow Database Sharing for Same-App Access

## The Principle

When a user visits a published app at `/@userSlug/appSlug`, they arrived by following a shared URL. The Fireproof database is already namespaced to that app via sandbox domain isolation (`appSlug--userSlug.vibes.diy`). Prompting "Allow sharing?" adds unnecessary friction -- of course they want to share data with the app they deliberately navigated to. The sugar-sync patch removes this redundant confirmation for the common case while preserving the dialog for cross-app access.

## What Changed

Five files were modified to implement route-aware auto-allow:

**`useShareableDB.ts`** now accepts an optional `routeContext` containing `userSlug` and `appSlug` from the current route. When a database registration's identity matches the route context and no existing grant (allow or deny) is found, the hook auto-allows instead of showing the dialog. The grant is persisted to user settings so it appears in the Settings page for later review.

**`srv-sandbox.ts`** adds origin verification in the `vibeRegisterFPDB` validate step. Before accepting a database registration, it checks that `event.origin`'s hostname starts with `appSlug--userSlug.`, preventing a malicious iframe from spoofing its identity to trigger auto-allow.

**`AppLayout.tsx`**, **`chat.$userSlug.$appSlug.tsx`**, and **`vibe.$userSlug.$appSlug.tsx`** wire route params through to the hook so the route context is available where sharing decisions are made.

## When the Dialog Still Appears

- Cross-app data access (one app trying to read another app's database)
- The user has explicitly set a "deny" grant in Settings
- The user is not signed in (a login prompt is shown instead)

## Security Model

The auto-allow decision uses a hybrid of two signals: route-param matching as a simple same-app indicator, and browser-enforced origin verification as defense-in-depth. Neither is sufficient alone -- route params trust the message payload without verifying the sender, and origin-only checking would add protocol complexity without the readable intent signal. Together they ensure auto-allow only fires for legitimate same-app access on the correct sandbox domain.
