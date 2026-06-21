# `accessFnSource` Bridge RPC (Plan A · slice 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an iframe→parent→server RPC, `accessFnSource(cid)`, that returns a vibe's full `access.js` source bytes for a content-addressed CID — so the in-iframe runner (`evaluateWrite`, shipped in slice 1) can dry-run it. This is the transport; slice 2c wires it into `VibeContext` (mount-params CIDs, request-after-ready, cache, replay).

**Architecture:** A new request/response pair (`vibe.req.accessFnSource` / `vibe.res.accessFnSource`) that mirrors the existing `whoAmI` RPC at every layer: arktype wire types + guards, a pure-ish server resolver `resolveAccessFnSource` (binding row → `vctx.storage.fetch(accessFnAssetUri)`, with an `Assets`-by-CID fallback for legacy null URIs), a WS evento handler, the `VibesDiyApi` method, the parent sandbox handler, and the iframe `VibeSandboxApi` method. The resolver returns the **raw full source** (NOT `extractExportSource`-reduced) — the client runner extracts per-`dbName` itself.

**Tech Stack:** TypeScript, arktype (wire validation), drizzle (SQL), the Evento WS/postMessage handler framework, Vitest (`@vibes.diy/api-test` harness).

**Scope:** The RPC transport only. It does NOT touch mount params, `VibeContext`, the `useVibe` hook, telemetry, or prompts. Follow-ons:

- _Slice 2c_ — ship `accessFnBindings: {dbName, accessFnCid}[]` in mount params; `VibeContext` requests source per CID after `runtime.ready`, caches by CID, replays on reconnect, exposes it in context. Model delivery-pending as not-ready/`unknown` (never `false`), per review.
- _Slice 3_ — `useVibe()` hook consuming the cached source + grants + `adminMode`.

---

## Reference: the `whoAmI` RPC this slice mirrors (verbatim templates)

Read these before starting — each new piece is a parallel of the cited `whoAmI` code.

**Wire types + guards** — `vibes.diy/vibe/types/index.ts`. `Base = type({ tid: "string" })`; pattern: `export const Foo = type({...}).and(Base)`, `export type Foo = typeof Foo.infer`, `export function isFoo(x): x is Foo { return !(Foo(x) instanceof type.errors); }`. `import { type } from "arktype"`. `ReqVibeWhoAmI` (lines ~461) and `ResVibeWhoAmI` (lines ~478) are the template.

**Server resolver + WS evento** — `vibes.diy/api/svc/public/who-am-i.ts`: `resolveWhoAmI(vctx, args): Promise<Result<ResolvedWhoAmI>>` and `whoAmIEvento` (the exported `EventoHandler`, ~line 194) with `validate: unwrapMsgBase(...)` + `handle: optAuth(async (ctx) => { const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx"); ... await ctx.send.send(ctx, { type, tid, ... }); return Result.Ok(EventoResult.Continue); })`. It is registered in `vibes.diy/api/svc/evento-handler-manifest.ts` (imported from `./public/who-am-i.js`).

**Source-byte loading** — `vibes.diy/api/svc/public/app-documents-write-eventos.ts:250-273`: `if (afbRow.accessFnAssetUri) { const rFetch = await vctx.storage.fetch(afbRow.accessFnAssetUri); if (rFetch.type === "fetch.ok") { /* read rFetch.data stream → Uint8Array → new TextDecoder().decode(...) */ } }`.

**API iface + impl** — `vibes.diy/api/types/vibes-diy-api.ts` (~223): `whoAmI(req: Req<ReqVibeWhoAmI>): Promise<Result<ResVibeWhoAmI, VibesDiyError>>;`. `vibes.diy/api/impl/index.ts` (~667): `whoAmI(req) { return this.request({ ...req, type: "vibe.req.whoAmI" }, { resMatch: isResVibeWhoAmI }); }`.

