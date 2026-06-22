# `access.js` Source Delivery to VibeContext (Plan A · slice 2c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver each vibe's `access.js` source into `VibeContext` so slice 3's `useVibe()` hook can read it. Ship the `{dbName, accessFnCid}` manifest in mount params; the iframe runtime fetches each source over the slice-2a `accessFnSource(cid)` RPC after the bridge is ready and dispatches it into `VibeContext`, which caches it.

**Architecture:** The React tree **cannot** call the bridge api directly (the `VibeSandboxApi` is a module singleton invisible to React). So this mirrors the existing `bootstrapViewer` pattern exactly: `registerDependencies` calls `api.accessFnSource(cid)` for each binding (after the ack-gated bridge is live) and `window.dispatchEvent`es a `vibe.evt.accessFnSource` event per CID; `VibeContext` listens and caches into a `Map<cid, string | null>`, exactly as it caches `viewerChanged`. The `accessFnBindings` manifest rides in both the `registerDependencies` arg (so it knows which CIDs to fetch) and `mountParams` (so the hook knows the `dbName → cid` mapping and can compute readiness).

**Tech Stack:** TypeScript, arktype (wire/mount validation), React 19 + context, the postMessage bridge, drizzle (the render-side binding query), Vitest (`@vibes.diy/api-test` for the render fragment; `vibes.diy/tests/app` for the runtime + context).

**Scope:** Delivery + caching only. It does NOT add the `useVibe()` hook, telemetry, or prompt changes (slice 3 / slice 4). It exposes two things on the context — `mountParams.accessFnBindings` (dbName→cid) and `accessFnSources` (cid→source|null) — which slice 3 combines into per-db readiness.

