# useLiveQuery viewer-ready re-fetch (issue #2285)

**Date:** 2026-06-09
**Issue:** [VibesDIY/vibes.diy#2285](https://github.com/VibesDIY/vibes.diy/issues/2285)
**Scope:** Client-side re-fetch only (defect A). The live cross-instance fanout gap (defect B, `DocNotify`, #2265) is explicitly **out of scope** for this spec.

## Problem

When a viewer loads a vibe, documents they are allowed to read are missing on first load **and after a full reload**, but appear the moment the viewer performs **any local write**. This reproduces in two real cases against `pickathon-picker` (owner `og`):

1. **Cross-user grant.** A reader who was granted access by another user's write does not see the granted doc until the reader writes something themselves.
2. **Same user, two devices.** Device B does not see device A's write on load/reload; a local write at B surfaces it.

Crucially, **this happens even when there is no grant change at all** (case 2). So it is not a grants problem.

## Root cause (confirmed by code trace)

Firefly is not local-first: every read hook issues a fresh backend `query-docs`. The inline read hooks live in [`vibes.diy/vibe/runtime/use-firefly.ts`](../../../../vibes.diy/vibe/runtime/use-firefly.ts).

`createUseLiveQuery` fires its first `database.query()` on mount:

```js
// use-firefly.ts:219-229
const refreshRows = useCallback(async () => {
  const res = await database.query(mapFn, { ...query, includeDocs: true });
  setResult(res);
}, [database, mapFnString, queryString]);
useEffect(() => {
  refreshRows();
  const unsubscribe = database.subscribe(refreshRows);
  return () => {
    unsubscribe();
  };
}, [database, refreshRows]);
```

The decisive detail: **the iframe's viewer identity resolves asynchronously _after_ mount.** On authenticated routes `mountParams.viewerEnv` starts `undefined` (Clerk is not on the HTTP render path); it only populates later, reactively, when a `vibe.evt.viewerChanged` signal arrives — see [`VibeContext.tsx:105-180`](../../../../vibes.diy/vibe/runtime/VibeContext.tsx) (the `setViewerEnv` effect).

So the sequence on every load/reload is:

1. Hook mounts → `refreshRows()` runs **before** the viewer is authenticated.
2. The backend query returns what an unresolved viewer can see (empty for a granted reader; a stale/partial set for a second device).
3. The viewer resolves (`viewerEnv` updates) — but **nothing re-fires `refreshRows`.**

The only things that re-fire `refreshRows` today:

- a **local write**, via `notifyListeners` in [`firefly-database.ts:211`](../../../../vibes.diy/vibe/runtime/firefly-database.ts) — this is "a write fixes it";
- a remote `evt-doc-changed`, via the `onMsg` listener at [`firefly-database.ts:138-148`](../../../../vibes.diy/vibe/runtime/firefly-database.ts) — but cross-instance fanout is dead (#2265), so it never arrives.

There is **no re-fire when the viewer becomes ready.** That is the bug.

### What this rules out (verified)

- **Not** "the client never re-queries on mount." It does (line 224). The issue's original primary hypothesis is contradicted by the code.
- **Not** server-side grant staleness. The server computes grants fresh on every query ([`app-documents-read-eventos.ts:273-325`](../../../../vibes.diy/api/svc/public/app-documents-read-eventos.ts)); there is no per-query grant cache. And the bug occurs with no grant change at all.

## Fix (Approach 1 — hooks key on viewer)

Re-fire the read hooks when the viewer becomes ready / changes, by adding the viewer identity to the query effect's dependencies. This rides the **same** reactive signal that already updates the `access` object in `useFireproof` (use-firefly.ts:95-107), so whatever populates `viewerEnv` will also re-issue the query.

Affected hooks in `use-firefly.ts`:

- `createUseLiveQuery` (primary)
- `createUseAllDocs`
- `createUseChanges`
- `createUseDocument` (its `refresh`)

### Sketch

Inside each returned hook, read a stable viewer key from context and thread it into the existing query effect's dependency array:

```js
function createUseLiveQuery(database) {
  return function useLiveQuery(mapFn, query = {}, initialRows = []) {
    const { mountParams } = useVibeContext();
    const v = mountParams.viewerEnv;
    // Sandbox sees only userHandle (never Clerk userId); pair it with the
    // access level so the effect re-fires when EITHER identity or access
    // resolves null -> value. See vibe/types/index.ts viewerPayload.
    const viewerKey = `${v?.viewer?.userHandle ?? ""}:${v?.access ?? ""}`;
    // ...existing state/memo...
    const refreshRows = useCallback(async () => {
      const res = await database.query(mapFn, { ...query, includeDocs: true });
      setResult(res);
    }, [database, mapFnString, queryString]);
    useEffect(() => {
      refreshRows();
      const unsubscribe = database.subscribe(refreshRows);
      return () => unsubscribe();
    }, [database, refreshRows, viewerKey]); // <-- viewerKey added
    return result;
  };
}
```

`viewerKey` is built from `viewerEnv.viewer.userHandle` (the only identity the sandbox ever sees — never the Clerk `userId`) paired with `viewerEnv.access`. When it transitions from empty → resolved (and on any later identity/access change), the effect re-runs and re-queries with the now-authenticated context. `viewerEnv` is updated by the `window` `message` listener in `VibeContext.tsx:111-124`, which catches both the parent's `postMessage` and `bootstrapViewer`'s synthetic dispatch — so the boot-time signal is covered.

### Why Approach 1 over Approach 2

Approach 2 (have `FireflyDatabase` react to `isEvtVibeViewerChanged` in its `onMsg` handler and `notifyListeners`) is more centralized, but it depends on `viewerChanged` reaching the iframe through the `onMsg` **postMessage** channel. On boot, `bootstrapViewer` ([`register-dependencies.ts`](../../../../vibes.diy/vibe/runtime/register-dependencies.ts)) dispatches `viewerChanged` as a **window** event, not necessarily through `onMsg` — so Approach 2 risks missing the initial-load case, which is exactly the case that's broken. Approach 1 rides the proven `viewerEnv` reactive path that already updates `access`, so it cannot miss a signal that `access` already sees.

## Risk / correctness considerations

- **No duplicate-query storm:** the effect re-runs only when `viewerKey` actually changes (null → resolved, then identity changes). Steady state is unchanged.
- **Owner / no-viewer apps:** apps with no authenticated viewer keep `viewerKey === null`; the effect fires once on mount exactly as today. No behavior change.
- **No-access-fn apps:** unaffected logically, but they share the same hooks, so they must be regression-tested (see Verification). The two-device control repro is a no-access-fn app.
- **`useDocument`:** its `refresh` effect (use-firefly.ts:193-195) should re-fire on viewer-ready too, so a doc fetched by `_id` before auth re-fetches once auth resolves.

## Verification

1. **Unit/integration:** a hook test that mounts a read hook with `viewerEnv` initially `undefined`, asserts the query result is empty, then simulates `viewerChanged` resolving the viewer and asserts the query re-fires and the granted/owned doc appears — **without any local write.** This is the regression guard that fails on `main` and passes with the fix.
2. **No-access-fn control vibes:** create simple test vibes that do **not** bind an access function and confirm they still work correctly (single-device load, two-device behavior as a control for the live-fanout gap which remains out of scope). Per the maintainer's request.
3. **Manual (chrome-MCP):** load `pickathon-picker` as a granted reader, confirm the doc is absent at the racing mount query and present after viewer-ready re-fire, with no local write. Confirm the same flow on a no-access-fn app for a second device on reload.

## Out of scope

- **Defect B — live cross-instance fanout** (`DocNotify` declared but `env.DOC_NOTIFY` never invoked; #2265). Without it, a _live_ push of a remote write still won't arrive; the viewer must reload (which this fix makes correct) to see remote changes. A real coordinator or a single-`AppSessions`-DO-per-vibe guarantee is tracked separately.

## Open questions (for Charlie review on the PR)

Resolved from the code while authoring this spec:

- **Boot signal (was Q1):** `viewerEnv` is updated by a `window` `message` listener (`VibeContext.tsx:111-124`) filtering `isEvtVibeViewerChanged`. It catches both the parent `postMessage` and `bootstrapViewer`'s synthetic dispatch, so the initial-load case is covered.
- **Identity field (was Q2):** the sandbox only ever sees `viewer.userHandle` (`vibe/types/index.ts:460` `viewerPayload`), never the Clerk `userId`. Key is `userHandle` + `access` level.

Still open for Charlie:

1. **Hooks vs DB-level:** confirm Approach 1 (hooks key on viewer) is preferred over Approach 2 (`FireflyDatabase` reacting to `isEvtVibeViewerChanged`). Approach 1 rides the proven `viewerEnv` reactive path; Approach 2 is tidier but depends on the event traversing `onMsg`. Any reason to prefer the centralized DB-level re-fire?
2. **Composite key churn:** keying on `userHandle:access` re-fires the query when access level changes too. Is there a scenario where `access` legitimately churns mid-session and would cause unwanted extra queries, or is null→value the only transition in practice?