**Parent sandbox handler + registration** — `vibes.diy/vibe/srv-sandbox/srv-sandbox-asset-identity-auth-handlers.ts`: `vibeWhoAmI(sandbox): EventoHandler` (~126) → `requireVibeApi(sandbox, ctx, "vibe.res.whoAmI")` → `api.whoAmI({ tid, appSlug, ownerHandle, adminMode })` → `ctx.send.send(ctx, { tid, type: "vibe.res.whoAmI", ... })`. Registered in `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts` `this.evento.push(...[ ... vibeWhoAmI(this), ... ])` (~278).

**iframe client method** — `vibes.diy/vibe/runtime/register-dependencies.ts`: `whoAmI()` (~316) → `this.request<ReqVibeWhoAmI, ResVibeWhoAmI>({ type: "vibe.req.whoAmI", appSlug: this.svc.vibeApp.appSlug, ownerHandle: this.svc.vibeApp.ownerHandle, ... }, { wait: isResVibeWhoAmI, timeout: 10000 })`.

**Host-handler test** — `vibes.diy/api/tests/srv-sandbox-who-am-i.test.ts` is the template for the end-to-end host test (fake `api` exposing `accessFnSource`, captured postMessages).

**Schema facts:** `AccessFunctionBindings` (PK `ownerHandle,appSlug,dbName`) has `accessFnCid` (NOT NULL) and `accessFnAssetUri` (nullable). `Assets` is keyed by `assetId` (= the CID) with a `content` blob. `vctx.sql.tables.accessFunctionBindings` and `vctx.sql.tables.assets` are the drizzle accessors.

## File Structure

- Modify `vibes.diy/vibe/types/index.ts` — add `ReqVibeAccessFnSource` / `ResVibeAccessFnSource` + guards.
- Create `vibes.diy/api/svc/public/access-fn-source.ts` — `resolveAccessFnSource` + `accessFnSourceEvento`.
- Modify `vibes.diy/api/svc/evento-handler-manifest.ts` — register the new evento.
- Modify `vibes.diy/api/types/vibes-diy-api.ts` — add `accessFnSource` to `VibesDiyApiIface`.
- Modify `vibes.diy/api/impl/index.ts` — implement `accessFnSource`.
- Modify `vibes.diy/vibe/srv-sandbox/srv-sandbox-asset-identity-auth-handlers.ts` — add `vibeAccessFnSource` handler.
- Modify `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts` — register `vibeAccessFnSource`.
- Modify `vibes.diy/vibe/runtime/register-dependencies.ts` — add `VibeSandboxApi.accessFnSource(cid)`.
- Create `vibes.diy/api/tests/access-fn-source.test.ts` — resolver unit test + host-handler end-to-end test.

Test command (from repo root): `cd vibes.diy/api/tests && pnpm exec vitest --run access-fn-source`.

---

### Task 1: Wire types + guards

**Files:** Modify `vibes.diy/vibe/types/index.ts`

- [ ] **Step 1: Add the types** (place next to `ReqVibeWhoAmI`/`ResVibeWhoAmI`, mirroring their exact style; `Base` is already imported/defined in this file):

```ts
export const ReqVibeAccessFnSource = type({
  type: "'vibe.req.accessFnSource'",
  appSlug: "string",
  ownerHandle: "string",
  cid: "string",
}).and(Base);

export type ReqVibeAccessFnSource = typeof ReqVibeAccessFnSource.infer;

export function isReqVibeAccessFnSource(x: unknown): x is ReqVibeAccessFnSource {
  return !(ReqVibeAccessFnSource(x) instanceof type.errors);
}

export const ResVibeAccessFnSource = type({
  type: "'vibe.res.accessFnSource'",
  cid: "string",
  source: "string | null",
}).and(Base);

export type ResVibeAccessFnSource = typeof ResVibeAccessFnSource.infer;

export function isResVibeAccessFnSource(x: unknown): x is ResVibeAccessFnSource {
  return !(ResVibeAccessFnSource(x) instanceof type.errors);
}
```

- [ ] **Step 2: Build the package to typecheck the new arktype**

