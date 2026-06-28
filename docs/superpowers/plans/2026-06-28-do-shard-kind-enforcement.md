# DO Shard-Kind Enforcement Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce, at compile time (browser) and runtime (worker), that each handler runs only on a Durable Object shard whose **kind** (and, for topology-bound ops, **identity**) is allowed — driven by one `SHARD_POLICY` source of truth in `api-types`.

**Architecture:** Lift #2715's per-handler `allowed` metadata into a shared `api-types` module (`ShardKind`, `SHARD_POLICY` keyed by request `type`, with mode-predicate entries for `open-chat`/`prompt`). The worker manifest derives `allowed` from it; a hybrid runtime gate (kind check at dispatch, identity check post-resolution) **sends a coded `ResError`** on mismatch. The browser brands its three connections `Conn<"codegen"|"vibe"|"shared">` and derives method availability from the same policy. Behavior-preserving on the current 3-DO topology — no wrangler/DO migration, no lazy-load (those are Spec B).

**Tech Stack:** TypeScript (strict, rules-bag: no `any`, no `try/catch`→`exception2Result`, `Result` not throw, no mocking), arktype, `@adviser/cement` (Evento, Result, Option, AppContext), vitest, pnpm workspaces (`@vibes.diy/api-types` → `api-pkg` → `api-impl` → `api-svc`).

