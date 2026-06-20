# A1 — Route vibe-scoped doc ops through `vibeApi`

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development or executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** On routes that already have a `vibeApi` (AppSessions) connection,
switch vibe-scoped doc ops and `subscribeViewerGrants` from `chatApi` to
`vibeApi ?? chatApi`, so doc-changed fan-out and local QuickJS access-fn eval
happen on AppSessions. Chat-streaming stays on `chatApi`. No server changes.

**Architecture:** `useVibesDiy()` exposes `chatApi` (ChatSessions) and optional
`vibeApi` (AppSessions). On `/vibe/…` and `/chat/…` routes `vibeApi` is defined.
Doc ops on `chatApi` today silently skip broadcast (ChatSessions guards
notification callbacks to no-op) and route access-fn eval to the
soon-to-be-deleted `AccessFnDO`. Moving them to `vibeApi` fixes both.

**Tech Stack:** TypeScript, React, Vitest.

**Spec:** `../../specs/2026-06-20-do-split-finish-design.md` (Track A1).

---

## File Map

| File | Change |
| --- | --- |
| `vibes.diy/pkg/app/components/ResultPreview/CommentsSection.tsx` | use `vibeApi ?? chatApi` for `queryDocs`/`subscribeDocs`/`onDocChanged`/`putDoc`/`whoAmI` |
| `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx` | use `vibeApi ?? chatApi` for `subscribeViewerGrants`/`onViewerGrantsChanged` and any doc ops; keep chat/grant-RPC calls as-is for now |
| `vibes.diy/tests/app/comments-section-avatar.test.tsx` (and any CommentsSection test) | inject a `vibeApi` and assert ops target it |

> Note: grant/invite/membership RPCs (`createInvite`, `listMembers`,
> `requestAccess`, …) are `sharedHandlers`, not doc ops — they do **not** reach
> `AccessFnDO`. Leave them on `chatApi` in A1; they move in Track B
> (SharedSessions). Touching them here would widen the blast radius for no gain.

---

## Task 1: CommentsSection doc ops → `vibeApi ?? chatApi`

**Files:**

- Modify: `vibes.diy/pkg/app/components/ResultPreview/CommentsSection.tsx`
- Test: `vibes.diy/tests/app/comments-section-avatar.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a test that injects a context with a spy `vibeApi` distinct from `chatApi`
and asserts `queryDocs` is called on `vibeApi`. Use the existing
`<VibesDiyContext.Provider>` injection pattern (the provider exports
`VibesDiyContext` precisely so tests can inject — see its `@internal` note).

```tsx
it("routes comment doc ops through vibeApi when present", async () => {
  const calls: string[] = [];
  const mkApi = (tag: string) =>
    ({
      whoAmI: async () => Result.Ok({ viewer: { userHandle: "me" } }),
      queryDocs: async () => {
        calls.push(`${tag}:queryDocs`);
        return Result.Ok({ docs: [] });
      },
      subscribeDocs: async () => Result.Ok({}),
      onDocChanged: () => () => undefined,
      putDoc: async () => {
        calls.push(`${tag}:putDoc`);
        return Result.Ok({});
      },
    }) as unknown as VibesDiyApiIface;
  const ctx = { sthis: {}, chatApi: mkApi("chat"), vibeApi: mkApi("vibe"), webVars: {}, srvVibeSandbox: {} } as unknown as VibesDiyCtx;
  render(
    <VibesDiyContext.Provider value={ctx}>
      <CommentsSection ownerHandle="o" appSlug="a" canModerate={false} composerDisabled={false} />
    </VibesDiyContext.Provider>,
  );
  await waitFor(() => expect(calls).toContain("vibe:queryDocs"));
  expect(calls).not.toContain("chat:queryDocs");
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd vibes.diy/tests && pnpm test comments-section-avatar -- --run`
Expected: FAIL — `calls` contains `chat:queryDocs`, not `vibe:queryDocs`.

- [ ] **Step 3: Minimal implementation**

In `CommentsSection.tsx`, replace the destructure and pick a single connection
for doc ops:

```tsx
// Before
const { chatApi } = useVibesDiy();

// After
const { chatApi, vibeApi } = useVibesDiy();
// Vibe-scoped doc ops + whoAmI run on AppSessions (local broadcast + local
// access fn). Fall back to chatApi defensively; on /vibe/ and /chat/ routes
// vibeApi is always present. (#2265 Track A1)
const dataApi = vibeApi ?? chatApi;
```

Then replace every `chatApi.` used for `whoAmI`, `queryDocs`, `subscribeDocs`,
`onDocChanged`, and `putDoc` with `dataApi.`, and update the `useEffect`/
`useCallback` dependency arrays from `[chatApi, …]` to `[dataApi, …]`.

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd vibes.diy/tests && pnpm test comments-section-avatar -- --run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/components/ResultPreview/CommentsSection.tsx vibes.diy/tests/app/comments-section-avatar.test.tsx
git commit -m "fix(comments): route doc ops through vibeApi (AppSessions) (#2265)"
```

---

## Task 2: Vibe route viewer-grants + doc ops → `vibeApi ?? chatApi`

**Files:**

- Modify: `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`

- [ ] **Step 1: Identify the doc-plane calls**

In this route, the calls that belong on the data plane are
`subscribeViewerGrants` + `onViewerGrantsChanged` (line ~461) and any
`queryDocs`/`putDoc`/`subscribeDocs`. The `whoAmI`, `listHandleBindings`,
`listRequestGrants`, `subscribeRequestGrants`, `listDmThreads`, `getAppByFsId`,
`requestAccess` calls are `sharedHandlers` RPCs — **leave on `chatApi`** (move
in Track B).

- [ ] **Step 2: Add the data-plane alias**

Near the top of the component, after the `useVibesDiy()` destructure (it
currently reads `vctx.chatApi`), add:

```tsx
const vctx = useVibesDiy();
const dataApi = vctx.vibeApi ?? vctx.chatApi;
```

- [ ] **Step 3: Switch the viewer-grants subscription**

Replace `vctx.chatApi.subscribeViewerGrants(…)` /
`vctx.chatApi.onViewerGrantsChanged(…)` with `dataApi.subscribeViewerGrants(…)`
/ `dataApi.onViewerGrantsChanged(…)`, and update the effect dependency array to
reference `dataApi`.

- [ ] **Step 4: Build + test**

Run: `pnpm build && cd vibes.diy/tests && pnpm test vibe-route -- --run`
Expected: clean build; route tests pass.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/routes/vibe.\$ownerHandle.\$appSlug.tsx
git commit -m "fix(vibe-route): route viewer-grants + doc ops through vibeApi (#2265)"
```

---

## Task 3: Full check + PR

- [ ] **Step 1: `pnpm check`**

Run: `pnpm check`
Expected: format + build + test + lint all green. Re-run flaky tests per
`agents/flaky-tests.md` before treating a failure as real.

- [ ] **Step 2: Push + PR**

```bash
git push -u origin claude/plan-issues-2264-2265-6klwd2
```

Open the PR (feature-goal title, label `agent-created`, @-mention
`@CharlieHelps` in a comment, subscribe). Body: "A1 of the DO-split finish —
moves vibe-scoped doc ops onto AppSessions. Prereq for removing `appHandlers`
from the chat plane (A2) and deleting `AccessFnDO` (A3). Part of #2265 / #2264."

- [ ] **Step 3: Verify on preview**

Run the `qa-pr` SOP against the preview URL: post a comment, confirm it appears
live (broadcast works), confirm access-gated comment writes still behave.