Run: `cd /home/user/vibes.diy && pnpm --filter @vibes.diy/vibe-types build`
Expected: builds clean.

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/vibe/types/index.ts
git commit -m "feat(vibe-types): accessFnSource request/response wire types"
```

---

### Task 2: Server resolver `resolveAccessFnSource` (+ unit test)

**Files:** Create `vibes.diy/api/svc/public/access-fn-source.ts`; Create `vibes.diy/api/tests/access-fn-source.test.ts`

- [ ] **Step 1: Write the failing unit test**

Create `vibes.diy/api/tests/access-fn-source.test.ts`. Model setup on `render-vibe-viewer-env.test.ts` (it already creates an app with an access function via `ensureAppSlug`, giving a real binding row + stored asset). After creating the app, capture its `accessFnCid` by querying `vctx.sql.tables.accessFunctionBindings`, then:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { resolveAccessFnSource } from "../svc/public/access-fn-source.js";
// ...reuse the createVibeDiyTestCtx + ensureAppSlug setup from render-vibe-viewer-env.test.ts,
// creating an app whose /access.js exports `export function db(doc, oldDoc, user, ctx) { return { channels: ["c"] }; }`

describe("resolveAccessFnSource", () => {
  it("returns the raw access.js source for a known cid", async () => {
    const cid = /* accessFnCid from the binding row created in beforeAll */;
    const r = await resolveAccessFnSource(vibesCtx, { ownerHandle, appSlug, cid });
    expect(r.isOk()).toBe(true);
    expect(r.Ok().cid).toBe(cid);
    expect(r.Ok().source).toContain("export function db");
  });

  it("returns source: null for an unknown cid", async () => {
    const r = await resolveAccessFnSource(vibesCtx, { ownerHandle, appSlug, cid: "bafyUNKNOWN" });
    expect(r.isOk()).toBe(true);
    expect(r.Ok().source).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/user/vibes.diy/vibes.diy/api/tests && pnpm exec vitest --run access-fn-source.test.ts`
Expected: FAIL — `resolveAccessFnSource` not found.

- [ ] **Step 3: Implement the resolver**

Create `vibes.diy/api/svc/public/access-fn-source.ts`. Return the **raw full source** (do not call `extractExportSource`). Read the asset stream exactly as `app-documents-write-eventos.ts:250-273` does.

```ts
import { Result } from "@adviser/cement";
import { and, eq } from "drizzle-orm";
import type { VibesApiSQLCtx } from "../types.js";

export interface ResolveAccessFnSourceArgs {
  ownerHandle: string;
  appSlug: string;
  cid: string;
}

async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(merged);
}

// Resolves a vibe's full access.js source bytes for a content-addressed CID.
// Primary path: read the binding's accessFnAssetUri via the storage abstraction
// (handles SQL + R2). Fallback (legacy rows with a null URI): the CID *is* the
// Assets.assetId, so read the content blob directly. Returns { cid, source: null }
// when nothing is found — callers treat that as "unknown", never a hard deny.
export async function resolveAccessFnSource(
  vctx: VibesApiSQLCtx,
  args: ResolveAccessFnSourceArgs
): Promise<Result<{ cid: string; source: string | null }>> {
  const { ownerHandle, appSlug, cid } = args;

  const tAfb = vctx.sql.tables.accessFunctionBindings;
  const rows = await vctx.sql.db
    .select({ accessFnAssetUri: tAfb.accessFnAssetUri })
    .from(tAfb)
    .where(and(eq(tAfb.ownerHandle, ownerHandle), eq(tAfb.appSlug, appSlug), eq(tAfb.accessFnCid, cid)));

  const assetUri = rows.find((r) => r.accessFnAssetUri !== null && r.accessFnAssetUri !== undefined)?.accessFnAssetUri;
  if (assetUri !== null && assetUri !== undefined) {
    const rFetch = await vctx.storage.fetch(assetUri);
    if (rFetch.type === "fetch.ok") {
      return Result.Ok({ cid, source: await streamToString(rFetch.data) });
    }
  }

  // Fallback: content-addressed Assets row keyed by assetId === cid.
  const tAssets = vctx.sql.tables.assets;
  const assetRows = await vctx.sql.db.select({ content: tAssets.content }).from(tAssets).where(eq(tAssets.assetId, cid));
  const content = assetRows[0]?.content;
  if (content !== undefined && content !== null) {
    const bytes = content instanceof Uint8Array ? content : new Uint8Array(content as ArrayBufferLike);
    return Result.Ok({ cid, source: new TextDecoder().decode(bytes) });
  }

  return Result.Ok({ cid, source: null });
}
```

