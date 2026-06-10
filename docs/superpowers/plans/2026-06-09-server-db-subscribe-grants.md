# Server-side `db.subscribe()` grant-reactivity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the documented headless `fireproof("todos", { appSlug }).subscribe(...)` pattern (Node/Deno/Bun/Workers) pick up a channel granted after subscribe time — forward events live, no restart — by routing headless clients onto the shared per-vibe `AppSessions` DO and re-subscribing on a grant change.

**Architecture:** Two pieces, both in the **headless layer only** (the iframe transport is untouched). Piece 1 routes the headless connection to canonical `/api/app?vibe=ownerHandle--appSlug` + `skipShard:true` (bootstrap-connect to resolve `ownerHandle` first, per the connection model — owner is not resolvable at route-time). Piece 2 lives in `FireflyApiAdapter`: subscribe to `viewer-grants-changed`, re-issue `subscribeDocs` for every open db of the app (the event is app-coarse), and surface a consumer-facing grant-changed signal for opt-in app re-pull. Forward-only by default; backfill is the consumer's choice.

**Tech Stack:** TypeScript, `@adviser/cement` (`Result`, `ResolveOnce`, `Lazy`, `BuildURI`), Vitest. Files: `vibes.diy/api/impl/firefly-api-adapter.ts`, `use-vibes/base/fireproof-node.ts`, `vibes-diy/cli/cmds/db/subscribe-cmd.ts`, `vibes.diy/api/svc/cf-serve.ts` (observability). Tests under `vibes.diy/api/impl/*.test.ts` and `vibes.diy/tests/app/`.

