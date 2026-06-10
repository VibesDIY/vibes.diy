# Live doc re-subscribe + re-query on grant change — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A non-owner reader gets newly-granted docs **live** (no manual reload) by re-firing read queries and re-issuing `subscribeDocs` when their effective grants change.

**Architecture:** Client-only. Both fixes ride the existing `viewerEnv` reactive path (`VibeContext` updates `viewerEnv` from `vibe.evt.viewerChanged`, which the reader already receives after `viewer-grants-changed`). (1) Widen the read hooks' re-fire key from `userHandle:access` to also include a **sorted+deduped per-db grants signature**, so a new grant re-runs the query. (2) Add `FireflyDatabase.resubscribe()` and call it from `useFireproof` when the per-db grants signature changes, so the server-side channel snapshot refreshes for ongoing liveness. No server change; no coordinator.

**Tech Stack:** TypeScript, React hooks, Vitest + @testing-library/react. Files in `vibes.diy/vibe/runtime/`; tests in `vibes.diy/tests/app/`.

**Spec:** [`../specs/2026-06-09-live-doc-grants-resubscribe-design.md`](../specs/2026-06-09-live-doc-grants-resubscribe-design.md)

---

## File structure

- **Modify** `vibes.diy/vibe/runtime/use-firefly.ts` — add a module-scope `grantsSignature(viewerEnv, dbName)` helper; widen `viewerKey` in `createUseDocument`, `createUseLiveQuery`, `createUseAllDocs`, `createUseChanges`; add a re-subscribe `useEffect` in `useFireproof`.
- **Modify** `vibes.diy/vibe/runtime/firefly-database.ts` — extract the constructor's doc-subscribe into a public `resubscribe()` method and call it from the constructor.
- **Modify** `vibes.diy/tests/app/use-firefly.test.tsx` — add a describe block covering grants-change re-query, re-subscribe, and signature stability.

All paths are relative to the repo root (the worktree at `.claude/worktrees/jchris+live-doc-grants-resubscribe/`). Run the test from `vibes.diy/tests/app/`.

---

## Task 1: Re-query read hooks on a grants-only change

A reader's `viewer-grants-changed` updates `viewerEnv.grants` but does not change `userHandle` or the `access` level, so today's `viewerKey` is stable and the read hooks never re-fire. Widen the key with a per-db grants signature.

**Files:**

- Modify: `vibes.diy/vibe/runtime/use-firefly.ts`
- Test: `vibes.diy/tests/app/use-firefly.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append this describe block to `vibes.diy/tests/app/use-firefly.test.tsx` (after the existing `#2285` block). It keeps `userHandle` and `access` constant and changes only grants, so it fails on `main` (stable `viewerKey`).

```tsx
// ── grant-change re-query + re-subscribe (live doc updates) ─────────

describe("HOOK: useLiveQuery re-queries on a grants-only change", () => {
  function viewerChanged(dbName: string, channels: string[]) {
    return new MessageEvent("message", {
      data: {
        type: "vibe.evt.viewerChanged",
        viewer: { userHandle: "anna" },
        access: "viewer",
        grants: { [dbName]: { channels, publicChannels: [], roles: [] } },
      },
    });
  }

  it(
    "re-fires the query when a new grant adds a channel (same user, same access)",
    async () => {
      const dbName = uniqueDbName();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VibeContextProvider
          mountParams={{
            usrEnv: {},
            viewerEnv: {
              viewer: { userHandle: "anna" },
              access: "viewer",
              grants: { [dbName]: { channels: [], publicChannels: [], roles: [] } },
            },
          }}
        >
          {children}
        </VibeContextProvider>
      );

      renderHook(
        () => {
          const { useLiveQuery } = useFireproof(dbName);
          return useLiveQuery("foo");
        },
        { wrapper }
      );

      await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(0));
      const before = mockApi._queryDocsFilterHints.length;

      act(() => {
        window.dispatchEvent(viewerChanged(dbName, ["c1"]));
      });

      await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(before));
    },
    TEST_TIMEOUT
  );

  it(
    "does NOT re-fire when the grant arrays only reorder (sorted signature)",
    async () => {
      const dbName = uniqueDbName();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VibeContextProvider
          mountParams={{
            usrEnv: {},
            viewerEnv: {
              viewer: { userHandle: "anna" },
              access: "viewer",
              grants: { [dbName]: { channels: ["a", "b"], publicChannels: [], roles: [] } },
            },
          }}
        >
          {children}
        </VibeContextProvider>
      );

      renderHook(
        () => {
          const { useLiveQuery } = useFireproof(dbName);
          return useLiveQuery("foo");
        },
        { wrapper }
      );

      await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(0));
      const before = mockApi._queryDocsFilterHints.length;

      act(() => {
        window.dispatchEvent(viewerChanged(dbName, ["b", "a"]));
      });

      // Give any spurious effect a chance to fire, then assert none did.
      await new Promise((r) => setTimeout(r, 50));
      expect(mockApi._queryDocsFilterHints.length).toBe(before);
    },
    TEST_TIMEOUT
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd vibes.diy/tests/app && pnpm test use-firefly`
Expected: the "re-fires the query when a new grant adds a channel" test FAILS (query count does not increase, because `viewerKey` is `anna:viewer` before and after). The reorder test passes incidentally on `main` (nothing re-fires at all), but keep it — it guards the fix.