> If the `content` blob type from drizzle isn't `Uint8Array`/`ArrayBuffer` at runtime (check the test failure), coerce via `Buffer.from(content)` — confirm against what the SQLite/pg driver returns; do not guess silently.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/user/vibes.diy/vibes.diy/api/tests && pnpm exec vitest --run access-fn-source.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/public/access-fn-source.ts vibes.diy/api/tests/access-fn-source.test.ts
git commit -m "feat(api): resolveAccessFnSource — raw access.js source by cid"
```

---

### Task 3: WS evento handler + registration

**Files:** Modify `vibes.diy/api/svc/public/access-fn-source.ts`; Modify `vibes.diy/api/svc/evento-handler-manifest.ts`

- [ ] **Step 1: Add the evento handler** to `access-fn-source.ts`, mirroring `whoAmIEvento` in `who-am-i.ts` (copy its imports for `EventoHandler`, `MsgBase`, `unwrapMsgBase`, `optAuth`, `EventoResult`, `Result`, `Option`, `ResError`, `W3CWebSocketEvent`). `accessFnSource` needs no auth gate, but use the same `optAuth` wrapper as `whoAmI` for framework consistency (it permits anonymous; `_auth` goes unused):

```ts
export const accessFnSourceEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqVibeAccessFnSource>,
  ResVibeAccessFnSource | VibesDiyError
> = {
  hash: "vibe.accessFnSource",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (!isReqVibeAccessFnSource(msg.payload)) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqVibeAccessFnSource }));
  }),
  handle: optAuth(async (ctx): Promise<Result<EventoResultType>> => {
    const req = ctx.validated.payload;
    const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
    const rRes = await resolveAccessFnSource(vctx, { ownerHandle: req.ownerHandle, appSlug: req.appSlug, cid: req.cid });
    if (rRes.isErr()) {
      await ctx.send.send(ctx, { type: "vibes.diy.res-error", error: { message: rRes.Err().message } } satisfies ResError);
      return Result.Ok(EventoResult.Continue);
    }
    const r = rRes.Ok();
    await ctx.send.send(ctx, {
      type: "vibe.res.accessFnSource",
      tid: req.tid,
      cid: r.cid,
      source: r.source,
    } satisfies ResVibeAccessFnSource);
    return Result.Ok(EventoResult.Continue);
  }),
};
```

Match the exact `handle: optAuth(...)` ctx generic signature used by `whoAmIEvento` (copy it and swap the Req/Res types).

- [ ] **Step 2: Register it** in `evento-handler-manifest.ts` — add an import from `./public/access-fn-source.js` and include `accessFnSourceEvento` in the manifest array right beside the `whoAmI` handler.

- [ ] **Step 3: Build the api package**

Run: `cd /home/user/vibes.diy && pnpm --filter @vibes.diy/api-svc build` (or the package that owns these files — confirm via `package.json` name)
Expected: builds clean.

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/svc/public/access-fn-source.ts vibes.diy/api/svc/evento-handler-manifest.ts
git commit -m "feat(api): accessFnSource WS evento handler + register in manifest"
```

---

### Task 4: API iface + impl method

**Files:** Modify `vibes.diy/api/types/vibes-diy-api.ts`; Modify `vibes.diy/api/impl/index.ts`

- [ ] **Step 1: Declare on the iface** (next to `whoAmI`, ~line 223), importing the new types from `@vibes.diy/vibe-types`:

```ts
accessFnSource(req: Req<ReqVibeAccessFnSource>): Promise<Result<ResVibeAccessFnSource, VibesDiyError>>;
```

- [ ] **Step 2: Implement on `VibesDiyApi`** (next to `whoAmI`, ~line 667), importing `ReqVibeAccessFnSource, ResVibeAccessFnSource, isResVibeAccessFnSource`:

