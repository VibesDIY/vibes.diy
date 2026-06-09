# useLiveQuery viewer-ready re-fetch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the inline Firefly read hooks (`useLiveQuery`, `useAllDocs`, `useChanges`, `useDocument`) re-issue their backend query when the iframe viewer becomes ready / changes, so allowed documents appear on load and reload instead of only after a local write (#2285).

**Architecture:** The hooks fire their first `database.query()` on mount, before the viewer identity resolves asynchronously via a `vibe.evt.viewerChanged` window message (which updates `VibeContext`'s `viewerEnv`). Today nothing re-fires the query when the viewer resolves. The fix derives a stable `viewerKey` (`viewer.userHandle` + `access`) from `useVibeContext()` inside each read hook and adds it to the query effect's dependency array, so the effect re-runs — and re-queries — the moment the viewer resolves. Scope is client re-fetch only; the live cross-instance fanout gap (#2265) is out of scope.

**Tech Stack:** TypeScript, React hooks, Vitest + @testing-library/react, arktype.

**Spec:** `docs/superpowers/specs/2026-06-09-livequery-viewer-ready-refetch-design.md`

---

## File Structure

- Modify: `vibes.diy/vibe/runtime/use-firefly.ts` — add `viewerKey` (from `useVibeContext()`) to the query effect deps in `createUseLiveQuery`, `createUseAllDocs`, `createUseChanges`, and the refresh effect in `createUseDocument`. `useVibeContext` is already imported (line 12).
- Modify (test): `vibes.diy/tests/app/use-firefly.test.tsx` — add regression coverage that a viewer-ready signal re-fires the backend query with no local write, for `useLiveQuery`, `useAllDocs`, `useChanges`, and `useDocument`, plus a no-access-fn (no grants) control.

No new files. The mock (`vibes.diy/tests/app/mock-vibe-api.ts`) already exposes `_queryDocsFilterHints` (one entry pushed per `queryDocs` call) — call-count deltas are how we assert a re-fire.

**Test run command (used in every task):**

```bash
cd vibes.diy/tests/app && pnpm run test use-firefly
```

---

### Task 1: Failing regression test — `useLiveQuery` re-fires on viewer-ready

**Files:**

- Test: `vibes.diy/tests/app/use-firefly.test.tsx` (append a new `describe` at end of file)

- [ ] **Step 1: Write the failing test**

Append to `vibes.diy/tests/app/use-firefly.test.tsx`:

```tsx
// ── viewer-ready re-fetch (#2285) ───────────────────────────────────

describe("HOOK: useLiveQuery viewer-ready re-fetch (#2285)", () => {
  it(
    "re-issues the backend query when the viewer resolves, with no local write",
    async () => {
      const dbName = uniqueDbName();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <VibeContextProvider mountParams={{ usrEnv: {} }}>{children}</VibeContextProvider>
      );

      renderHook(
        () => {
          const { useLiveQuery } = useFireproof(dbName);
          return useLiveQuery("foo");
        },
        { wrapper }
      );

      // Mount fires the first backend query while the viewer is unresolved.
      await waitFor(() => {
        expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(0);
      });
      const callsBeforeViewer = mockApi._queryDocsFilterHints.length;

      // Drive the real signal VibeContext listens to: a window "message"
      // event carrying vibe.evt.viewerChanged → setViewerEnv → viewer resolves.
      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: { type: "vibe.evt.viewerChanged", viewer: { userHandle: "anna" }, access: "viewer" },
          })
        );
      });

      // The fix: viewer-ready re-fires the query with no local write.
      await waitFor(() => {
        expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(callsBeforeViewer);
      });
    },
    TEST_TIMEOUT
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/tests/app && pnpm run test use-firefly`
Expected: FAIL — the new test times out in the final `waitFor` because dispatching `viewerChanged` updates `viewerEnv` but does **not** re-fire `refreshRows` (effect deps are `[database, refreshRows]`, both stable across the viewer change). Call count stays at `callsBeforeViewer`. Existing tests still pass.

- [ ] **Step 3: Commit the failing test**

```bash
git add vibes.diy/tests/app/use-firefly.test.tsx
git commit -m "test(firefly): failing regression — useLiveQuery must re-fetch on viewer-ready (#2285)"
```

---

### Task 2: Implement the fix in `createUseLiveQuery`

**Files:**

- Modify: `vibes.diy/vibe/runtime/use-firefly.ts:209-232` (`createUseLiveQuery`)

- [ ] **Step 1: Add `viewerKey` and thread it into the effect deps**

Replace `createUseLiveQuery` (use-firefly.ts:209-232) with:

```js
function createUseLiveQuery(database: FireflyDatabase) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function useLiveQuery(mapFn: any, query: any = {}, initialRows: any[] = []) {
    // Re-fetch when the viewer resolves/changes. The sandbox only ever sees
    // viewer.userHandle (never Clerk userId); pair it with the access level so
    // the query re-fires when EITHER flips null -> value. Without this, the
    // first query runs before auth resolves and nothing re-issues it until a
    // local write — the #2285 "reload misses, write fixes" bug.
    const { mountParams } = useVibeContext();
    const viewerEnv = mountParams.viewerEnv;
    const viewerKey = `${viewerEnv?.viewer?.userHandle ?? ""}:${viewerEnv?.access ?? ""}`;
    const [result, setResult] = useState({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      docs: initialRows.map((r: any) => r.doc).filter((r: any) => !!r),
      rows: initialRows,
    });
    const queryString = useMemo(() => JSON.stringify(query), [query]);
    const mapFnString = useMemo(() => mapFn.toString(), [mapFn]);
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
    }, [database, refreshRows, viewerKey]);
    return result;
  };
}
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `cd vibes.diy/tests/app && pnpm run test use-firefly`
Expected: PASS — all tests, including the new viewer-ready test. The query call count increments after the `viewerChanged` dispatch.

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/vibe/runtime/use-firefly.ts
git commit -m "fix(firefly): useLiveQuery re-fetches when viewer becomes ready (#2285)"
```

---

### Task 3: Extend the fix to `useAllDocs`, `useChanges`, `useDocument` + regression coverage

**Files:**

- Modify: `vibes.diy/vibe/runtime/use-firefly.ts` (`createUseAllDocs`, `createUseChanges`, `createUseDocument`)
- Test: `vibes.diy/tests/app/use-firefly.test.tsx`

- [ ] **Step 1: Write failing tests for the three sibling hooks**

Append to the `#2285` describe block in `vibes.diy/tests/app/use-firefly.test.tsx`:

```tsx
it(
  "useAllDocs re-issues the query when the viewer resolves",
  async () => {
    const dbName = uniqueDbName();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <VibeContextProvider mountParams={{ usrEnv: {} }}>{children}</VibeContextProvider>
    );
    renderHook(
      () => {
        const { useAllDocs } = useFireproof(dbName);
        return useAllDocs();
      },
      { wrapper }
    );
    await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(0));
    const before = mockApi._queryDocsFilterHints.length;
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "vibe.evt.viewerChanged", viewer: { userHandle: "anna" }, access: "viewer" },
        })
      );
    });
    await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(before));
  },
  TEST_TIMEOUT
);

it(
  "useDocument re-fetches an existing doc when the viewer resolves",
  async () => {
    const dbName = uniqueDbName();
    const { result: fpResult } = renderHook(() => useFireproof(dbName));
    const { id } = await fpResult.current.database.put({ input: "existing" });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <VibeContextProvider mountParams={{ usrEnv: {} }}>{children}</VibeContextProvider>
    );
    let getCalls = 0;
    const realGet = fpResult.current.database.get.bind(fpResult.current.database);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fpResult.current.database as any).get = async (docId: string) => {
      getCalls++;
      return realGet(docId);
    };

    renderHook(
      () => {
        const { useDocument } = fpResult.current;
        return useDocument({ _id: id });
      },
      { wrapper }
    );
    await waitFor(() => expect(getCalls).toBeGreaterThan(0));
    const before = getCalls;
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "vibe.evt.viewerChanged", viewer: { userHandle: "anna" }, access: "viewer" },
        })
      );
    });
    await waitFor(() => expect(getCalls).toBeGreaterThan(before));
  },
  TEST_TIMEOUT
);
```

- [ ] **Step 2: Run to verify the two new tests fail**

Run: `cd vibes.diy/tests/app && pnpm run test use-firefly`
Expected: FAIL — `useAllDocs` and `useDocument` tests time out (their effects don't yet depend on the viewer). `useLiveQuery` test still passes.

- [ ] **Step 3: Apply the same `viewerKey` fix to the three sibling hooks**

In `createUseAllDocs` (use-firefly.ts), add the viewer read at the top of the returned hook and append `viewerKey` to its effect deps:

```js
function createUseAllDocs(database: FireflyDatabase) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function useAllDocs(query: any = {}) {
    const { mountParams } = useVibeContext();
    const viewerEnv = mountParams.viewerEnv;
    const viewerKey = `${viewerEnv?.viewer?.userHandle ?? ""}:${viewerEnv?.access ?? ""}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result, setResult] = useState<any>({ docs: [], rows: [] });
    const queryString = useMemo(() => JSON.stringify(query), [query]);
    const refreshRows = useCallback(async () => {
      const res = await database.allDocs(query);
      setResult({
        ...res,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        docs: res.rows.map((r: any) => r.value),
      });
    }, [database, queryString]);
    useEffect(() => {
      refreshRows();
      const unsubscribe = database.subscribe(refreshRows);
      return () => {
        unsubscribe();
      };
    }, [database, refreshRows, viewerKey]);
    return result;
  };
}
```

In `createUseChanges` (use-firefly.ts), same pattern, append `viewerKey` to its effect deps:

```js
function createUseChanges(database: FireflyDatabase) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function useChanges(_since: any[] = [], opts: any = {}) {
    const { mountParams } = useVibeContext();
    const viewerEnv = mountParams.viewerEnv;
    const viewerKey = `${viewerEnv?.viewer?.userHandle ?? ""}:${viewerEnv?.access ?? ""}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result, setResult] = useState<any>({ docs: [], rows: [] });
    const queryString = useMemo(() => JSON.stringify(opts), [opts]);
    const refreshRows = useCallback(async () => {
      const res = await database.changes();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setResult({ ...res, docs: res.rows.map((r: any) => r.value) });
    }, [queryString]);
    useEffect(() => {
      refreshRows();
      return database.subscribe(refreshRows);
    }, [refreshRows, viewerKey]);
    return result;
  };
}
```

In `createUseDocument` (use-firefly.ts), read the viewer at the top of the returned hook and append `viewerKey` to the refresh-on-mount effect (currently `useEffect(() => { void refresh(); }, [refresh])`):

```js
function createUseDocument(database: FireflyDatabase) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function useDocument(initialDocOrFn?: any) {
    const { mountParams } = useVibeContext();
    const viewerEnv = mountParams.viewerEnv;
    const viewerKey = `${viewerEnv?.viewer?.userHandle ?? ""}:${viewerEnv?.access ?? ""}`;
    const updateHappenedRef = useRef(false);
    // ...everything else in this hook stays exactly as-is...
```

and change only the mount-refresh effect near the bottom of `useDocument`:

```js
useEffect(() => {
  void refresh();
}, [refresh, viewerKey]);
```

Leave the `useDocument` subscribe effect (`[doc._id, refresh]`) and all callbacks unchanged.

- [ ] **Step 4: Run to verify all tests pass**

Run: `cd vibes.diy/tests/app && pnpm run test use-firefly`
Expected: PASS — all viewer-ready tests for `useLiveQuery`, `useAllDocs`, and `useDocument`, plus every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/vibe/runtime/use-firefly.ts vibes.diy/tests/app/use-firefly.test.tsx
git commit -m "fix(firefly): re-fetch useAllDocs/useChanges/useDocument on viewer-ready (#2285)"
```

---

### Task 4: No-access-fn control + steady-state guard, then full suite

**Files:**

- Test: `vibes.diy/tests/app/use-firefly.test.tsx`

- [ ] **Step 1: Add a no-access-fn control and a no-churn guard**

Append to the `#2285` describe block:

```tsx
it(
  "no-access-fn app (no grants) still re-fetches on viewer-ready and is otherwise unchanged",
  async () => {
    const dbName = uniqueDbName();
    // viewerEnv carries NO grants — models an app with no access function.
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <VibeContextProvider mountParams={{ usrEnv: {} }}>{children}</VibeContextProvider>
    );
    const { result } = renderHook(
      () => {
        const fp = useFireproof(dbName);
        return { live: fp.useLiveQuery("foo"), access: fp.access };
      },
      { wrapper }
    );
    await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(0));
    // Access stays empty with no grants — unaffected by the fix.
    expect(result.current.access.channels.size).toBe(0);
    const before = mockApi._queryDocsFilterHints.length;
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "vibe.evt.viewerChanged", viewer: { userHandle: "solo" }, access: "viewer" },
        })
      );
    });
    await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(before));
  },
  TEST_TIMEOUT
);

it(
  "does not re-query on an unrelated re-render (no viewer change)",
  async () => {
    const dbName = uniqueDbName();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <VibeContextProvider mountParams={{ usrEnv: {} }}>{children}</VibeContextProvider>
    );
    const { rerender } = renderHook(
      () => {
        const { useLiveQuery } = useFireproof(dbName);
        return useLiveQuery("foo");
      },
      { wrapper }
    );
    await waitFor(() => expect(mockApi._queryDocsFilterHints.length).toBeGreaterThan(0));
    const before = mockApi._queryDocsFilterHints.length;
    rerender();
    rerender();
    // No viewer change → no extra backend queries (guards against a storm).
    await new Promise((r) => setTimeout(r, 50));
    expect(mockApi._queryDocsFilterHints.length).toBe(before);
  },
  TEST_TIMEOUT
);
```

- [ ] **Step 2: Run the file**

Run: `cd vibes.diy/tests/app && pnpm run test use-firefly`
Expected: PASS — including the no-access-fn control and the no-churn guard.

- [ ] **Step 3: Run the full app test package**

Run: `cd vibes.diy/tests/app && pnpm run test`
Expected: PASS — no regressions across the runtime hook suite.

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/tests/app/use-firefly.test.tsx
git commit -m "test(firefly): no-access-fn control + no-churn guard for viewer-ready re-fetch (#2285)"
```

---

## Notes for the implementer

- `useVibeContext()` returns the default context value `{ mountParams: { usrEnv: {} } }` when no `VibeContextProvider` is present (see `VibeContext.tsx:96-98`), so `viewerKey` is `":"` and the read hooks fire exactly once on mount — pre-existing tests that render without a provider are unaffected.
- `viewerKey` is intentionally a primitive string so React can compare it by value; adding it to a dependency array is allowed by `react-hooks/exhaustive-deps` (the rule flags _missing_ deps, not extra ones).
- The `access` level is included in `viewerKey` deliberately (see spec open question 2): identity and access both flip null→value when the viewer resolves; if Charlie flags that `access` churns mid-session, drop it and key on `userHandle` alone.
  </content>
