# DO Shard-Kind Enforcement Layer — Design (#2714 Spec A)

**Status:** design, pre-implementation
**Issue:** [#2714](https://github.com/VibesDIY/vibes.diy/issues/2714) (declarative shard-keyed API)
**Predecessor (shipped):** [#2715](https://github.com/VibesDIY/vibes.diy/pull/2715) — declarative handler manifest (`allowed: ShardKind[]`, `handlersForShard(kind)`)
**Companion (future):** Spec B — physical collapse (lazy-load capability modules, 3 DO classes → 1/2, wrangler migration)

## Summary

#2715 made the worker's handler placement declarative: one manifest, each handler tagged with the shard kinds allowed to serve it. This spec builds the **enforcement** the issue calls the keystone — the part you can never delete — on top of that, **without any DO migration**:

1. A **single source-of-truth module in `api-types`** (the package-graph leaf both planes already import) declaring `ShardKind`, the `SHARD_POLICY` map (keyed by request `type`), and branded shard-key constructors.
2. **Browser compile-time _kind_ enforcement** — connections become `Conn<K extends ShardKind>`; a method exists on the type only if `K` is in that request's policy. `putDoc` on a `Conn<"shared">` is a compile error, derived from the shared map.
3. **Worker runtime _kind_ + _identity_ gate** — mirror the kind check for non-TS callers, and add a fail-loud assertion that the connection's shard identity matches the request's (resolved) target. A topology-bound write that can't reach its vibe's broadcast shard **fails loud — a coded `ResError` is sent, never persist-and-go-quiet**.

Types enforce _kind_; runtime enforces _identity_. This spec hardens the **current** 3-DO topology and turns Spec B into a pure infra/migration job.

## Decisions (locked in brainstorm)

| Decision                         | Choice                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope                            | Enforcement layer only; behavior-preserving. No wrangler/DO-class change, no lazy-load.                                                                                   |
| `ShardKind` vocabulary           | `"codegen" \| "vibe" \| "shared"` (renames #2715's `"stream"` → `"codegen"`)                                                                                              |
| Shared module home               | `api-types` (leaf package; both browser and worker already depend on it → no cycle)                                                                                       |
| `SHARD_POLICY` key               | request `type` discriminant; entries are a static `ShardKind[]` **or** a `(req) => ShardKind[]` predicate for mode-sensitive ops (`open-chat`/`prompt` key on `req.mode`) |
| Browser enforcement              | Derive method availability on `Conn<K>` from `SHARD_POLICY`; brand all three connection vars                                                                              |
| `Conn<K>` derivation             | type-only phantom on `Req<T>` → `MethodReqType<M>` (no hand map); normalize ad-hoc-typed methods first                                                                    |
| Gate seam                        | **kind** gate at `cf-serve` dispatch (chokepoint); **identity** gate in handler logic post-resolution                                                                     |
| Fail-loud mechanism              | Gate **sends** a coded `ResError` (`wrong-shard` / `wrong-shard-kind`) and stops dispatch — not a bare throw                                                              |
| Identity gate coverage           | Assert on **all** vibe-keyed ops (reads + writes); fail-loud-never-persist emphasis on writes/fan-out                                                                     |
| `forkApp`/`setModeFsId` → shared | Follow-up, not in this spec                                                                                                                                               |

### Review integration (Codex + Charlie, #2722)

Two automated reviews refined the design before planning:

- **Codex P1 — mode-aware chat policy.** `open-chat`/`prompt` encode the workload in `req.mode` (`codegen`/`runtime`/`img`, dispatched via `canonicalModelUsage(req.mode)` in `open-chat.ts`), **not** in the request `type`. A type-only policy would let `Conn<"vibe">.openChat({mode:"codegen"})` pass the kind gate and run heavy codegen on AppSessions. Fix: `SHARD_POLICY` entries for these ops are **predicates on `req.mode`** (`codegen→["codegen"]`, `img→["codegen","vibe"]`, `runtime→` per current routing, verified by test). The browser narrows `Conn<"vibe">.openChat` to `mode:"img"` so the wrong-mode call is also a compile error.
- **Codex P2 — preserve the error code.** The WS catch in `cf-serve.ts` rewrites an escaping exception to `code:"internal-error"`, and the Evento error handlers build `res-error` with no code, so a _thrown_ gate error would never surface `wrong-shard*` to clients or tests. The gate therefore **sends** the coded `ResError` and stops dispatch.
- **Charlie #1/#3 — derivation + resolved identity.** `Req<T>` currently drops `type`, so a type-only phantom marker on `Req<T>` is needed to recover `MethodReqType<M>` automatically (normalize outliers like `subscribeUserNotifications` first). For chat ops the identity target is the **resolved** canonical `(ownerHandle, appSlug)` discovered during resolution (`ensureApplicationChatId` / `getResChatFromMode`), not raw req fields.
- **Charlie #2/#5 — seam + staged branding.** Kind gate at dispatch, identity gate post-resolution; brand in stages (aliases → generic factories/proxies → remove `vibeApi ?? chatApi` fallback unions → drop the temporary escape hatch).

### Why `"codegen"`, not `"stream"`

`"stream"` names the wrong axis: streaming is **not** exclusive to ChatSessions. The vibe shard already carries streams (the img-gen `open-chat`/`prompt` path), just lighter, co-tenantable ones. What makes ChatSessions its own shard is **heavy codegen-stream isolation** — one intensive long-lived stream per worker, can't co-tenant. The kind names the _workload that needs isolation_, not the transport.

- `codegen` — ChatSessions: per-stream UUID shard; isolates heavy codegen streams.
- `vibe` — AppSessions: `owner--appSlug` rendezvous; local broadcast + access-fn, **and can carry lighter streams** (img-gen).
- `shared` — SharedSessions: always-warm singleton; stateless reads.

Payoff: the #2350 stopgap entry now reads its own justification — `open-chat`/`prompt` get `allowed: ["codegen","vibe"]` ("heavy on codegen, lighter on vibe for img-gen") instead of the opaque `["stream","vibe"]`.

Honest nuance to keep in code comments: a few non-codegen ops (`ensureAppSlugItem`, `forkApp`, `setModeFsId`) also ride the codegen shard for app-create/lifecycle reasons, not because they are codegen. The kind names the shard's _reason to exist_; those ops are along for the ride. (`ensureAppSlugItem` additionally imports `processAccessBindings` → QuickJS, so it is code-bound to a QuickJS-carrying shard until Spec B's lazy-load; `forkApp`/`setModeFsId` are pure D1 writes and free to widen to `shared` whenever a caller benefits.)

## Architecture

### 1. Shared module (`api-types`)

```ts
export type ShardKind = "codegen" | "vibe" | "shared";

// The single source of truth for placement. Keyed by the wire discriminant so
// the browser (which sends a req type per method) and the worker (which validates
// one) read the same map. Lifted out of #2715's inline `handlerManifest.allowed`.
// An entry is a static shard set, or a predicate for mode-sensitive ops whose
// workload axis is `req.mode`, not the request `type` (Codex P1).
type PolicyEntry = readonly ShardKind[] | ((req: { mode?: string }) => readonly ShardKind[]);

export const SHARD_POLICY = {
  "vibes.diy.req-put-doc": ["vibe"],
  "vibes.diy.req-list-models": ["codegen", "vibe", "shared"],
  // open-chat/prompt: workload is in req.mode → predicate, not a static set.
  "vibes.diy.req-open-chat": (req) => chatShardsForMode(req.mode), // codegen→[codegen]; img→[codegen,vibe]
  // … one entry per request type
} as const satisfies Record<string, PolicyEntry>;

export type ReqType = keyof typeof SHARD_POLICY;
// Static-entry shard set (mode-predicate entries are resolved at runtime/with the mode literal).
export type ShardsFor<T extends ReqType> = (typeof SHARD_POLICY)[T] extends readonly ShardKind[]
  ? (typeof SHARD_POLICY)[T][number]
  : ShardKind;

// Branded shard keys minted by validating constructors.
export type VibeShard = string & { readonly __brand: "vibe" };
export type SharedShard = string & { readonly __brand: "shared" };
export type CodegenShard = string & { readonly __brand: "codegen" };

export function openVibe(ownerHandle: string, appSlug: string): VibeShard; // `${owner}--${slug}`
export function openShared(shard?: string): SharedShard; // default "global"
export function openCodegen(streamId: string): CodegenShard;
```

The worker's `handlerManifest` (in `api-svc`) stops hard-coding `allowed` inline; each entry pairs `{ handler, reqType }` and derives `allowed = SHARD_POLICY[reqType]`. `handlersForShard(kind)` is unchanged in behavior. A **parity test** asserts the manifest's handler-hash ↔ reqType ↔ `SHARD_POLICY` entries are 1:1:1, so the worker objects and the shared map cannot drift.

### 2. Browser `Conn<K>` (derive from `allowed`)

`VibesDiyApiIface` becomes `VibesDiyApiIface<K extends ShardKind>`. Each method is present **iff** `K` is in that method's policy, via a conditional/mapped type driven by the shared map.

To derive a method's req `type` automatically (Charlie #1): `Req<T>` today drops `type`, so add a **type-only phantom** `{ readonly __reqType?: T["type"] }` to `Req<T>` (no runtime cost), then `MethodReqType<M>` reads the literal off each method's `req` param. Normalize any ad-hoc-typed methods first (e.g. `subscribeUserNotifications`) so every method points to one concrete request type. For the mode-predicate ops, the per-kind signature is hand-narrowed (`Conn<"vibe">.openChat` accepts only `mode:"img"`); everything else is fully derived.

The provider brands all three connections:

```ts
chatApi: Conn<"codegen">;
vibeApi: Conn<"vibe">;
sharedApi: Conn<"shared">;
```

- `sharedApi.putDoc(...)` → **compile error** (`put-doc` is `["vibe"]`).
- `sharedApi.listModels(...)` → fine (`["codegen","vibe","shared"]`).
- A handler later flipped to vibe-only **auto-restricts** every wrong-kind call site — no hand-maintained second list.

Open-sites use the branded constructors so the right shard key is minted. Churn lands in `vibes-diy-provider.tsx` and any call site that today reuses one connection variable across kinds — stage it (Charlie #5): introduce `Conn<K>` aliases → make the factories/`makeLazyChatApi` proxy generic by kind → remove `vibeApi ?? chatApi` fallback unions at hotspots → drop the temporary boundary escape hatch last.

### 3. Worker runtime gate (dispatch)

The DO injects its own identity into `appCtx` before dispatch — it already knows it:

| DO               | injected                                                                               |
| ---------------- | -------------------------------------------------------------------------------------- |
| `AppSessions`    | `{ kind: "vibe", shardId: this.vibeKey }` (the `?vibe=owner--slug` it was opened with) |
| `SharedSessions` | `{ kind: "shared", shardId }`                                                          |
| `ChatSessions`   | `{ kind: "codegen", shardId }`                                                         |

A **hybrid seam** (Charlie #2): the kind gate is a single chokepoint at `cf-serve` dispatch; the identity gate runs in handler logic where the canonical target is known.

1. **Kind check (dispatch)** — evaluate the policy for `req.type`: a static set, or for mode-sensitive ops the predicate over `req.mode`. Assert `conn.kind` is in the result. This is the runtime twin of the browser compile gate and covers non-TS callers (CLI, srv-sandbox), and it closes Codex P1 — `open-chat {mode:"codegen"}` arriving on a `vibe` shard fails here even though `open-chat` is otherwise allowed on vibe.
2. **Identity assert (post-resolution, vibe-keyed handlers)** — assert `` `${ownerHandle}--${appSlug}` === conn.shardId `` **before any D1 write or broadcast**. For doc ops the pair is the raw `req.ownerHandle/appSlug`; for chat ops it is the **resolved** canonical pair discovered during resolution (`ensureApplicationChatId` / `getResChatFromMode`), per Charlie #3 — raw chat req fields can be partial.

This is the concrete defense against the issue's silent split-brain: a `putDoc` whose target is vibe B, arriving on a DO sharded for vibe A, would otherwise pass access-fn, persist to D1, broadcast to A's sockets (not B's), and return `ok`. The assert makes it fail loud.

**Fail-loud mechanism (Codex P2):** the gate **sends** a coded `ResError` (`code: "wrong-shard"` / `"wrong-shard-kind"`) on the request's `tid` and **stops dispatch** — it does _not_ throw. A bare throw escaping `wsEvento.trigger` is caught in `cf-serve.ts` and rewritten to `code:"internal-error"` (and the Evento error handlers build `res-error` with no code), so a thrown gate error would never surface the specific code to clients or the planned tests. Reads (`getDoc`/`queryDocs`) also assert — a wrong-shard read is always a client bug — but the never-persist/never-broadcast guarantee is the load-bearing part for writes and the `subscribe*` fan-out.

## Testing (TDD-first)

- **Type tests** (kind half): `@ts-expect-error` / `expectTypeOf` fixtures — `putDoc` absent on `Conn<"shared">` and `Conn<"codegen">`, present on `Conn<"vibe">`; a shared read present on all three; `open-chat` present on codegen + vibe, absent on shared; **`Conn<"vibe">.openChat({mode:"codegen"})` is a compile error** while `{mode:"img"}` type-checks (Codex P1, compile half).
- **Parity tests** (extend #2715's): every handler hash ↔ exactly one reqType ↔ one `SHARD_POLICY` entry; `handlersForShard(kind)` equals the policy-derived expectation; manifest ordering preserved. Plus: every `VibesDiyApiIface` method resolves to a concrete `MethodReqType` (catches un-normalized outliers).
- **Runtime gate tests** (the regression that matters): drive `appMsgEvento` with a `put-doc` whose `owner--slug` ≠ the DO's `shardId` → expect a **sent** `res-error{code:"wrong-shard"}` **and assert no D1 row was written and no broadcast was emitted** (split-brain regression). Add: `open-chat {mode:"codegen"}` against a `vibe`-kind ctx → sent `res-error{code:"wrong-shard-kind"}` (mode-isolation regression, Codex P1), and a plain kind-mismatch (doc op against a shared-kind ctx). Assert the **code is preserved** on the wire (Codex P2 — guards against the `internal-error` rewrite). Per rules-bag: no mocking — use the existing api-test harness that exercises the real evento dispatch.

## Out of scope (→ Spec B)

- `wrangler.toml` / DO-class changes; `find_additional_modules` lazy-load of QuickJS + streaming.
- Collapsing 3 DO classes → 1 (or 2 if codegen stays isolated for blast-radius).
- Re-homing `forkApp`/`setModeFsId` to `shared` (cheap follow-up once a caller benefits — one-line `SHARD_POLICY` widen, made safe by this spec's gate).
- Open questions deferred to Spec B: codegen-isolated-vs-monolithic, singleton hot-shard contention, DO-hibernation re-running global scope.

## Why this ordering is safe

Spec A changes no topology — every DO serves the same handler set it does today (guaranteed by the parity tests carried from #2715). It only _adds_ a compile-time gate (browser) and a runtime gate (worker) around the existing dispatch. That makes the later physical collapse (Spec B) a migration whose correctness is already fenced: by the time a handler can run on a different shard, the identity gate already guarantees it can't quietly serve the wrong one.

## References

- `vibes.diy/api/svc/evento-handler-manifest.ts` — #2715 declarative manifest (this spec lifts `allowed` → `api-types`)
- `vibes.diy/api/types/app-documents.ts` — doc-op requests carry `ownerHandle`/`appSlug` (the identity-gate target)
- `vibes.diy/pkg/workers/app-sessions.ts` — `this.vibeKey` from `?vibe=` (the shard identity)
- `vibes.diy/pkg/app/vibes-diy-provider.tsx` — the three connection vars to brand
- `vibes.diy/api/svc/cf-serve.ts` — dispatch + per-tid error path (where the gate + fail-loud live)
- `agents/do-session-split.md` — architecture + remaining plan