```ts
accessFnSource(req: Req<ReqVibeAccessFnSource>): Promise<Result<ResVibeAccessFnSource, VibesDiyError>> {
  return this.request({ ...req, type: "vibe.req.accessFnSource" }, { resMatch: isResVibeAccessFnSource });
}
```

- [ ] **Step 3: Build**

Run: `cd /home/user/vibes.diy && pnpm --filter @vibes.diy/api-impl build && pnpm --filter @vibes.diy/api-types build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/types/vibes-diy-api.ts vibes.diy/api/impl/index.ts
git commit -m "feat(api): accessFnSource method on VibesDiyApi(Iface)"
```

---

### Task 5: Parent sandbox handler + registration

**Files:** Modify `vibes.diy/vibe/srv-sandbox/srv-sandbox-asset-identity-auth-handlers.ts`; Modify `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts`

- [ ] **Step 1: Add `vibeAccessFnSource`**, mirroring `vibeWhoAmI` in the same file (copy imports for `isReqVibeAccessFnSource`, `ResVibeAccessFnSource`, `requireVibeApi`, `Option`, `Result`, `EventoResult`):

```ts
export function vibeAccessFnSource(sandbox: VibeApiCapableSandbox): EventoHandler {
  return {
    hash: "vibe.accessFnSource",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqVibeAccessFnSource(req?.data)) return Promise.resolve(Result.Ok(Option.Some(req.data)));
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<MessageEvent, ReqVibeAccessFnSource, unknown>): Promise<Result<EventoResultType>> => {
      const api = await requireVibeApi(sandbox, ctx, "vibe.res.accessFnSource");
      if (api === undefined) return Result.Ok(EventoResult.Stop);
      const { tid, appSlug, ownerHandle, cid } = ctx.validated;
      const rRes = await api.accessFnSource({ tid, appSlug, ownerHandle, cid });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, { tid, type: "vibe.res.accessFnSource", cid, source: null } satisfies ResVibeAccessFnSource);
        return Result.Ok(EventoResult.Stop);
      }
      const r = rRes.Ok();
      await ctx.send.send(ctx, {
        tid,
        type: "vibe.res.accessFnSource",
        cid: r.cid,
        source: r.source,
      } satisfies ResVibeAccessFnSource);
      return Result.Ok(EventoResult.Stop);
    },
  };
}
```

- [ ] **Step 2: Register it** in `srv-sandbox.ts` — add `vibeAccessFnSource(this),` to the `this.evento.push(...[ ... ])` list next to `vibeWhoAmI(this),`, and import it.

- [ ] **Step 3: Build the sandbox package**

Run: `cd /home/user/vibes.diy && pnpm --filter @vibes.diy/vibe-srv-sandbox build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/vibe/srv-sandbox/srv-sandbox-asset-identity-auth-handlers.ts vibes.diy/vibe/srv-sandbox/srv-sandbox.ts
git commit -m "feat(srv-sandbox): bridge accessFnSource request to the vibe api"
```

---

### Task 6: iframe client method

**Files:** Modify `vibes.diy/vibe/runtime/register-dependencies.ts`

- [ ] **Step 1: Add the method** to `VibeSandboxApi`, next to `whoAmI()`, importing `ReqVibeAccessFnSource, ResVibeAccessFnSource, isResVibeAccessFnSource`:

```ts
accessFnSource(cid: string): Promise<Result<ResVibeAccessFnSource>> {
  return this.request<ReqVibeAccessFnSource, ResVibeAccessFnSource>(
    {
      type: "vibe.req.accessFnSource",
      appSlug: this.svc.vibeApp.appSlug,
      ownerHandle: this.svc.vibeApp.ownerHandle,
      cid,
    },
    { wait: isResVibeAccessFnSource, timeout: 10000 }
  );
}
```

- [ ] **Step 2: Build the runtime**