- [ ] **Step 3: Add the `grantsSignature` helper**

In `vibes.diy/vibe/runtime/use-firefly.ts`, add the import and a module-scope helper near the top (after the existing imports / `EMPTY_ACCESS`). The `ViewerEnv` type is exported from `./vibe.js`.

```ts
import type { ViewerEnv } from "./vibe.js";

// Stable per-db signature over the viewer's grants for one database.
// Sorted + de-duped so reordered who-am-i arrays (who-am-i builds them from
// Sets via Array.from without sorting) don't churn the key. Empty when the
// db has no grants (no-access-fn apps) — those keep the prior behaviour.
function grantsSignature(viewerEnv: ViewerEnv | undefined, dbName: string): string {
  const g = viewerEnv?.grants?.[dbName];
  if (!g) return "";
  const sig = (arr: readonly string[] | undefined) => [...new Set(arr ?? [])].sort().join(",");
  return `${sig(g.channels)}|${sig(g.publicChannels)}|${sig(g.roles)}`;
}
```

- [ ] **Step 4: Widen `viewerKey` in all four read hooks**

In `createUseDocument`, `createUseLiveQuery`, `createUseAllDocs`, and `createUseChanges`, each currently computes:

```ts
const viewerKey = `${viewerEnv?.viewer?.userHandle ?? ""}:${viewerEnv?.access ?? ""}`;
```