**Spec:** [2026-06-09-server-db-subscribe-grants-design.md](../specs/2026-06-09-server-db-subscribe-grants-design.md) · **PR:** [#2304](https://github.com/VibesDIY/vibes.diy/pull/2304) · **Issue:** [#2303](https://github.com/VibesDIY/vibes.diy/issues/2303)

---

## File structure

| File                                        | Responsibility                | Change                                                                                                                  |
| ------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `vibes.diy/tests/app/fake-vibes-diy-api.ts` | Test double for `VibesDiyApi` | Add `subscribeViewerGrants`, `onViewerGrantsChanged`, `_simulateViewerGrantsChanged`, and `subscribeDocs` call-tracking |
| `vibes.diy/api/impl/firefly-api-adapter.ts` | Headless transport bridge     | Lazy routed-api support; grant-reactivity (resubscribe-all-open-dbs + `onGrantsChanged`)                                |
| `use-vibes/base/fireproof-node.ts`          | Node `fireproof()` factory    | Canonical `/api/app` routing via bootstrap-resolved `ownerHandle`                                                       |
| `vibes-diy/cli/cmds/db/subscribe-cmd.ts`    | CLI `db subscribe`            | Route to canonical `/api/app`; enable grant-reactivity                                                                  |
| `vibes.diy/api/svc/cf-serve.ts`             | `AppSessions` DO serve        | Structured per-vibe connection-count + grant-fanout logs (rollout guardrail)                                            |

`EvtViewerGrantsChanged` carries app identity (`ownerHandle`/`appSlug`), **not** a db delta — so resubscribe targets all open dbs of the app.

---

## Task 1: Extend the test fake with grant events + subscribeDocs tracking

**Files:**

- Modify: `vibes.diy/tests/app/fake-vibes-diy-api.ts`

- [ ] **Step 1: Add the new surface to the `FakeVibesDiyApi` interface**

Add these members to the `FakeVibesDiyApi` interface (after `onDocChanged`):

```typescript
  subscribeViewerGrants: (req: { ownerHandle: string; appSlug: string }) => Promise<Result<unknown>>;
  onViewerGrantsChanged: (fn: (evt: { ownerHandle: string; appSlug: string }) => void) => () => void;
  /** db names passed to subscribeDocs, in call order — lets tests assert resubscribe */
  readonly _subscribeDocsCalls: string[];
  /** simulate a server-push viewer-grants-changed event */
  _simulateViewerGrantsChanged: (ownerHandle: string, appSlug: string) => void;
```

- [ ] **Step 2: Implement them in `createFakeVibesDiyApi`**

Inside `createFakeVibesDiyApi`, add a listener array and call log near the top (next to `docChangedListeners`):

```typescript
const viewerGrantsListeners: ((evt: { ownerHandle: string; appSlug: string }) => void)[] = [];
const subscribeDocsCalls: string[] = [];
```

Change the `subscribeDocs` stub to record calls, and add the new returned members:

```typescript
    subscribeDocs: async (req: { appSlug: string; ownerHandle: string; dbName: string }) => {
      subscribeDocsCalls.push(req.dbName);
      return Result.Ok({ type: "vibes.diy.res-subscribe-docs", status: "ok" });
    },

    subscribeViewerGrants: async () => Result.Ok({ type: "vibes.diy.res-subscribe-viewer-grants", status: "ok" }),

    onViewerGrantsChanged: (fn) => {
      viewerGrantsListeners.push(fn);
      return () => {
        const i = viewerGrantsListeners.indexOf(fn);
        if (i >= 0) viewerGrantsListeners.splice(i, 1);
      };
    },

    _subscribeDocsCalls: subscribeDocsCalls,

    _simulateViewerGrantsChanged: (ownerHandle, appSlug) => {
      for (const fn of viewerGrantsListeners) fn({ ownerHandle, appSlug });
    },
```

(`_subscribeDocsCalls` exposes the same array reference, so pushes are visible to tests.)

- [ ] **Step 3: Typecheck the test package**

Run: `cd vibes.diy/tests && pnpm exec tsc --noEmit -p .` (or the package's typecheck script)
Expected: PASS — the fake compiles with the new members.

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/tests/app/fake-vibes-diy-api.ts
git commit -m "test(firefly): extend fake api with viewer-grants events + subscribeDocs tracking"
```

---

## Task 2: Adapter accepts a lazily-resolved api (enables deferred routing)

The Node `fireproof()` factory is synchronous, but canonical routing needs an async `ownerHandle` bootstrap. Let the adapter accept either a ready `VibesDiyApi` (CLI, owner already known) or an async factory (fireproof-node), resolved once on first use. Pure refactor — behavior unchanged.

**Files:**

- Modify: `vibes.diy/api/impl/firefly-api-adapter.ts`
- Test: `vibes.diy/api/impl/firefly-api-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `firefly-api-adapter.test.ts`:

```typescript
it("accepts an async api factory and resolves it once", async () => {
  const api = createFakeVibesDiyApi({ defaultHandle: "alice" });
  let built = 0;
  const adapter = new FireflyApiAdapter(
    async () => {
      built++;
      return api as unknown as VibesDiyApi;
    },
    "my-app",
    { ownerHandle: "alice" }
  );
  await adapter.putDoc({ hello: "world" });
  await adapter.putDoc({ hello: "again" });
  expect(built).toBe(1); // factory resolved exactly once
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd vibes.diy && pnpm exec vitest run api/impl/firefly-api-adapter.test.ts -t "async api factory"`
Expected: FAIL — constructor's first param is typed `VibesDiyApi`, not a factory.

- [ ] **Step 3: Implement lazy api resolution**

In `firefly-api-adapter.ts`, change the stored field and constructor, and add a resolver. Replace `private readonly api: VibesDiyApi;` and the constructor's `this.api = api;` with:

```typescript
  private readonly apiArg: VibesDiyApi | (() => Promise<VibesDiyApi>);
  private readonly apiOnce = new ResolveOnce<VibesDiyApi>();
```

Constructor signature and body:

```typescript
  constructor(
    api: VibesDiyApi | (() => Promise<VibesDiyApi>),
    appSlug: string,
    opts?: { ownerHandle?: string; adminMode?: boolean },
  ) {
    this.apiArg = api;
    // ...rest unchanged (ownerHandleOverride, adminMode, svc)...
  }

  private async getApi(): Promise<VibesDiyApi> {
    return this.apiOnce.once(async () => (typeof this.apiArg === "function" ? this.apiArg() : this.apiArg));
  }
```

Then replace every `this.api.` call in the method bodies with `(await this.getApi()).`. There are exactly these call sites: `resolveOwnerHandle` (`ensureUserSettings`), `putDoc`, `getDoc`, `queryDocs`, `deleteDoc`, `subscribeDocs`, and `onMsg`. For `onMsg` (currently sync), make the resolution explicit:

```typescript
  onMsg(fn: (event: { data: unknown }) => void): void {
    void this.getApi().then((api) => {
      api.onDocChanged((ownerHandle, appSlug, dbName, docId) => {
        fn({ data: { type: "vibes.diy.evt-doc-changed", ownerHandle, appSlug, dbName, docId } });
      });
    });
  }
```

Ensure `ResolveOnce` is imported (it already is, alongside `Result`).

- [ ] **Step 4: Run the full adapter test file**

Run: `cd vibes.diy && pnpm exec vitest run api/impl/firefly-api-adapter.test.ts`
Expected: PASS — the new test plus all existing tests (which pass a ready `VibesDiyApi`, still accepted).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/impl/firefly-api-adapter.ts vibes.diy/api/impl/firefly-api-adapter.test.ts
git commit -m "refactor(firefly): adapter accepts a lazily-resolved VibesDiyApi"
```

---

## Task 3: Adapter grant-reactivity — resubscribe all open dbs + emit signal

**Files:**

- Modify: `vibes.diy/api/impl/firefly-api-adapter.ts`
- Test: `vibes.diy/api/impl/firefly-api-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
it("on viewer-grants-changed, resubscribes every open db and emits onGrantsChanged", async () => {
  const api = createFakeVibesDiyApi({ defaultHandle: "alice" });
  const adapter = new FireflyApiAdapter(api as unknown as VibesDiyApi, "my-app", { ownerHandle: "alice" });

  await adapter.subscribeDocs("type-a");
  await adapter.subscribeDocs("type-b");
  await adapter.enableGrantReactivity(); // idempotent; wires viewer-grants subscription

  const seen: { ownerHandle: string; appSlug: string }[] = [];
  adapter.onGrantsChanged((evt) => seen.push(evt));

  api._subscribeDocsCalls.length = 0; // reset; count only resubscribes
  api._simulateViewerGrantsChanged("alice", "my-app");
  await new Promise((r) => setTimeout(r, 0)); // let async resubscribe settle

  expect(api._subscribeDocsCalls.sort()).toEqual(["type-a", "type-b"]); // both open dbs re-subscribed
  expect(seen).toEqual([{ ownerHandle: "alice", appSlug: "my-app" }]); // consumer signalled
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd vibes.diy && pnpm exec vitest run api/impl/firefly-api-adapter.test.ts -t "viewer-grants-changed"`
Expected: FAIL — `enableGrantReactivity`/`onGrantsChanged` do not exist.

- [ ] **Step 3: Implement grant-reactivity**

Add fields to the class:

```typescript
  private readonly openDbNames = new Set<string>();
  private readonly grantsChangedListeners: ((evt: { ownerHandle: string; appSlug: string }) => void)[] = [];
  private readonly grantReactivityOnce = new ResolveOnce<void>();
```

Record open db names in `subscribeDocs` (add one line before the return):

```typescript
  async subscribeDocs(dbName = "default"): Promise<Result<ResSubscribeDocs, VibesDiyError>> {
    const ownerHandle = await this.resolveOwnerHandle();
    this.openDbNames.add(dbName);
    return (await this.getApi()).subscribeDocs({ appSlug: this.svc.vibeApp.appSlug, ownerHandle, dbName });
  }
```

Add the public API:

```typescript
  /**
   * Opt into live grant-reactivity. On a viewer-grants-changed for this app,
   * re-issue subscribeDocs for every open db (the event is app-coarse, not
   * db-scoped) so future writes to a newly-granted channel flow live, and
   * notify onGrantsChanged listeners. Forward-only: no backfill/replay.
   * Idempotent — safe to call from multiple consumers.
   */
  async enableGrantReactivity(): Promise<void> {
    return this.grantReactivityOnce.once(async () => {
      const ownerHandle = await this.resolveOwnerHandle();
      const api = await this.getApi();
      await api.subscribeViewerGrants({ ownerHandle, appSlug: this.svc.vibeApp.appSlug });
      api.onViewerGrantsChanged((evt) => {
        // resubscribe every open db (dedupe on the client makes this harmless)
        for (const dbName of this.openDbNames) {
          void this.subscribeDocs(dbName);
        }
        for (const fn of this.grantsChangedListeners) {
          fn({ ownerHandle: evt.ownerHandle, appSlug: evt.appSlug });
        }
      });
    });
  }

  /** Register a consumer callback for grant changes (opt-in app re-pull). */
  onGrantsChanged(fn: (evt: { ownerHandle: string; appSlug: string }) => void): () => void {
    this.grantsChangedListeners.push(fn);
    return () => {
      const i = this.grantsChangedListeners.indexOf(fn);
      if (i >= 0) this.grantsChangedListeners.splice(i, 1);
    };
  }
```

Note: `EvtViewerGrantsChanged` exposes at least `ownerHandle`/`appSlug`; read only those two fields.

- [ ] **Step 4: Run the test**

Run: `cd vibes.diy && pnpm exec vitest run api/impl/firefly-api-adapter.test.ts -t "viewer-grants-changed"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/impl/firefly-api-adapter.ts vibes.diy/api/impl/firefly-api-adapter.test.ts
git commit -m "feat(firefly): adapter resubscribes open dbs + emits signal on grant change"
```

---

## Task 4: fireproof-node routes to canonical `/api/app` via bootstrap

**Files:**

- Modify: `use-vibes/base/fireproof-node.ts`
- Test: `use-vibes/base/fireproof-node.test.ts` (create if absent; otherwise add to the existing node test)

- [ ] **Step 1: Write the failing test**

Using the existing node test pattern (inject a fake api via `opts` is not currently supported, so test the URL builder in isolation). Add a small exported helper and test it:

```typescript
import { buildVibeApiUrl } from "./fireproof-node.js";

it("builds the canonical /api/app?vibe=owner--app url", () => {
  expect(buildVibeApiUrl("https://vibes.diy/api", "alice", "todos")).toBe("https://vibes.diy/api/app?vibe=alice--todos");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd use-vibes && pnpm exec vitest run base/fireproof-node.test.ts -t "canonical"`
Expected: FAIL — `buildVibeApiUrl` not exported.

- [ ] **Step 3: Implement canonical routing**

Add the URL helper and switch adapter construction to an async factory that bootstraps `ownerHandle`. Import `BuildURI`:

```typescript
import { Lazy, KeyedResolvOnce, BuildURI, type Result } from "@adviser/cement";
```

Add the exported helper:

```typescript
/** Canonical per-vibe app route — shares the AppSessions DO with iframe clients. */
export function buildVibeApiUrl(apiUrl: string, ownerHandle: string, appSlug: string): string {
  return BuildURI.from(apiUrl).pathname("/api/app").cleanParams().setParam("vibe", `${ownerHandle}--${appSlug}`).toString();
}
```

Replace the `sharedAdapter` Lazy body (both in `fireproof` and `__resetFireproofForTesting`) so the adapter receives an **async api factory** that resolves the owner, then connects canonically:

```typescript
let sharedAdapter = Lazy((resolved: ResolvedOpts): FireflyApiAdapter => {
  const apiFactory = async (): Promise<VibesDiyApi> => {
    // Resolve ownerHandle: provided, or bootstrap via a throwaway /api connection.
    let ownerHandle = resolved.userHandle;
    if (ownerHandle === undefined) {
      const bootstrap = new VibesDiyApi({ apiUrl: resolved.apiUrl, getToken: resolved.getToken });
      const rRes = await bootstrap.ensureUserSettings({ settings: [] });
      if (rRes.isErr()) throw new Error(`Failed to resolve owner handle: ${rRes.Err()}`);
      const def = rRes.Ok().settings.find((s: { type: string }) => s.type === "defaultHandle") as
        | { ownerHandle: string }
        | undefined;
      if (def === undefined) throw new Error("No defaultHandle — pass {userHandle} or run 'npx vibes-diy login' first");
      ownerHandle = def.ownerHandle;
    }
    return new VibesDiyApi({
      apiUrl: buildVibeApiUrl(resolved.apiUrl, ownerHandle, resolved.appSlug),
      skipShard: true,
      getToken: resolved.getToken,
    });
  };
  const adapter = new FireflyApiAdapter(
    apiFactory,
    resolved.appSlug,
    resolved.userHandle ? { ownerHandle: resolved.userHandle } : undefined
  );
  void adapter.enableGrantReactivity(); // headless consumers get live grant updates by default
  return adapter;
});
```

Apply the identical body inside `__resetFireproofForTesting`.

- [ ] **Step 4: Run the test**

Run: `cd use-vibes && pnpm exec vitest run base/fireproof-node.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add use-vibes/base/fireproof-node.ts use-vibes/base/fireproof-node.test.ts
git commit -m "feat(fireproof-node): route headless to canonical /api/app + enable grant-reactivity"
```

---

## Task 5: CLI `db subscribe` routes canonically + reacts to grants

The CLI already resolves `ownerHandle` upfront (`resolveUserSlug`), so no bootstrap is needed — build the canonical routed api directly.

**Files:**

- Modify: `vibes-diy/cli/cmds/db/subscribe-cmd.ts`
- Test: `vibes-diy/cli/cmds/db/subscribe-cmd.test.ts` (add focused unit test for the api construction, or extend existing CLI db tests)

- [ ] **Step 1: Write the failing test**

```typescript
import { buildVibeApiUrl } from "@vibes.diy/use-vibes/fireproof-node";

it("subscribe builds a canonical /api/app routed adapter", () => {
  expect(buildVibeApiUrl("https://vibes.diy/api", "alice", "todos")).toBe("https://vibes.diy/api/app?vibe=alice--todos");
});
```

(If importing the helper across packages is awkward, duplicate a one-line `vibe=` assertion against the URL the handler builds via a spy on `vibesDiyApiFactory`.)

- [ ] **Step 2: Run it to verify it fails**

Run: `cd vibes-diy && pnpm exec vitest run cli/cmds/db/subscribe-cmd.test.ts -t "canonical"`
Expected: FAIL until the handler routes canonically.

- [ ] **Step 3: Route the CLI subscribe handler canonically + enable grant-reactivity**

In `dbSubscribeEvento.handle`, after `resolveUserSlug` succeeds, build the canonical routed api instead of the default factory connection. The `vibesDiyApiFactory` currently only takes `apiUrl`; pass a routed url and rely on `skipShard`. Replace:

```typescript
const api = ectx.vibesDiyApiFactory(ctx.validated.apiUrl);
const rUser = await resolveUserSlug(api, ctx.validated.ownerHandle);
if (rUser.isErr()) return Result.Err(rUser.Err());
const adapter = new FireflyApiAdapter(api, ctx.validated.appSlug, { ownerHandle: rUser.Ok() });
```

with (resolve the user first on a default connection, then connect canonically):

```typescript
const bootstrapApi = ectx.vibesDiyApiFactory(ctx.validated.apiUrl);
const rUser = await resolveUserSlug(bootstrapApi, ctx.validated.ownerHandle);
if (rUser.isErr()) return Result.Err(rUser.Err());
const ownerHandle = rUser.Ok();
const routedUrl = BuildURI.from(ctx.validated.apiUrl)
  .pathname("/api/app")
  .cleanParams()
  .setParam("vibe", `${ownerHandle}--${ctx.validated.appSlug}`)
  .toString();
const api = ectx.vibesDiyApiFactory(routedUrl, { skipShard: true });
const adapter = new FireflyApiAdapter(api, ctx.validated.appSlug, { ownerHandle });
await adapter.enableGrantReactivity();
```

This requires `vibesDiyApiFactory` to accept a second `{ skipShard?: boolean }` arg. Update its type in `cli-ctx.ts` and the factory in `cli/main.ts`:

```typescript
// cli/main.ts — factory returned at ~line 83
return (apiUrl: string, opts?: { idleTimeoutMs?: number; skipShard?: boolean }) => {
  return new VibesDiyApi({
    apiUrl,
    getToken,
    ...(opts?.skipShard ? { skipShard: true } : {}),
    ...(opts?.idleTimeoutMs !== undefined ? { timeoutMs: opts.idleTimeoutMs } : {}),
  });
};
```

Add `import { BuildURI } from "@adviser/cement";` to `subscribe-cmd.ts`.

- [ ] **Step 4: Run the test + CLI db tests**

Run: `cd vibes-diy && pnpm exec vitest run cli/cmds/db/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes-diy/cli/cmds/db/subscribe-cmd.ts vibes-diy/cli/main.ts vibes-diy/cli/cli-ctx.ts vibes-diy/cli/cmds/db/subscribe-cmd.test.ts
git commit -m "feat(cli): db subscribe routes to canonical /api/app + reacts to grants"
```

---

## Task 6: Rollout guardrail — structured per-vibe fanout logs

Charlie's review requires observability to drive any future sharding work: per-vibe `AppSessions` connection count + grant-fanout delivery, with a threshold defined here.

**Files:**

- Modify: `vibes.diy/api/svc/cf-serve.ts` (the `AppSessions` notify callbacks ~L91-152)
- Test: `vibes.diy/api/tests/` (assert the structured log is emitted — or assert via the existing serve test harness)

- [ ] **Step 1: Write the failing test**

In the nearest `AppSessions`/cf-serve test, assert that a `notifyViewerGrantsChanged` emits a structured Info log containing the connection count:

```typescript
it("logs per-vibe connection count on viewer-grants fanout", () => {
  const logs: string[] = [];
  // spy on console.info (matches existing [AppSessions] notify logs)
  const spy = vi.spyOn(console, "info").mockImplementation((...a) => void logs.push(a.join(" ")));
  // ...trigger notifyViewerGrantsChanged with N connections...
  expect(logs.some((l) => l.includes("[AppSessions] viewerGrants fanout") && l.includes("conns="))).toBe(true);
  spy.mockRestore();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd vibes.diy && pnpm exec vitest run api/tests -t "per-vibe connection count"`
Expected: FAIL — the structured log line does not yet exist.

- [ ] **Step 3: Add the structured log**

In `cf-serve.ts` `notifyViewerGrantsChanged` (~L152), alongside the existing `console.info("[AppSessions] notifyViewerGrangesChanged key:", key)`, add:

```typescript
console.info("[AppSessions] viewerGrants fanout", "key=", key, "conns=", this.connections.size);
```

Do the same shape for `notifyDocChanged` (`conns=`). These give us per-vibe connection counts and fanout volume in logs.

- [ ] **Step 4: Run the test**

Run: `cd vibes.diy && pnpm exec vitest run api/tests -t "per-vibe connection count"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/cf-serve.ts vibes.diy/api/tests
git commit -m "chore(do): log per-vibe AppSessions connection count on fanout (rollout guardrail)"
```

**Threshold (for the rollout-watch):** if a single vibe sustains **> 200 concurrent `AppSessions` connections** or grant-fanout p95 delivery latency exceeds **2s**, open follow-up perf/sharding work (subscription indexing in `AppSessions`, or headless connection multiplexing). Until then, no mitigation ships with this change.

---

## Task 7: End-to-end node regression test

**Files:**

- Modify: `vibes.diy/tests/app/firefly-nodejs.test.ts`

- [ ] **Step 1: Write the failing end-to-end test**

```typescript
it("promotion: a newly-granted channel's writes go live, no restart; pre-existing docs are not auto-delivered", async () => {
  const api = createFakeVibesDiyApi({ defaultHandle: "alice" });
  const adapter = new FireflyApiAdapter(api as unknown as VibesDiyApi, "my-app", { ownerHandle: "alice" });
  const db = new FireflyDatabase("type-b", adapter);
  await adapter.enableGrantReactivity();

  const delivered: string[] = [];
  db.subscribe((changes: { _id: string }[]) => changes.forEach((c) => delivered.push(c._id)), true);

  // pre-existing doc written before promotion is NOT auto-delivered (forward-only)
  await api.putDoc({ appSlug: "my-app", ownerHandle: "alice", dbName: "type-b", doc: { _id: "old" }, docId: "old" });

  api._simulateViewerGrantsChanged("alice", "my-app"); // promotion
  await new Promise((r) => setTimeout(r, 0));

  // a write AFTER promotion is delivered live
  api._simulateDocChanged("alice", "my-app", "type-b", "new");
  await new Promise((r) => setTimeout(r, 0));

  expect(delivered).toContain("new");
  expect(delivered).not.toContain("old"); // no backfill on promotion
});
```

- [ ] **Step 2: Run it**

Run: `cd vibes.diy && pnpm exec vitest run tests/app/firefly-nodejs.test.ts -t "promotion"`
Expected: PASS (exercises Tasks 2-3 end-to-end through `FireflyDatabase`).

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/tests/app/firefly-nodejs.test.ts
git commit -m "test(firefly): e2e node promotion — forward-only grant-reactivity"
```

---

## Final verification

- [ ] Run `pnpm fast-check` from repo root; fix any lint/type issues.
- [ ] Confirm the iframe path is untouched: `git diff --stat` shows no changes under `vibes.diy/vibe/runtime/` or `vibes.diy/pkg/app/`.
- [ ] Push and let CI run full `pnpm check`.

## Self-review notes (spec coverage)

- Piece 1 (routing) → Tasks 4 (fireproof-node) + 5 (CLI), helper `buildVibeApiUrl`, bootstrap owner-resolve.
- Piece 2 (grant-reactivity) → Tasks 2-3 (adapter), forward-only verified in Task 7.
- App-coarse payload → resubscribe-all-open-dbs (Task 3).
- Locus = adapter, iframe untouched → no runtime/pkg changes (final verification check).
- Forward-only, backfill opt-in via `onGrantsChanged` → Tasks 3 + 7.
- Rollout guardrail → Task 6 with explicit threshold.
- No-grants apps inert → they never receive `viewer-grants-changed`, so `enableGrantReactivity` is a no-op in practice (no resubscribe fires).