Run: `cd /home/user/vibes.diy && pnpm --filter @vibes.diy/vibe-runtime build 2>&1 | rg "access" || echo "no access-related errors"`
Expected: no errors referencing the new method (the package's pre-existing TS6059 noise from #2500 is unrelated — only fail on a real error in this method).

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/vibe/runtime/register-dependencies.ts
git commit -m "feat(vibe-runtime): VibeSandboxApi.accessFnSource(cid) client method"
```

---

### Task 7: End-to-end host-handler test

**Files:** Modify `vibes.diy/api/tests/access-fn-source.test.ts`

- [ ] **Step 1: Add a host-handler test** mirroring `srv-sandbox-who-am-i.test.ts`: build a `vibesDiySrvSandbox` with a fake `api` exposing `accessFnSource` (and the `onDocChanged` noop), feed it a `vibe.req.accessFnSource` `MessageEvent`, and assert a `vibe.res.accessFnSource` is posted back with the right `cid` + `source`. Reuse that file's `setupSandbox`/`fakeMessageEvent` helpers (copy the harness shape).

```ts
it("host handler bridges vibe.req.accessFnSource → api.accessFnSource → vibe.res.accessFnSource", async () => {
  const { sandbox, captured, iframe } = setupSandbox({
    accessFnSourceResult: Result.Ok({
      type: "vibe.res.accessFnSource" as const,
      tid: "t1",
      cid: "bafyX",
      source: "export function db(){}",
    }),
  });
  sandbox.handleMessage(
    fakeMessageEvent(
      { type: "vibe.req.accessFnSource", tid: "t1", appSlug: "myapp", ownerHandle: "alice", cid: "bafyX" },
      "https://myapp--alice.example.com",
      iframe
    )
  );
  await new Promise((r) => setTimeout(r, 50));
  const msg = captured.find((c) => (c.data as { type?: string }).type === "vibe.res.accessFnSource");
  expect(msg?.data).toMatchObject({ tid: "t1", type: "vibe.res.accessFnSource", cid: "bafyX", source: "export function db(){}" });
});
```

- [ ] **Step 2: Run the full file**

Run: `cd /home/user/vibes.diy/vibes.diy/api/tests && pnpm exec vitest --run access-fn-source`
Expected: PASS (resolver unit tests + host-handler test).

- [ ] **Step 3: Lint + format the touched files**

Run: `cd /home/user/vibes.diy && npx -y prettier@latest --check <all touched files> && pnpm exec eslint <all touched .ts files>`
Expected: clean. Fix any `any`/falsy/try-catch rules-bag violations (this repo enforces them — see slice 1's review: prefer `=== null`/`=== undefined`, `exception2Result` over try/catch in non-test code, never `any`).

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/tests/access-fn-source.test.ts
git commit -m "test(api): end-to-end accessFnSource bridge handler test"
```

---

## Self-Review

**Spec coverage:** types (T1), resolver + Assets fallback (T2), WS evento + registration (T3), API iface/impl (T4), parent sandbox handler + registration (T5), iframe client method (T6), end-to-end test (T7). The full iframe→parent→server→source path is covered. Mount-params/VibeContext delivery is explicitly out of scope (slice 2c).

**Placeholder scan:** the genuinely-new code (types, resolver) is verbatim; the five mirror-layers each cite the exact `whoAmI` template at `file:line` with the field deltas and the verbatim wire-message shape — concrete references, not "similar to Task N".

**Type consistency:** `ReqVibeAccessFnSource { type, appSlug, ownerHandle, cid }` and `ResVibeAccessFnSource { type, cid, source: string | null }` (+ `tid` via `Base`) are used identically across all layers and the guards `isReqVibeAccessFnSource` / `isResVibeAccessFnSource`.

**Risks flagged for the implementer:**

- The server `build`/package names (`@vibes.diy/api-svc`, `api-impl`, `api-types`, `vibe-srv-sandbox`) — confirm the exact `name` in each `package.json` before running `--filter`.
- `optAuth` ctx generic signature: copy `whoAmIEvento`'s `handle:` line exactly and swap types; don't hand-roll the ctx type.
- The `Assets.content` runtime type may differ between the libsql (test) and pg drivers — let the unit test tell you, then coerce explicitly (no silent guessing).
- Resolver returns **raw full source**, not `extractExportSource`-reduced — slice 1's runner extracts per `dbName`. A test asserting the source still contains `export function` guards this.
- The server stays the only authority; this RPC just transports source (which is already delivered to run). `source: null` means "unknown" — never a hard deny.