Replace each occurrence with (the factory's `database` is in scope, so `database.name` is the dbName):

```ts
const viewerKey = `${viewerEnv?.viewer?.userHandle ?? ""}:${viewerEnv?.access ?? ""}:${grantsSignature(viewerEnv, database.name)}`;
```

No other lines change — each hook's existing `useEffect(..., [..., viewerKey])` now re-fires on a grants-only change.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd vibes.diy/tests/app && pnpm test use-firefly`
Expected: both new tests PASS, and all pre-existing `use-firefly` tests still pass.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/vibe/runtime/use-firefly.ts vibes.diy/tests/app/use-firefly.test.tsx
git commit -m "feat(firefly): re-query read hooks on a grants-only change (#2285 sibling)

Widen the viewer re-fire key from userHandle:access to also include a
sorted+deduped per-db grants signature, so a new grant (which doesn't
change the access level) re-runs the query and the newly-readable doc
appears live."
```

---

## Task 2: Re-subscribe docs when the per-db grants signature changes

Re-querying surfaces the triggering doc, but ongoing liveness for that new channel needs the server-side subscription snapshot refreshed. Add `FireflyDatabase.resubscribe()` and call it from `useFireproof` on a grants change (skipping the initial mount, which the constructor already subscribed).

**Files:**

- Modify: `vibes.diy/vibe/runtime/firefly-database.ts`
- Modify: `vibes.diy/vibe/runtime/use-firefly.ts`
- Test: `vibes.diy/tests/app/use-firefly.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to the `describe("HOOK: useLiveQuery re-queries on a grants-only change", …)` block from Task 1 (it shares the `viewerChanged` helper):

```tsx
it(
  "re-issues subscribeDocs for the db when a new grant arrives",
  async () => {
    const dbName = uniqueDbName();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <VibeContextProvider
        mountParams={{
          usrEnv: {},
          viewerEnv: {
            viewer: { userHandle: "anna" },
            access: "viewer",
            grants: { [dbName]: { channels: [], publicChannels: [], roles: [] } },
          },
        }}
      >
        {children}
      </VibeContextProvider>
    );

    renderHook(
      () => {
        const { useLiveQuery } = useFireproof(dbName);
        return useLiveQuery("foo");
      },
      { wrapper }
    );

    // Constructor subscribes once on mount.
    await waitFor(() => expect(mockApi._subscribeDocsCalls.filter((n) => n === dbName).length).toBe(1));

    act(() => {
      window.dispatchEvent(viewerChanged(dbName, ["c1"]));
    });

    // Fix: the grant change re-issues subscribeDocs for this db.
    await waitFor(() => expect(mockApi._subscribeDocsCalls.filter((n) => n === dbName).length).toBeGreaterThan(1));
  },
  TEST_TIMEOUT
);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd vibes.diy/tests/app && pnpm test use-firefly`
Expected: FAILS — `subscribeDocs` is called exactly once (constructor) and never again, so the count stays at 1.

- [ ] **Step 3: Add `resubscribe()` to `FireflyDatabase`**

In `vibes.diy/vibe/runtime/firefly-database.ts`, replace the inline subscribe in the constructor (the `this.vibeApi.subscribeDocs(this.name).then(...)` block at lines ~125-129) with a call to a new method, and add the method. The constructor block becomes:

```ts
// Subscribe to remote doc-changed events for THIS db (cross-client sync).
// Each FireflyDatabase subscribes for its own name. Fire-and-forget; the
// client-side subscribeDocs deduplicates by key, so re-calls stay safe.
this.resubscribe();
```

Add the method to the class (e.g. just below `applyAcl`):

```ts
  /**
   * Re-issue the doc subscription so the server refreshes this connection's
   * channel snapshot — e.g. after the viewer's grants change and new channels
   * become readable. Safe to call repeatedly; subscribeDocs dedupes by key.
   */
  resubscribe(): void {
    this.vibeApi.subscribeDocs(this.name).then((rRes) => {
      if (rRes.isErr()) {
        console.error(`Failed to subscribe to docs for db "${this.name}":`, rRes.Err());
      }
    });
  }
```

- [ ] **Step 4: Call `resubscribe()` from `useFireproof` on a grants change**

In `vibes.diy/vibe/runtime/use-firefly.ts`, inside `useFireproof` (which already reads `mountParams.viewerEnv` and has `database` + `name`), add — after the existing `access` `useMemo` and before the `return`:

```ts
// Re-subscribe when this db's grants change so the server refreshes the
// channel snapshot (new per-doc channels become live). Compare against the
// previously-committed signature rather than skip-first so a StrictMode
// double-invoke on mount can't trigger a spurious re-subscribe — the
// constructor already subscribed once on mount.
const grantsSig = grantsSignature(mountParams.viewerEnv, name);
const lastGrantsSig = useRef(grantsSig);
useEffect(() => {
  if (lastGrantsSig.current === grantsSig) return;
  lastGrantsSig.current = grantsSig;
  database.resubscribe();
}, [database, grantsSig]);
```

(`useEffect` and `useRef` are already imported at the top of the file.) Multiple `useFireproof(name)` callers each run this effect; the client-side `subscribeDocs` dedupe makes the redundant re-subscribes harmless.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd vibes.diy/tests/app && pnpm test use-firefly`
Expected: the re-subscribe test PASSES; all earlier tests (including Task 1's) still pass.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/vibe/runtime/firefly-database.ts vibes.diy/vibe/runtime/use-firefly.ts vibes.diy/tests/app/use-firefly.test.tsx
git commit -m "feat(firefly): re-subscribe docs when a db's grants change

Adds FireflyDatabase.resubscribe() (the constructor now uses it) and calls
it from useFireproof when the per-db grants signature changes, so the
server-side channel snapshot refreshes and subsequent edits to a
newly-granted doc/channel push live."
```

---

## Task 3: Regression guard + full verification

- [ ] **Step 1: Confirm no-access-fn behaviour is unchanged**

The existing test "no-access-fn app (no grants) still re-fetches on viewer-ready and is otherwise unchanged" already covers the empty-grants path (`grantsSignature` returns `""`, so the key reduces to the prior `userHandle:access` form). Confirm it still passes:

Run: `cd vibes.diy/tests/app && pnpm test use-firefly`
Expected: all tests PASS, including the no-access-fn control.

- [ ] **Step 2: Run the full check**

Run from the repo root: `pnpm fast-check 2>&1 | tee /tmp/grants-resubscribe-check.log | tail -25`
Expected: type-check, lint, and the test suite pass. (CI runs full `pnpm check`.)

- [ ] **Step 3: Format changed files**

Run: `npx prettier --write vibes.diy/vibe/runtime/use-firefly.ts vibes.diy/vibe/runtime/firefly-database.ts vibes.diy/tests/app/use-firefly.test.tsx`

- [ ] **Step 4: Commit any formatting**

```bash
git add -A
git commit -m "style: prettier on grants re-subscribe changes" || echo "nothing to format"
```

---

## Manual verification (post-merge-candidate, by operator)

Per the spec, the faithful same-DO repro is **two browser tabs** of an access-fn vibe (both on the same `AppSessions` DO), not two CLI connections (which land on separate `CHAT_SESSIONS` DOs). Seed an access-fn test vibe with `npx vibes-diy`, open it in two tabs as reader + writer, and confirm a write that grants the reader appears live with no reload, and that a follow-up edit also pushes live.