**Readiness contract (carry Charlie's caveat):** the cache is `Map<cid, string | null>`. A CID **absent** from the map = _not delivered yet_ (pending → slice-3 hook is not-ready, never a deny). A CID mapped to **null** = _resolved, but no source available_ (→ slice-3 `unknown` → optimistic). A CID mapped to a **string** = ready to run. `bootstrapAccessFnSources` dispatches even `null` so "resolved-unknown" is distinguishable from "pending"; it skips dispatch only on a transient RPC error (stays pending, retried on the next iframe boot).

---

## Reference templates (mirror these)

- **Event type + guard** — `vibes.diy/vibe/types/index.ts:589-602` `EvtVibeViewerChanged` / `isEvtVibeViewerChanged` (arktype event, NO `tid`).
- **Fetch-after-ready + dispatch** — `vibes.diy/vibe/runtime/register-dependencies.ts`: `bootstrapViewer(api)` (538-554) dispatches a synthetic `window` `MessageEvent`; called fire-and-forget at ~434 after `sendRuntimeReadyWithRetry`. `api.accessFnSource(cid)` already exists (331). `VibeApp` interface is at 61-66. Every `api.request()` already `await`s `ackReady`, so any call gates on the bridge being live and naturally re-runs on each iframe boot/reconnect.
- **VibeContext state + listener + provide** — `vibes.diy/vibe/runtime/VibeContext.tsx`: `viewerEnv` `useState` + `vibe.evt.viewerChanged` `useEffect` (109-124), `ctx` assembly (175-178), `Vibe` interface + `useVibeContext` (92-98, 185-187).
- **Mount params** — `vibes.diy/vibe/runtime/vibe.ts:20-25` `vibeMountParams` arktype. Render inlines it: `vibes.diy/api/svc/intern/render-vibe.ts:182-188` (the `registerDependencies({...})` arg and `mountVibe([...], { usrEnv, viewerEnv? })` params). Sibling query template: `buildViewerEnvForRender` (28-33); the binding query shape is `who-am-i.ts:48-52`.
- **Tests** — `vibes.diy/tests/app/vibe-sandbox-api-who-am-i.test.ts` (bootstrap pattern: ack → call → yield → pluck tid → reply → assert dispatched event); `vibes.diy/tests/app/vibe-context-viewer.test.tsx` (render provider + dispatch event + `waitFor`). Render fragment: `vibes.diy/api/tests/render-vibe-viewer-env.test.ts`.

## File Structure

- Modify `vibes.diy/vibe/types/index.ts` — `EvtVibeAccessFnSource` + `isEvtVibeAccessFnSource`.
- Modify `vibes.diy/vibe/runtime/vibe.ts` — add `accessFnBindings?` to `vibeMountParams`.
- Modify `vibes.diy/vibe/runtime/register-dependencies.ts` — `accessFnBindings?` on `VibeApp`; `bootstrapAccessFnSources`; call it.
- Modify `vibes.diy/api/svc/intern/render-vibe.ts` — `buildAccessFnBindingsForRender` + inline into both call sites.
- Modify `vibes.diy/vibe/runtime/VibeContext.tsx` — `accessFnSources` state + listener + expose on `Vibe`.
- Create `vibes.diy/tests/app/bootstrap-access-fn-sources.test.ts` — bootstrap test.
- Modify `vibes.diy/tests/app/vibe-context-viewer.test.tsx` (or a new `vibe-context-access-fn.test.tsx`) — context cache test.
- Modify `vibes.diy/api/tests/render-vibe-viewer-env.test.ts` (or a new file) — render-fragment test.

Test commands: runtime/context → `cd /home/user/vibes.diy/vibes.diy/tests && pnpm test`; render fragment → `cd /home/user/vibes.diy/vibes.diy/api/tests && pnpm exec vitest --run`.

---

### Task 1: `vibe.evt.accessFnSource` event type + guard

**Files:** Modify `vibes.diy/vibe/types/index.ts`

- [ ] **Step 1: Add the type + guard** next to `EvtVibeViewerChanged` (events carry no `tid`):

```ts
export const EvtVibeAccessFnSource = type({
  type: "'vibe.evt.accessFnSource'",
  cid: "string",
  source: "string | null",
});
export type EvtVibeAccessFnSource = typeof EvtVibeAccessFnSource.infer;

export function isEvtVibeAccessFnSource(x: unknown): x is EvtVibeAccessFnSource {
  return !(EvtVibeAccessFnSource(x) instanceof type.errors);
}
```

- [ ] **Step 2: Build** `cd /home/user/vibes.diy && pnpm --filter @vibes.diy/vibe-types build` → clean.
- [ ] **Step 3: Commit** `git commit -m "feat(vibe-types): vibe.evt.accessFnSource event type + guard"`

---

### Task 2: Mount-params + VibeApp manifest types

**Files:** Modify `vibes.diy/vibe/runtime/vibe.ts`; Modify `vibes.diy/vibe/runtime/register-dependencies.ts`

- [ ] **Step 1: Add `accessFnBindings?` to `vibeMountParams`** in `vibe.ts` (match the repo's arktype array syntax — confirm against an existing array field; `.array()` on an object type):

```ts
export const vibeMountParams = type({
  usrEnv: vibeEnv,
  "viewerEnv?": viewerEnv,
  "accessFnBindings?": type({ dbName: "string", accessFnCid: "string" }).array(),
});
export type VibeMountParams = typeof vibeMountParams.infer;
```

- [ ] **Step 2: Add `accessFnBindings?` to `VibeApp`** in `register-dependencies.ts` (61-66) — `VibeApp` is JSON-serialized, no arktype, so a plain TS field:

```ts
export interface VibeApp {
  readonly appSlug: string;
  readonly ownerHandle: string;
  readonly fsId: string;
  readonly adminMode?: boolean;
  readonly accessFnBindings?: readonly { dbName: string; accessFnCid: string }[];
}
```

- [ ] **Step 3: Build** the runtime package; ignore the pre-existing TS6059 noise (#2500), fail only on a real error in these edits.
- [ ] **Step 4: Commit** `git commit -m "feat(vibe-runtime): accessFnBindings on VibeApp + vibeMountParams"`

---

### Task 3: Render-side — query bindings and inline them

**Files:** Modify `vibes.diy/api/svc/intern/render-vibe.ts`; Modify `vibes.diy/api/tests/render-vibe-viewer-env.test.ts`

- [ ] **Step 1: Write the failing render-fragment test** — add a case to `render-vibe-viewer-env.test.ts` asserting the inlined `mountJS` fragment contains `accessFnBindings`. Mirror its existing "mountJS JSON fragment" test:

```ts
it("mountJS fragment carries accessFnBindings (dbName + accessFnCid)", () => {
  const accessFnBindings = [{ dbName: "*", accessFnCid: "bafyCID" }];
  const mountParams = JSON.stringify({ usrEnv: {}, accessFnBindings });
  expect(mountParams).toContain('"accessFnBindings"');
  expect(mountParams).toContain('"accessFnCid":"bafyCID"');
});
```

- [ ] **Step 2: Run it** `cd /home/user/vibes.diy/vibes.diy/api/tests && pnpm exec vitest --run render-vibe-viewer-env` — expect the new case to pass once the producer is wired (this fragment test is data-shape only; the real wiring is below).

- [ ] **Step 3: Add `buildAccessFnBindingsForRender`** in `render-vibe.ts` (sibling of `buildViewerEnvForRender`, using the `who-am-i.ts:48-52` query shape; import `and, eq` if not present):

```ts
async function buildAccessFnBindingsForRender(vctx: VibesApiSQLCtx, args: { appSlug: string; ownerUserSlug: string }) {
  const tAfb = vctx.sql.tables.accessFunctionBindings;
  const rows = await vctx.sql.db
    .select({ dbName: tAfb.dbName, accessFnCid: tAfb.accessFnCid })
    .from(tAfb)
    .where(and(eq(tAfb.ownerHandle, args.ownerUserSlug), eq(tAfb.appSlug, args.appSlug)));
  return rows.length > 0 ? rows : undefined;
}
```

- [ ] **Step 4: Call it and inline into BOTH params** at the render site (alongside `viewerEnv`, ~150-188). Compute once:

```ts
const accessFnBindings = await buildAccessFnBindingsForRender(vctx, { appSlug: fs.appSlug, ownerUserSlug: fs.ownerHandle });
```

Then add `...(accessFnBindings ? { accessFnBindings } : {})` to BOTH the `registerDependencies({ appSlug, ownerHandle, fsId, ... })` object **and** the `mountVibe([...], { usrEnv, ...viewerEnv, ... })` params object. (The registerDependencies arg drives the fetch; the mountVibe param feeds `VibeContext`/the hook.)

- [ ] **Step 5: Run** the api test suite touching render — `cd /home/user/vibes.diy/vibes.diy/api/tests && pnpm exec vitest --run render-vibe-viewer-env` — pass.
- [ ] **Step 6: Commit** `git commit -m "feat(api): inline accessFnBindings into vibe mount JS"`

---

### Task 4: Runtime — `bootstrapAccessFnSources` (fetch after ready, dispatch)

**Files:** Modify `vibes.diy/vibe/runtime/register-dependencies.ts`; Create `vibes.diy/tests/app/bootstrap-access-fn-sources.test.ts`

- [ ] **Step 1: Write the failing test** in `vibes.diy/tests/app/bootstrap-access-fn-sources.test.ts`, mirroring `vibe-sandbox-api-who-am-i.test.ts`'s `bootstrapViewer` suite: construct a `VibeSandboxApi` with mock `addEventListener`/`postMessage`, intercept `window.dispatchEvent`, send `runtime.ack` to ungate, call `bootstrapAccessFnSources(api, [{ dbName: "mydb", accessFnCid: "bafy1" }])`, yield, pluck the posted `vibe.req.accessFnSource` `tid`, reply with `{ type: "vibe.res.accessFnSource", tid, cid: "bafy1", source: "export function mydb(){}" }`, await, then assert a `vibe.evt.accessFnSource` event was dispatched with `{ cid: "bafy1", source: "export function mydb(){}" }`. Add a second case: a `source: null` reply still dispatches `{ cid, source: null }`; dedupe — two bindings sharing one `accessFnCid` cause exactly one RPC.

- [ ] **Step 2: Run it** → FAIL (`bootstrapAccessFnSources` not exported).

- [ ] **Step 3: Implement** in `register-dependencies.ts`, next to `bootstrapViewer`:

```ts
export async function bootstrapAccessFnSources(
  api: VibeSandboxApi,
  bindings: readonly { dbName: string; accessFnCid: string }[] | undefined
): Promise<void> {
  if (bindings === undefined) return;
  // Many dbNames can share one access.js file → dedupe by CID before fetching.
  const cids = [...new Set(bindings.map((b) => b.accessFnCid))];
  await Promise.all(
    cids.map(async (cid) => {
      const res = await api.accessFnSource(cid);
      if (res.isErr()) return; // transient — leave the CID pending; a later boot retries
      const r = res.Ok();
      // Dispatch even when source === null so the cache can distinguish
      // "resolved-unknown" from "not delivered yet" (the slice-3 readiness contract).
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "vibe.evt.accessFnSource", cid: r.cid, source: r.source },
        })
      );
    })
  );
}
```

- [ ] **Step 4: Call it** after `sendRuntimeReadyWithRetry(ctxVibeApi)`, next to the `bootstrapViewer(...)` call (~434), fire-and-forget:

```ts
bootstrapAccessFnSources(ctxVibeApi, vibeApp.accessFnBindings).catch((e) => {
  console.warn("[accessFn] bootstrap source fetch failed", e);
});
```

- [ ] **Step 5: Run** `cd /home/user/vibes.diy/vibes.diy/tests && pnpm test bootstrap-access-fn-sources` (or the suite) → pass.
- [ ] **Step 6: Commit** `git commit -m "feat(vibe-runtime): bootstrapAccessFnSources fetches + dispatches source by cid"`

---

### Task 5: VibeContext — cache + expose

**Files:** Modify `vibes.diy/vibe/runtime/VibeContext.tsx`; Create `vibes.diy/tests/app/vibe-context-access-fn.test.tsx`

- [ ] **Step 1: Write the failing test** in `vibe-context-access-fn.test.tsx`, mirroring `vibe-context-viewer.test.tsx`: render `<VibeContextProvider mountParams={{ usrEnv: {}, accessFnBindings: [{ dbName: "*", accessFnCid: "bafy1" }] }}><Probe/></VibeContextProvider>` where `Probe` reads `useVibeContext().accessFnSources` and `useVibeContext().mountParams.accessFnBindings`; dispatch `new MessageEvent("message", { data: { type: "vibe.evt.accessFnSource", cid: "bafy1", source: "export function x(){}" } })`; `waitFor` the probe to show the cached source. Add a case: a `null` source is cached as `null` (key present, value null), distinct from an un-dispatched CID (key absent).

- [ ] **Step 2: Run it** → FAIL (`accessFnSources` not on context).

- [ ] **Step 3: Add state + listener + expose** in `VibeContext.tsx`:

Add `readonly accessFnSources: Map<string, string | null>;` to the `Vibe` interface (and the default context value: `accessFnSources: new Map()`). Add state next to `viewerEnv`:

```ts
const [accessFnSources, setAccessFnSources] = useState<Map<string, string | null>>(new Map());
```

Add a listener `useEffect` next to the `viewerChanged` one (import `isEvtVibeAccessFnSource`):

```ts
useEffect(() => {
  const onMsg = (event: MessageEvent) => {
    if (!isEvtVibeAccessFnSource(event.data)) return;
    const { cid, source } = event.data;
    setAccessFnSources((prev) => {
      const next = new Map(prev);
      next.set(cid, source);
      return next;
    });
  };
  window.addEventListener("message", onMsg);
  return () => window.removeEventListener("message", onMsg);
}, []);
```

Expose it on the provided `ctx`:

```ts
const ctx: Vibe = {
  mountParams: { ...mountParams, viewerEnv },
  accessFnSources,
};
```

- [ ] **Step 4: Run** the context test → pass. Then run the whole app suite once: `cd /home/user/vibes.diy/vibes.diy/tests && pnpm test` — confirm no regressions in existing VibeContext/viewer tests.
- [ ] **Step 5: Lint + format** all touched files (`eslint` + `prettier --check`); fix any rules-bag issues (no `any`, no falsy coercion, no `try/catch` in non-test code).
- [ ] **Step 6: Commit** `git commit -m "feat(vibe-runtime): VibeContext caches access.js source by cid"`

---

## Self-Review

**Spec coverage:** event type (T1), manifest types (T2), render query + inline into both params (T3), fetch-after-ready + dispatch with dedupe + null-dispatch (T4), context cache + expose + readiness distinction (T5). The full path mount-params-CID → runtime-fetch → dispatch → context-cache is covered. The hook is slice 3.

**Placeholder scan:** new code (event type, `bootstrapAccessFnSources`, the listener) is verbatim; the wiring points cite exact `bootstrapViewer`/`viewerChanged`/`vibeMountParams` templates with the deltas.

**Type consistency:** `EvtVibeAccessFnSource { type, cid, source: string|null }`, `accessFnBindings: {dbName, accessFnCid}[]`, and `accessFnSources: Map<string, string|null>` are used identically across types, runtime, context, and tests. `isEvtVibeAccessFnSource` is the single guard.

**Risks for the implementer:**

- Confirm the arktype array syntax for `accessFnBindings?` against an existing object-array field in the codebase (`.array()` vs tuple form) — the `vibe-types` build will catch a wrong form.
- `register-dependencies.ts` references the JSON-deserialized `vibeApp.accessFnBindings`; there's no arktype on `VibeApp`, so a malformed server payload would surface as a runtime shape mismatch — the dedupe `.map` is defensive but assumes array shape. Keep it simple; the server is the only producer.
- Do NOT skip the `null` dispatch — it is load-bearing for the slice-3 readiness contract (pending vs resolved-unknown vs ready). The test pins this.
- The render query adds one `accessFunctionBindings` select per render; it's tiny (CIDs only) and parallel to the existing `buildViewerEnvForRender` round-trip. Don't fetch source bytes here — only the manifest.