**Spec:** `docs/superpowers/specs/2026-06-28-do-shard-kind-enforcement-design.md` (PR #2722).

**Branch:** `claude/do-topology-simplify-0369pt`.

---

## File Structure

**Create:**

- `vibes.diy/api/types/shard-policy.ts` — `ShardKind`, `SHARD_POLICY`, `chatShardsForMode`, `shardsForReq`, branded shard keys + constructors. The single source of truth.
- `vibes.diy/api/types/shard-policy.test-d.ts` — type-level tests (`expectTypeOf` / `@ts-expect-error`).
- `vibes.diy/api/tests/shard-policy-parity.test.ts` — manifest ↔ policy parity (extends #2715 parity).
- `vibes.diy/api/tests/shard-gate.test.ts` — runtime gate regression (kind / mode / identity, code preservation, no-write/no-broadcast).
- `vibes.diy/api/svc/shard-gate.ts` — the `gated()` wrapper + `assertShardIdentity()` helper used by the worker.

**Modify:**

- `vibes.diy/api/types/vibes-diy-api.ts` — add type-only phantom to `Req<T>`; parameterize `VibesDiyApiIface<K extends ShardKind>`; derive per-method availability.
- `vibes.diy/api/types/index.ts` (barrel) — re-export `shard-policy.ts`.
- `vibes.diy/api/svc/evento-handler-manifest.ts` — entries become `{ handler, reqType }`; `allowed`/`handlersForShard` derive from `SHARD_POLICY`; wrap with `gated()`. Re-export `ShardKind` from `api-types` (drop the local `"stream"` literal).
- `vibes.diy/pkg/workers/app-sessions.ts`, `chat-sessions.ts`, `shared-sessions.ts` — inject `{ kind, shardId }` shard identity into `appCtx`.
- `vibes.diy/api/svc/public/open-chat.ts`, `prompt-chat-section.ts` — post-resolution identity assert for chat ops.
- `vibes.diy/pkg/app/vibes-diy-provider.tsx` — brand the three connection vars (staged).
- `vibes.diy/api/tests/evento-handler-parity.test.ts` — update `"stream"` → `"codegen"`.

---

## Phase 0 — Shared policy module in `api-types`

### Task 0.1: `ShardKind` + branded shard keys

**Files:**

- Create: `vibes.diy/api/types/shard-policy.ts`
- Test: `vibes.diy/api/types/shard-policy.test-d.ts`

- [ ] **Step 1: Write the failing type test**

```ts
// vibes.diy/api/types/shard-policy.test-d.ts
import { expectTypeOf } from "vitest";
import { type ShardKind, openVibe, openShared, openCodegen, type VibeShard } from "./shard-policy.js";

expectTypeOf<ShardKind>().toEqualTypeOf<"codegen" | "vibe" | "shared">();
expectTypeOf(openVibe("alice", "todo")).toEqualTypeOf<VibeShard>();
// A raw string is NOT assignable to a branded shard key.
// @ts-expect-error branded key cannot be a bare string
const _bad: VibeShard = "alice--todo";
expectTypeOf(openShared()).toMatchTypeOf<string>();
expectTypeOf(openCodegen("uuid")).toMatchTypeOf<string>();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd vibes.diy/api/types && npx tsc --noEmit -p tsconfig.json`
Expected: FAIL — `Cannot find module './shard-policy.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// vibes.diy/api/types/shard-policy.ts

/**
 * ShardKind — the Durable Object shard a connection is opened against. The kind
 * names the *workload that needs isolation*, not the transport (streaming is not
 * exclusive to "codegen": the vibe shard streams too, for img-gen). See #2714.
 */
export type ShardKind = "codegen" | "vibe" | "shared";

export type VibeShard = string & { readonly __brand: "vibe" };
export type SharedShard = string & { readonly __brand: "shared" };
export type CodegenShard = string & { readonly __brand: "codegen" };

// Validating constructors mint the branded keys. Keep them total (no throw):
// callers already hold validated owner/slug strings at the open-site.
export function openVibe(ownerHandle: string, appSlug: string): VibeShard {
  return `${ownerHandle}--${appSlug}` as VibeShard;
}
export function openShared(shard = "global"): SharedShard {
  return shard as SharedShard;
}
export function openCodegen(streamId: string): CodegenShard {
  return streamId as CodegenShard;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd vibes.diy/api/types && npx tsc --noEmit -p tsconfig.json`
Expected: PASS (exit 0).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/types/shard-policy.ts vibes.diy/api/types/shard-policy.test-d.ts
git commit -m "feat(api-types): ShardKind + branded shard-key constructors (#2714)"
```

### Task 0.2: `SHARD_POLICY` map with mode predicate

**Files:**

- Modify: `vibes.diy/api/types/shard-policy.ts`
- Modify: `vibes.diy/api/types/shard-policy.test-d.ts`
- Test (runtime): `vibes.diy/api/tests/shard-policy-parity.test.ts` (created in Phase 1; the predicate is unit-tested here too)

- [ ] **Step 1: Write the failing test** (runtime unit test for the predicate + lookup)

```ts
// vibes.diy/api/types/shard-policy.test-d.ts  (append)
import { SHARD_POLICY, chatShardsForMode, shardsForReq } from "./shard-policy.js";

// Static entry.
expectTypeOf(SHARD_POLICY["vibes.diy.req-put-doc"]).toMatchTypeOf<
  readonly ShardKind[] | ((req: { mode?: string }) => readonly ShardKind[])
>();
// Predicate behavior (runtime assertions live in shard-policy-parity.test.ts):
const _a: readonly ShardKind[] = chatShardsForMode("codegen");
const _b: readonly ShardKind[] = shardsForReq("vibes.diy.req-put-doc", {});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd vibes.diy/api/types && npx tsc --noEmit -p tsconfig.json`
Expected: FAIL — `SHARD_POLICY`, `chatShardsForMode`, `shardsForReq` not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// vibes.diy/api/types/shard-policy.ts  (append)
import { canonicalModelUsage } from "./chat.js";

// open-chat / prompt encode their workload in `req.mode`, not the request type.
// codegen → codegen shard only; img → codegen + vibe (img-gen rides AppSessions);
// runtime → codegen (verify against current routing in the parity test).
export function chatShardsForMode(mode: string | undefined): readonly ShardKind[] {
  switch (canonicalModelUsage(mode ?? "codegen")) {
    case "img":
      return ["codegen", "vibe"];
    case "codegen":
    case "runtime":
    default:
      return ["codegen"];
  }
}

type PolicyEntry = readonly ShardKind[] | ((req: { mode?: string }) => readonly ShardKind[]);

const ALL: readonly ShardKind[] = ["codegen", "vibe", "shared"];

// One entry per request type. ALL = stateless reads/grants/identity (served on
// every shard). Port each handler's current `allowed` from
// api/svc/evento-handler-manifest.ts — the Phase-1 parity test fails loudly on
// any miss, so completeness is guaranteed, not assumed.
export const SHARD_POLICY = {
  // vibe doc ops (topology-bound, category-b):
  "vibes.diy.req-put-doc": ["vibe"],
  "vibes.diy.req-get-doc": ["vibe"],
  "vibes.diy.req-query-docs": ["vibe"],
  "vibes.diy.req-delete-doc": ["vibe"],
  "vibes.diy.req-subscribe-docs": ["vibe"],
  "vibes.diy.req-subscribe-viewer-grants": ["vibe"],
  "vibes.diy.req-list-db-names": ["vibe"],
  "vibes.diy.req-mark-dm-read": ["vibe"],
  // codegen-only lifecycle/stream ops:
  "vibes.diy.req-ensure-appSlug-item": ["codegen"],
  "vibes.diy.req-fork-app": ["codegen"],
  "vibes.diy.req-set-mode-fs": ["codegen"],
  // mode-sensitive chat ops (predicate):
  "vibes.diy.req-open-chat": (req) => chatShardsForMode(req.mode),
  "vibes.diy.req-prompt-chat-section": (req) => chatShardsForMode(req.mode),
  // …all remaining request types are ALL (stateless). Port from the manifest.
  "vibes.diy.req-list-models": ALL,
  // (continue for every handler in evento-handler-manifest.ts)
} as const satisfies Record<string, PolicyEntry>;

export type ReqType = keyof typeof SHARD_POLICY;

// Runtime resolution used by the worker gate: static set or evaluated predicate.
export function shardsForReq(reqType: string, req: { mode?: string }): readonly ShardKind[] {
  const entry = (SHARD_POLICY as Record<string, PolicyEntry | undefined>)[reqType];
  if (entry === undefined) return [];
  return typeof entry === "function" ? entry(req) : entry;
}
```

> NOTE on the `req-*` type strings: confirm each against its arktype `type:` literal (e.g. `set-mode-fs` is `"vibes.diy.req-set-mode-fs"`, see `types/app.ts:305`). The parity test (Task 1.2) asserts every manifest handler maps to a real `SHARD_POLICY` key, so a wrong string fails the build.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd vibes.diy/api/types && npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/types/shard-policy.ts vibes.diy/api/types/shard-policy.test-d.ts
git commit -m "feat(api-types): SHARD_POLICY with mode-aware chat predicate (#2714)"
```

### Task 0.3: Export from the `api-types` barrel

**Files:**

- Modify: `vibes.diy/api/types/index.ts`

- [ ] **Step 1: Add the re-export**

```ts
// vibes.diy/api/types/index.ts  (add near the other exports)
export * from "./shard-policy.js";
```

- [ ] **Step 2: Build the package**

Run: `pnpm --filter @vibes.diy/api-types build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/types/index.ts
git commit -m "chore(api-types): export shard-policy from barrel (#2714)"
```

---

## Phase 1 — Worker manifest derives from `SHARD_POLICY`

### Task 1.1: Manifest entries carry `reqType`; `allowed` derives from policy

**Files:**

- Modify: `vibes.diy/api/svc/evento-handler-manifest.ts`

- [ ] **Step 1: Write the failing test** (extend existing parity test for the new vocabulary)

```ts
// vibes.diy/api/tests/evento-handler-parity.test.ts  (replace "stream" with "codegen")
// Change every occurrence of the literal "stream" to "codegen" and import ShardKind
// from "@vibes.diy/api-types" instead of the local manifest. e.g.:
import { handlerManifest, handlersForShard } from "../svc/evento-handler-manifest.js";
import { type ShardKind } from "@vibes.diy/api-types";
// …assertions: handlersForShard("codegen") (was "stream"); doc ops still ["vibe"], etc.
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd vibes.diy/api/tests && npx vitest --run evento-handler-parity`
Expected: FAIL — `"codegen"` not yet produced (manifest still emits `"stream"`).

- [ ] **Step 3: Rewrite the manifest to derive from policy**

```ts
// vibes.diy/api/svc/evento-handler-manifest.ts  (replace ShardKind + entry + allowed plumbing)
import { EventoHandler } from "@adviser/cement";
import { ShardKind, ReqType, shardsForReq } from "@vibes.diy/api-types";
// …existing handler imports unchanged…

export type { ShardKind };

export interface HandlerManifestEntry {
  readonly reqType: ReqType;
  readonly handler: EventoHandler;
}

function entry(reqType: ReqType, handler: EventoHandler): HandlerManifestEntry {
  return { reqType, handler };
}

// One list; allowed comes from SHARD_POLICY[reqType] (no inline allowed).
export const handlerManifest: readonly HandlerManifestEntry[] = [
  entry("vibes.diy.req-list-models", listModelsEvento),
  // …one entry per handler, mapping handler → its request type…
  entry("vibes.diy.req-put-doc", putDocEvento),
  entry("vibes.diy.req-open-chat", openChat),
  entry("vibes.diy.req-prompt-chat-section", promptChatSection),
  entry("vibes.diy.req-ensure-appSlug-item", ensureAppSlugItemEvento),
  entry("vibes.diy.req-fork-app", forkAppEvento),
  entry("vibes.diy.req-set-mode-fs", setModeFsIdEvento),
  // …
];

// A handler is served on `kind` if kind ∈ its static allowed set. For mode-
// predicate ops we union over all modes (the per-request mode gate refines at
// dispatch) so the evento still registers them on every shard they can serve.
const KINDS: readonly ShardKind[] = ["codegen", "vibe", "shared"];
function allowedKinds(reqType: ReqType): readonly ShardKind[] {
  // Union across modes: a predicate op is "allowed" on a kind if SOME mode puts it there.
  return KINDS.filter((k) =>
    ["codegen", "vibe", "shared", "img", "runtime"].some((mode) => shardsForReq(reqType, { mode }).includes(k))
  );
}

export function handlersForShard(kind: ShardKind): EventoHandler[] {
  return handlerManifest.filter((e) => allowedKinds(e.reqType).includes(kind)).map((e) => e.handler);
}
```

> The img-gen union means `open-chat` registers on both `codegen` and `vibe` eventos (behavior-preserving vs. #2715). The per-request **mode** refinement is the runtime gate (Phase 2), which rejects `mode:"codegen"` arriving on a `vibe` DO.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd vibes.diy/api/tests && npx vitest --run evento-handler-parity shared-msg-evento`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/evento-handler-manifest.ts vibes.diy/api/tests/evento-handler-parity.test.ts
git commit -m "refactor(api): manifest derives allowed from api-types SHARD_POLICY (#2714)"
```

### Task 1.2: Parity test — manifest ↔ policy 1:1

**Files:**

- Create: `vibes.diy/api/tests/shard-policy-parity.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// vibes.diy/api/tests/shard-policy-parity.test.ts
import { describe, expect, it } from "vitest";
import { handlerManifest } from "../svc/evento-handler-manifest.js";
import { SHARD_POLICY, shardsForReq, chatShardsForMode } from "@vibes.diy/api-types";

describe("shard policy ↔ manifest parity (#2714)", () => {
  it("every manifest reqType has exactly one SHARD_POLICY entry", () => {
    for (const e of handlerManifest) {
      expect(Object.prototype.hasOwnProperty.call(SHARD_POLICY, e.reqType), `no policy for ${e.reqType}`).toBe(true);
    }
  });
  it("every SHARD_POLICY key is used by exactly one manifest handler", () => {
    const used = handlerManifest.map((e) => e.reqType);
    for (const key of Object.keys(SHARD_POLICY)) {
      expect(used.filter((u) => u === key).length, `${key} not 1:1`).toBe(1);
    }
  });
  it("doc writes are vibe-only", () => {
    for (const t of ["vibes.diy.req-put-doc", "vibes.diy.req-subscribe-docs"]) {
      expect([...shardsForReq(t, {})].sort()).toEqual(["vibe"]);
    }
  });
  it("chat mode predicate: codegen isolates, img rides vibe", () => {
    expect([...chatShardsForMode("codegen")].sort()).toEqual(["codegen"]);
    expect([...chatShardsForMode("img")].sort()).toEqual(["codegen", "vibe"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails (or surfaces gaps)**

Run: `cd vibes.diy/api/tests && npx vitest --run shard-policy-parity`
Expected: FAIL listing any handler whose `reqType` is missing from `SHARD_POLICY` — fix Task 0.2 until green.

- [ ] **Step 3: Add missing `SHARD_POLICY` entries**

Add an entry for each handler the test names (port its `allowed` from git history of `evento-handler-manifest.ts` pre-refactor). Re-run until green.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd vibes.diy/api/tests && npx vitest --run shard-policy-parity`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/types/shard-policy.ts vibes.diy/api/tests/shard-policy-parity.test.ts
git commit -m "test(api): manifest ↔ SHARD_POLICY parity (#2714)"
```

---

## Phase 2 — Worker runtime gate

### Task 2.1: Inject shard identity into `appCtx`

**Files:**

- Modify: `vibes.diy/pkg/workers/app-sessions.ts:159-166`, `chat-sessions.ts`, `shared-sessions.ts`

- [ ] **Step 1: Write the failing test**

```ts
// vibes.diy/api/tests/shard-gate.test.ts  (first case)
import { describe, expect, it } from "vitest";
import { appMsgEvento } from "../svc/shard-gate-fixtures.js"; // see note
// Assert: a vibe-kind ctx carries shardIdentity {kind:"vibe", shardId:"alice--todo"}.
```

> NOTE: the api-test harness exercises eventos with a constructed `appCtx`. Mirror an existing test that builds `cfServeAppCtx` (e.g. `app-documents.test.ts`) and pass the shard identity. No mocking (rules-bag) — use the real ctx builder.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd vibes.diy/api/tests && npx vitest --run shard-gate`
Expected: FAIL — shard identity not present on ctx.

- [ ] **Step 3: Inject identity in each DO**

```ts
// app-sessions.ts — before `return cfServe(request, cctx, appMsgEvento);`
import { openVibe } from "@vibes.diy/api-types";
// …
cctx.appCtx.set("shardIdentity", {
  kind: "vibe" as const,
  shardId: currentVibeKey ?? "", // owner--appSlug from ?vibe=
});
```

```ts
// shared-sessions.ts — analogous, kind "shared", shardId the singleton/user shard
cctx.appCtx.set("shardIdentity", { kind: "shared" as const, shardId });
// chat-sessions.ts — kind "codegen", shardId the stream UUID shard
cctx.appCtx.set("shardIdentity", { kind: "codegen" as const, shardId });
```

Define the shape once in `api-types/shard-policy.ts`:

```ts
export interface ShardIdentity {
  readonly kind: ShardKind;
  readonly shardId: string;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd vibes.diy/api/tests && npx vitest --run shard-gate`
Expected: PASS (first case).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/workers/*.ts vibes.diy/api/types/shard-policy.ts vibes.diy/api/tests/shard-gate.test.ts
git commit -m "feat(api): inject shard identity into appCtx per DO (#2714)"
```

### Task 2.2: `gated()` wrapper — kind + mode check sends coded ResError

**Files:**

- Create: `vibes.diy/api/svc/shard-gate.ts`
- Modify: `vibes.diy/api/svc/evento-handler-manifest.ts` (wrap handlers in `handlersForShard`)

- [ ] **Step 1: Write the failing test**

```ts
// vibes.diy/api/tests/shard-gate.test.ts  (append)
it("open-chat {mode:codegen} on a vibe DO → res-error code wrong-shard-kind, no handler run", async () => {
  // Drive appMsgEvento (vibe ctx, shardId alice--todo) with req-open-chat mode:codegen.
  // Capture sent messages via the test send provider.
  // Expect a res-error with error.code === "wrong-shard-kind" and that openChat's
  // resolution (ensureApplicationChatId) was never reached (no chat row created).
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd vibes.diy/api/tests && npx vitest --run shard-gate`
Expected: FAIL — request currently runs (no gate).

- [ ] **Step 3: Implement `gated()`**

```ts
// vibes.diy/api/svc/shard-gate.ts
import { EventoHandler, EventoResult, Result, EventoResultType, HandleTriggerCtx } from "@adviser/cement";
import { ReqType, ShardIdentity, shardsForReq } from "@vibes.diy/api-types";
import { ResError } from "@vibes.diy/api-types";

export function gated(reqType: ReqType, handler: EventoHandler): EventoHandler {
  return {
    ...handler,
    handle: async (ctx: HandleTriggerCtx): Promise<Result<EventoResultType>> => {
      const id = ctx.ctx.get<ShardIdentity>("shardIdentity");
      const req = (ctx as { validated?: { payload?: { mode?: string } } }).validated?.payload ?? {};
      if (id !== undefined) {
        const allowed = shardsForReq(reqType, req);
        if (!allowed.includes(id.kind)) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: { message: `handler ${reqType} not allowed on shard kind ${id.kind}`, code: "wrong-shard-kind" },
          } satisfies ResError);
          return Result.Ok(EventoResult.Continue); // stop: do NOT run the handler
        }
      }
      return handler.handle(ctx);
    },
  };
}
```

Wrap in the manifest:

```ts
// evento-handler-manifest.ts — handlersForShard maps through gated()
import { gated } from "./shard-gate.js";
export function handlersForShard(kind: ShardKind): EventoHandler[] {
  return handlerManifest.filter((e) => allowedKinds(e.reqType).includes(kind)).map((e) => gated(e.reqType, e.handler));
}
```

> Confirm `ctx.ctx.get<T>(key)` returns `undefined` when absent (cement `AppContext`); if the API is `getOrThrow`/`get`, use the non-throwing `get`. The `validated.payload` access mirrors `open-chat.ts:41` (`ctx.validated.payload`).

- [ ] **Step 4: Run it to verify it passes**

Run: `cd vibes.diy/api/tests && npx vitest --run shard-gate`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/shard-gate.ts vibes.diy/api/svc/evento-handler-manifest.ts vibes.diy/api/tests/shard-gate.test.ts
git commit -m "feat(api): runtime kind+mode gate sends coded ResError (#2714)"
```

### Task 2.3: Identity assert for doc ops (no write / no broadcast on mismatch)

**Files:**

- Modify: `vibes.diy/api/svc/shard-gate.ts` (add `assertShardIdentity`)
- Modify: `vibes.diy/api/svc/public/app-documents.ts` (call it at the top of each vibe-keyed handler) OR fold into `gated()` for doc ops

- [ ] **Step 1: Write the failing test**

```ts
// vibes.diy/api/tests/shard-gate.test.ts  (append)
it("put-doc for vibe B on vibe A's DO → res-error wrong-shard, NO d1 write, NO broadcast", async () => {
  // vibe ctx shardId "alice--todo"; req-put-doc ownerHandle "bob" appSlug "notes".
  // Expect res-error code "wrong-shard"; assert the doc was not persisted (query returns
  // nothing) and the broadcast callback was not invoked (count stays 0).
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd vibes.diy/api/tests && npx vitest --run shard-gate`
Expected: FAIL — write currently persists + broadcasts.

- [ ] **Step 3: Implement the identity assert**

```ts
// shard-gate.ts (append) — used by gated() for doc ops (reqType vibe-only AND req carries owner/appSlug)
import { Option } from "@adviser/cement";

export function shardIdentityError(id: ShardIdentity, ownerHandle: string, appSlug: string): Option<ResError> {
  if (`${ownerHandle}--${appSlug}` === id.shardId) return Option.None();
  return Option.Some({
    type: "vibes.diy.res-error",
    error: { message: `request targets ${ownerHandle}--${appSlug} but shard is ${id.shardId}`, code: "wrong-shard" },
  } satisfies ResError);
}
```

Extend `gated()` so that when the request payload carries `ownerHandle` + `appSlug` and `id.kind === "vibe"`, it runs `shardIdentityError` and, if `Some`, sends it and stops **before** `handler.handle(ctx)` — i.e. before any D1 write or broadcast.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd vibes.diy/api/tests && npx vitest --run shard-gate`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/shard-gate.ts vibes.diy/api/tests/shard-gate.test.ts
git commit -m "feat(api): fail-loud shard-identity assert for doc ops (#2714)"
```

### Task 2.4: Identity assert for chat ops (post-resolution)

**Files:**

- Modify: `vibes.diy/api/svc/public/open-chat.ts`, `prompt-chat-section.ts`

- [ ] **Step 1: Write the failing test**

```ts
// vibes.diy/api/tests/shard-gate.test.ts  (append)
it("open-chat {mode:img} whose resolved app ≠ vibe shard → res-error wrong-shard after resolution", async () => {
  // vibe ctx shardId "alice--todo"; img open-chat that resolves (ensureApplicationChatId)
  // to ownerHandle "bob"/appSlug "notes". Expect res-error code "wrong-shard".
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd vibes.diy/api/tests && npx vitest --run shard-gate`
Expected: FAIL.

- [ ] **Step 3: Add the post-resolution assert in `open-chat.ts`**

```ts
// open-chat.ts — after the chatId/app is resolved (the ensureApplicationChatId path, ~line 52),
// and ONLY when running on a vibe shard:
import { shardIdentityError } from "../shard-gate.js";
import { ShardIdentity } from "@vibes.diy/api-types";
// …
const id = ctx.ctx.get<ShardIdentity>("shardIdentity");
if (id !== undefined && id.kind === "vibe") {
  const err = shardIdentityError(id, resolvedOwnerHandle, resolvedAppSlug);
  if (err.isSome()) {
    await ctx.send.send(ctx, err.Ok());
    return Result.Ok(EventoResult.Continue);
  }
}
```

Repeat the same post-resolution guard in `prompt-chat-section.ts`.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd vibes.diy/api/tests && npx vitest --run shard-gate`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/public/open-chat.ts vibes.diy/api/svc/public/prompt-chat-section.ts vibes.diy/api/tests/shard-gate.test.ts
git commit -m "feat(api): post-resolution shard-identity assert for chat ops (#2714)"
```

### Task 2.5: Full worker suite green

- [ ] **Step 1: Run the api tests touching dispatch**

Run: `cd vibes.diy/api/tests && npx vitest --run evento shard app-documents fork-app who-am-i put-doc app-session-chat-stopgap`
Expected: PASS (behavior-preserving — every existing dispatch test still green).

- [ ] **Step 2: Commit (if any fixups)**

```bash
git add -A && git commit -m "test(api): worker gate suite green (#2714)"
```

---

## Phase 3 — Browser `Conn<K>` + branding

### Task 3.1: Type-only phantom on `Req<T>` + `MethodReqType`

**Files:**

- Modify: `vibes.diy/api/types/vibes-diy-api.ts:161`
- Test: `vibes.diy/api/types/shard-policy.test-d.ts`

- [ ] **Step 1: Write the failing type test**

```ts
// shard-policy.test-d.ts (append)
import { expectTypeOf } from "vitest";
import type { Req, MethodReqType } from "./vibes-diy-api.js";
import type { ReqPutDoc } from "./app-documents.js";
expectTypeOf<MethodReqType<(req: Req<ReqPutDoc>) => unknown>>().toEqualTypeOf<"vibes.diy.req-put-doc">();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd vibes.diy/api/types && npx tsc --noEmit -p tsconfig.json`
Expected: FAIL — `MethodReqType` not exported; phantom not present.

- [ ] **Step 3: Add phantom + extractor**

```ts
// vibes-diy-api.ts (replace the Req<T> alias at line 161)
export type Req<T> = T extends unknown
  ? Omit<T, "type" | "auth"> & OptionalAuth & { readonly __reqType?: T extends { type: infer Ty } ? Ty : never }
  : never;

// Extract the literal request `type` a method accepts.
export type MethodReqType<M> = M extends (req: infer R) => unknown ? (R extends { __reqType?: infer Ty } ? Ty : never) : never;
```

> Caveat (Charlie #1): normalize any method whose `req` isn't a `Req<ReqX>` (e.g. `subscribeUserNotifications`) so the phantom is present. A follow-up parity test (Task 3.3) asserts no method resolves to `never`.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd vibes.diy/api/types && npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/types/vibes-diy-api.ts vibes.diy/api/types/shard-policy.test-d.ts
git commit -m "feat(api-types): phantom reqType on Req<T> + MethodReqType (#2714)"
```

### Task 3.2: `Conn<K>` derives method availability from policy

**Files:**

- Modify: `vibes.diy/api/types/vibes-diy-api.ts`
- Test: `vibes.diy/api/types/shard-policy.test-d.ts`

- [ ] **Step 1: Write the failing type test**

```ts
// shard-policy.test-d.ts (append)
import type { Conn } from "./vibes-diy-api.js";
declare const vibe: Conn<"vibe">;
declare const shared: Conn<"shared">;
vibe.putDoc({ ownerHandle: "a", appSlug: "t", dbName: "d", doc: {} }); // ok
// @ts-expect-error put-doc not allowed on shared
shared.putDoc({ ownerHandle: "a", appSlug: "t", dbName: "d", doc: {} });
shared.listModels({}); // ok — ALL
// @ts-expect-error open-chat codegen mode not allowed on vibe
vibe.openChat({ mode: "codegen" });
vibe.openChat({ mode: "img" }); // ok
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd vibes.diy/api/types && npx tsc --noEmit -p tsconfig.json`
Expected: FAIL — `Conn` not exported.

- [ ] **Step 3: Implement `Conn<K>`**

```ts
// vibes-diy-api.ts (append)
import type { ShardKind, ReqType, SHARD_POLICY } from "./shard-policy.js";

// A method is available on Conn<K> iff K is in its static policy. Mode-predicate
// ops (open-chat/prompt) are hand-narrowed per kind below.
type StaticShards<T extends ReqType> = (typeof SHARD_POLICY)[T] extends readonly ShardKind[]
  ? (typeof SHARD_POLICY)[T][number]
  : never;

type AvailableMethods<K extends ShardKind> = {
  [M in keyof VibesDiyApiIface as MethodReqType<VibesDiyApiIface[M]> extends ReqType
    ? K extends StaticShards<MethodReqType<VibesDiyApiIface[M]>>
      ? M
      : never
    : M /* methods without a static policy (predicate ops) handled by overrides */]: VibesDiyApiIface[M];
};

// Mode-predicate overrides: narrow openChat/prompt by kind.
type ChatOverrides<K extends ShardKind> = K extends "vibe"
  ? { openChat(req: Req<ReqOpenChat> & { mode: "img" }): ReturnType<VibesDiyApiIface["openChat"]> }
  : { openChat: VibesDiyApiIface["openChat"] };

export type Conn<K extends ShardKind> = AvailableMethods<K> & ChatOverrides<K>;
```

> This is the trickiest type in the plan. If the mapped-type `as` filtering proves brittle for predicate ops, fall back to: derive `AvailableMethods` for static ops only, then intersect explicit per-kind overrides for the handful of predicate ops. Keep the `@ts-expect-error` fixtures as the contract.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd vibes.diy/api/types && npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/types/vibes-diy-api.ts vibes.diy/api/types/shard-policy.test-d.ts
git commit -m "feat(api-types): Conn<K> derives method availability from SHARD_POLICY (#2714)"
```

### Task 3.3: No method resolves to `never` (normalize outliers)

**Files:**

- Test: `vibes.diy/api/types/shard-policy.test-d.ts`
- Modify: `vibes.diy/api/types/vibes-diy-api.ts` (fix any method whose `MethodReqType` is `never`)

- [ ] **Step 1: Write the failing type test**

```ts
// shard-policy.test-d.ts (append)
import type { MethodReqType } from "./vibes-diy-api.js";
type AnyNever = {
  [M in keyof VibesDiyApiIface]: MethodReqType<VibesDiyApiIface[M]> extends never ? M : never;
}[keyof VibesDiyApiIface];
expectTypeOf<AnyNever>().toEqualTypeOf<never>(); // every method maps to a concrete reqType
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd vibes.diy/api/types && npx tsc --noEmit -p tsconfig.json`
Expected: FAIL — names the outlier method(s) (e.g. `subscribeUserNotifications`).

- [ ] **Step 3: Normalize each outlier**

Re-type each named method's `req` param as `Req<ReqX>` for its concrete request type so the phantom is present. Re-run until `AnyNever` is `never`.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd vibes.diy/api/types && npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/types/vibes-diy-api.ts vibes.diy/api/types/shard-policy.test-d.ts
git commit -m "fix(api-types): every API method maps to a concrete reqType (#2714)"
```

### Task 3.4: Brand the three connection vars (staged)

**Files:**

- Modify: `vibes.diy/pkg/app/vibes-diy-provider.tsx:248-310`

- [ ] **Step 1: Stage 1 — introduce aliases (no behavior change)**

Type the context fields: `chatApi: Conn<"codegen">`, `vibeApi?: Conn<"vibe">`, `sharedApi: Conn<"shared">`. Build will surface every wrong-kind call site.

Run: `pnpm --filter vibes-diy build` (or `cd vibes.diy/pkg && npx tsc --noEmit`)
Expected: compile errors only at genuine wrong-kind call sites (the safety the spec promises).

- [ ] **Step 2: Stage 2 — make factories generic by kind**

Make `buildAppApi` return `Conn<"vibe">`, `makeLazyChatApi` return `Conn<"codegen">`, the shared factory return `Conn<"shared">`. Update `appApiFor` signature to `(vibeKey: string) => Conn<"vibe">`.

- [ ] **Step 3: Stage 3 — remove fallback unions**

Replace `vibeApi ?? chatApi`-style fallbacks at hotspots with the kind-correct connection. Where a true union is unavoidable mid-migration, add a single narrow escape hatch comment `// TODO(#2714): kind-narrow this call site` — not a blanket cast.

- [ ] **Step 4: Verify build + browser-import guard**

Run: `pnpm build && pnpm lint`
Expected: PASS (lint includes `check-browser-imports.mjs` — confirm `api-types/shard-policy` is browser-safe: no node/worker-only imports; it imports only `./chat.js`).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/vibes-diy-provider.tsx
git commit -m "feat(pkg): brand chat/vibe/shared connections Conn<K> (#2714)"
```

---

## Phase 4 — Docs, blog seed, full check

### Task 4.1: Update architecture doc + blog seed

**Files:**

- Modify: `agents/do-session-split.md` (mark Spec A shipped; update vocabulary `stream`→`codegen`)
- Create: `notes/blog-seeds/2026-06-28-shard-kind-enforcement.md`

- [ ] **Step 1: Update `do-session-split.md`** — note the enforcement layer shipped, `ShardKind` now `codegen|vibe|shared`, `SHARD_POLICY` in `api-types`, the runtime gate + coded errors. Keep the Spec B section.

- [ ] **Step 2: Write the blog seed** — hook: "types enforce kind, runtime enforces identity"; the `codegen` rename; the mode-predicate gotcha (Codex P1); the coded-ResError-not-throw gotcha (Codex P2).

- [ ] **Step 3: Commit**

```bash
git add agents/do-session-split.md notes/blog-seeds/2026-06-28-shard-kind-enforcement.md
git commit -m "docs(blog-seed): shard-kind enforcement layer (#2714)"
```

### Task 4.2: Full verification

- [ ] **Step 1: rules-bag + format + build + lint + tests**

Run:

```bash
pnpm run rules-bag:constructors
npx prettier --check "vibes.diy/api/**/*.ts" "vibes.diy/pkg/app/vibes-diy-provider.tsx" "docs/superpowers/**/*.md" "notes/blog-seeds/2026-06-28-shard-kind-enforcement.md"
pnpm build && pnpm lint
cd vibes.diy/api/tests && npx vitest --run
```

Expected: all PASS.

- [ ] **Step 2: Final commit + push**

```bash
git add -A && git commit -m "chore(api): shard-kind enforcement layer complete (#2714)" || true
git push
```

---

## Self-Review

**Spec coverage:** ✅ shared module (Phase 0) · worker manifest lift + parity (Phase 1) · runtime hybrid gate with kind+mode+identity + coded ResError (Phase 2) · browser `Conn<K>` derive-from-policy + staged branding + phantom derivation (Phase 3) · docs/blog/check (Phase 4). Codex P1 (mode predicate + compile narrowing in 0.2/2.2/3.2), Codex P2 (coded ResError, sent not thrown, asserted on wire in 2.2/2.3), Charlie #1 (phantom 3.1, no-`never` 3.3), #2/#3 (dispatch kind gate 2.2 + post-resolution identity 2.4), #4 (single-source + parity 1.2), #5 (staged branding 3.4).

**Placeholder scan:** The `SHARD_POLICY` enumeration is intentionally partial in 0.2 and completed mechanically in 1.2/0.2 under a parity test that fails on any miss — this is the one place exhaustive inline enumeration (~50 entries) is replaced by a fail-loud test, which is stronger than a copied list. All other steps carry concrete code.

**Type consistency:** `ShardKind`, `ShardIdentity`, `SHARD_POLICY`, `ReqType`, `shardsForReq`, `chatShardsForMode`, `MethodReqType`, `Conn<K>`, `gated`, `shardIdentityError` — names used consistently across tasks. `appCtx` key `"shardIdentity"` consistent (2.1 set, 2.2/2.4 get). Vocabulary `"stream"`→`"codegen"` applied in 1.1 and 4.1.

**Risk note:** Task 3.2 (`Conn<K>` mapped type) is the highest-uncertainty step; the `@ts-expect-error` fixtures are the contract and a documented fallback (static-derive + explicit predicate overrides) is provided.
