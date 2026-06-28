# DO Physical Collapse — Design (#2714 Spec B)

**Status:** design, pre-implementation
**Issue:** [#2714](https://github.com/VibesDIY/vibes.diy/issues/2714) (declarative shard-keyed API)
**Predecessor (shipped):** Spec A — shard-kind enforcement layer ([#2722](https://github.com/VibesDIY/vibes.diy/pull/2722), [#2758](https://github.com/VibesDIY/vibes.diy/pull/2758)). `SHARD_POLICY` source of truth in `@vibes.diy/api-types`, manifest derives placement from it, fail-loud runtime kind+identity gate at dispatch, branded `Conn<K>` browser connections.
**Architecture doc:** [`agents/do-session-split.md`](../../../agents/do-session-split.md) § "Remaining — Spec B"
**Migration runbook:** [`agents/do-migrations.md`](../../../agents/do-migrations.md)

## Summary

Spec A hardened the **current** 3-DO topology so that a handler running on the wrong shard fails loud — a coded `ResError`, never persist-and-go-quiet. That makes Spec B a pure infra/migration job: the three client connections (`chatApi`/`vibeApi`/`sharedApi`) and three DO classes (`ChatSessions`/`AppSessions`/`SharedSessions`) are the **same handler surface opened against a different shard key**, and Spec A already guarantees a handler can't quietly serve the wrong one. Spec B physically collapses them.

The whole collapse hinges on one measured fact (the gating measurement below): **a lean shared/read shard must be able to wake cheaply, which means it must never parse the heavy capability modules (QuickJS, streaming).** Today QuickJS is a static top-level `import` in `cf-serve.ts`, parsed by every DO including the lean shared one. So the **committed first unit of Spec B is the lazy-load** — convert QuickJS to a dynamic `import()` and keep it out of the worker entry chunk. The class-count collapse (3→1 vs 3→2) is **deferred behind that prototype** (decision below) because the lazy-load's verifiability is exactly what de-risks one choice over the other.

## The gating measurement — does a DO re-run global scope on wake?

**Question (from the issue):** does a Durable Object re-run global (top-level module) scope on wake from hibernation? A woken lean instance re-paying the QuickJS parse would negate the "cheap always-warm read shard."

**Answer: global scope re-runs only on a _cold-isolate_ wake — and a hibernation wake is NOT guaranteed to land in a warm isolate. In the worst case (and, after sustained idle, the _likely_ case), yes: global scope re-runs and a woken lean shard re-parses the entrypoint module graph, including a static QuickJS import.**

| Layer                                                            | When it runs                                                                                                                                                  | Source                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Constructor** (per-DO-instance)                                | **Every** wake from hibernation                                                                                                                               | DO lifecycle docs: the `constructor()` runs again on wake                      |
| **Global / top-level module scope** (static imports, parse+eval) | **Once per isolate**, at isolate cold start — re-runs **only when the isolate is recreated**                                                                  | Startup-limit changelog: the budget is "to parse and execute its global scope" |
| **Isolate lifetime**                                             | Independent of DO hibernation; isolates "may be spun down and evicted for a number of reasons"; **no guarantee** the isolate stays warm while a DO hibernates | "How Workers works" / "Rules of Durable Objects"                               |

- **The startup budget is 1 second** (raised from 400 ms on 2025-10-10) of global-scope parse+execute — exactly the "1 s startup budget" the issue cites. It is re-spent on every cold-isolate wake.
- Hibernation is triggered by sustained inactivity — the same condition that makes isolate eviction _likely_. So a hibernated shared/read DO that wakes after an idle window will frequently wake into a **fresh** isolate and re-execute top-level scope.
- **In-repo corroboration that the budget is live:** `vibes.diy/pkg/workers/app.ts:40` already lazy-initializes `createRequestHandler` with the comment _"Lazy-initialize to avoid exceeding CF Worker startup CPU limit (error 10021)… running it at module level counts against the startup CPU budget before the first fetch handler is even registered."_ The team already engineers around this exact limit.

**Conclusion — the lazy-load is load-bearing, not optional.** With QuickJS as a static top-level import, a cold-isolate wake of the lean shared shard re-parses QuickJS even though it will never evaluate an access fn. The premise in `do-session-split.md` is confirmed real. Therefore: lazy-load QuickJS so the entrypoint graph stays lean, and the lean read shard never pays the parse regardless of cold/warm wake.

**How this gates the class-count decision.** With lazy-load in place, a shared-keyed instance — whether a separate class _or_ the unified class opened with `kind:"shared"` — only ever runs the lean path and never triggers the dynamic import, so it never parses QuickJS regardless of wake state. That removes the _startup-cost_ objection to going fully monolithic (3→1). The residual argument for keeping codegen isolated (3→2) becomes purely **operational** (blast-radius/contention) plus the **cli cross-script topology constraint** below — not a startup-cost argument. Either way Spec A's gate fences correctness.

> **Empirical follow-up (cheap, not blocking the decision):** the mechanism is settled by the runtime model and in-repo precedent; a `wrangler tail` cold-wake timing on a shared-only instance can attach a concrete millisecond number to the QuickJS parse specifically, and is folded into the Phase A verification rather than gating this design.

> **Phase A result (PR — Phase A shipped).** Building the worker after the dynamic-import change confirms the bare `import()` **already code-splits QuickJS out of the entry chunk** under Vite + `@cloudflare/vite-plugin` — the entry carries no QuickJS glue (`_QTS_`/`RELEASE_SYNC` absent), only the `import()` reference to a lazy `workerd-*.js` chunk; the glue + the 503 kB `RELEASE_SYNC-*.wasm` live in separate chunks. **No `manualChunks` or `find_additional_modules` was needed (escalation-ladder rung 1 sufficed).** So the always-warm-read-shard property holds with zero extra config — which means the startup-cost axis no longer constrains the Phase B choice, and **3→1 is tenable on that axis.** The residual 3→2 tilt is now purely the cli cross-script topology constraint below.

Sources: [Worker startup time limit increased to 1 second](https://developers.cloudflare.com/changelog/post/2025-10-10-increased-startup-time/) · [Lifecycle of a Durable Object](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/) · [How Workers works](https://developers.cloudflare.com/workers/reference/how-workers-works/) · [Rules of Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)

## Decisions (locked in brainstorm with jchris)

| Decision                              | Choice                                                                                                                 | Rationale                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Class-count collapse (3→1 vs 3→2)** | **3→1, fully monolithic** (decided after Phase A) — one class `Sessions`, two handles (`SESSIONS`, `CODEGEN_SESSIONS`) | Phase A removed the startup-cost objection (lean entry holds, zero config). The 3→2 resource-isolation case was retracted (class boundaries aren't a Cloudflare-guaranteed isolation unit; per-instance limits already isolate a runaway stream). The cli same-name local+cross-script binding wrangler-validates cleanly; the remote validator is caught safely at the reversible cli deploy. No behavior change. |
| **Shared-plane keying**               | **Singleton `"global"` now, reshard later if needed**                                                                  | The shared plane is stateless reads, so re-keying to `global:0..k` later is a **routing change, not a DO-class migration** — contention is cheap to fix in place. Simplest; one shard to keep warm. Matches today's `shared-do` route (`idFromName("global")`).                                                                                                                                                    |
| **GC sequencing**                     | **Conservative — GC last, after sustained zero-traffic, in its own cli-first deploy(s)**                               | `deleted_classes` is irreversible. The only rollback for the route/drain steps is "re-route to the still-existing old classes," which requires NOT having GC'd them. Keep a generous coexistence window. Matches `do-session-split.md`: "don't fold the GC into the step 2/3 deploys."                                                                                                                             |

### Input to the deferred class-count decision (record now, decide in Phase B)

Two facts discovered while grounding this design should jointly inform 3→1 vs 3→2 once Phase A data is in:

1. **The lazy-load verification result (Phase A).** If a built worker reliably keeps QuickJS in a separate lazy chunk and a shared-only request path provably never triggers the dynamic import, the always-warm-read-shard property holds under a single monolithic class → 3→1 becomes tenable. If the bundler keeps re-inlining QuickJS (the documented gotcha, see "Lazy-load mechanism" risk below), keeping codegen isolated (3→2) limits the heavy-parse blast radius to the codegen class only.
2. **The cli cross-script topology partitions cleanly into 2, not 1.** `wrangler.toml` `env.cli` cross-script-binds `APP_SESSIONS` + `SHARED_SESSIONS` (+ `USER_NOTIFY`) to `vibes-diy-v2-prod` (shared prod data plane), while `CHAT_SESSIONS` is **local on cli** (per-env fan-out / scale isolation / "future divergence anchor for cli-specific prompts/rate-limits/auth"). So the planes naturally split: **{vibe, shared} = cross-script→prod** and **{codegen} = local-on-cli**. A _single_ monolithic class collides with this: cli would have to either route its codegen onto prod's class (losing the intentional per-env codegen isolation) or pull vibe/shared local on cli (losing the shared prod data plane). **3→2 (unify vibe+shared, keep codegen separate) aligns with the existing cli topology and the `codegen` shard's stated reason to exist** (heavy stream isolation, per Spec A's "codegen" naming). This is a real tilt toward 3→2 — but per the locked decision it is recorded as input, not a re-litigation; Phase B makes the call with the Phase A data plus this constraint in hand.

## Architecture — staged

Spec B is a sequence of independently-deployable, behavior-preserving steps. Behavior must stay identical through Phases A, C, and D; the collapse is infra, and Spec A's gate already enforces correctness.

### Phase A — Lazy-load the heavy capability modules (committed; no DO migration)

The single load-bearing change, and the gate for everything after it.

- **A1 — dynamic import at the call site.** `cf-serve.ts` currently has `import { getQuickJSWASMModule, type QuickJSWASMModule } from "@cf-wasm/quickjs"` at top level (line 26). Convert the **value** import (`getQuickJSWASMModule`) to a dynamic `import()` evaluated inside `localInvokeAccessFn` (the only call site, line 260). The **type** import (`QuickJSWASMModule`) stays as `import type` — type-only, fully erased, zero runtime cost (the DO files already import it as `import type`). The existing WASM _instantiation_ is already lazy; A1 makes the _module import_ lazy too.
- **A2 — keep QuickJS out of the entry chunk.** The bundler must emit QuickJS as a **separate lazy chunk**, not inline it back into the worker entry. **Mechanism is build-pipeline-specific and must be confirmed empirically (this is why the decision is deferred):**
  - This repo bundles the worker with **Vite + `@cloudflare/vite-plugin`** (`vite.config.ts` → `cloudflare({ configPath: "wrangler.toml" })`; `react-router build` runs Vite, `wrangler deploy` ships the output). The bundler is **Rollup**, not raw wrangler/esbuild.
  - Therefore the architecture doc's `find_additional_modules` + `rules` guidance is the **wrangler/esbuild** mechanism and likely does **not** govern this build. The Rollup-side levers are dynamic-import code-splitting (default for `import()`), `build.rollupOptions.output.manualChunks`, and however `@cloudflare/vite-plugin` handles `.wasm` modules for the worker target. The prototype determines which lever actually keeps QuickJS out of the entry chunk; the spec does not pre-commit to one.
  - The documented gotcha — the bundler re-inlining a dynamically-imported module back into the entrypoint — is the specific failure A2's verification must catch.
- **A3 — verification (the data that gates Phase B).** Two layers:
  - **Build-time (the hard gate):** after a worker build, assert the **entry chunk does not contain QuickJS/wasm**, and that a **separate chunk does**. This is a deterministic, CI-able check (inspect the built bundle / chunk graph) and is the primary evidence that "a shared-reads-only instance never parses QuickJS."
  - **Runtime (corroboration):** a shared/reads-only request path never triggers the dynamic `import()` (no access-fn eval on the shared plane — confirmed by `SHARD_POLICY`: doc/access ops are `["vibe"]`, never `["shared"]`); optionally a `wrangler tail` cold-wake timing on a shared-only instance to attach a concrete number.

### Phase B — Class-count decision (gated on Phase A)

Not code — a decision checkpoint. Reconvene with jchris on **3→1 vs 3→2** using the Phase A verification result plus the cli-topology partition recorded above. Default tilt (to be confirmed): **3→2**, unify `AppSessions`+`SharedSessions` into one cross-script-to-prod class, keep `ChatSessions` (codegen) local-on-cli and isolated. The rest of this design is written to work for either outcome; only the number of `new_classes`/`deleted_classes` and the cli binding shape differ.

### Phase C — Introduce the unified class + route to it (`new_classes` migration)

- Add the unified class (1 or 2 per Phase B) as **append-only** `new_classes` migrations — next sequential tag per env (`v9`, then `v10` if 3→2 adds a second). **Never modify/delete a shipped `[[migrations]]` block (10074).**
- Route the three planes to the unified binding(s). The seam is clean: `route-decision.ts` already returns `app-api` / `shared-do` / `api-do` (a pure, unit-tested function); `app.ts` maps each to `env.APP_SESSIONS` / `env.SHARED_SESSIONS` / `env.CHAT_SESSIONS`. Phase C repoints these to the unified binding(s), keeping the **same shard keys** (`?vibe=owner--slug`, `idFromName("global")`, per-stream UUID) so identity is preserved.
- The unified class injects `{ kind, shardId }` into `appCtx` exactly as the three classes do today (`app-sessions.ts:173`, `chat-sessions.ts:201`, `shared-sessions.ts:151`) — kind derived from which route/key opened it. Spec A's gate then enforces identity unchanged.
- **Behavior-preserving:** every plane serves the same `handlersForShard(kind)` set; the parity tests carried from #2715/Spec A still pin manifest⇄policy 1:1.

### Phase D — Drain the old classes + verify

- Route all traffic to the unified class; confirm via `wrangler tail` that **no instances of `ChatSessions`/`AppSessions`/`SharedSessions` are hit** over a sustained window.
- **Prereq — confirmed by code, not assumed:** none of the three session classes persist anything to DO `storage`. Reading all three in full: the constructor only stashes `env` (the `state`/`_state` param is unused); there is no `state.storage`, no `blockConcurrencyWhile`, no `serializeAttachment`/`deserializeAttachment` anywhere. All state is in-memory and recomputable — `connections: Set<WSSendProvider>`, the lazy `quickjsModule` cache, the per-CID `accessFnSourceCache`. Doc data lives in D1; broadcast is in-memory `this.connections`; access-fn WASM is an in-memory cache. **Retiring the classes strands no durable state**, so no `transferred_classes` step is needed. (If a future change adds DO storage to any of them before the GC, that assumption must be re-checked and the state migrated first.)

### Phase E — The GC (`deleted_classes`, conservative, last, cli-first for Case A)

A distinct, later step with its own deploy runbook, only after Phase D shows sustained zero traffic. Per `do-migrations.md` § "Delete a DO class for real", ordering splits by whether a **cross-script** binding names the class:

- **`AppSessions` + `SharedSessions` — Case A, cli-first (the REVERSE of the usual prod-before-cli).** Both are cross-script-bound cli→prod (`env.cli` bindings carry `script_name = "vibes-diy-v2-prod"`). Prod **cannot** apply `deleted_classes` while the cli binding still names the class — the validator counts `class_name` as a live reference and fails with **10061**. Sequence as two PRs:
  1. **cli unbind deploys FIRST** — drop the cross-script `APP_SESSIONS`/`SHARED_SESSIONS` bindings from `env.cli`. (If 3→2 made the unified class the cross-script binding, cli now points only at the unified class.)
  2. **prod `deleted_classes` deploys AFTER cli is live** — append `deleted_classes` for the retired classes in all env blocks. Precedent: `DocNotify` (#2297 cli-unbind → #2298 delete), **not** `AccessFnDO`. Call out the reversed order in the deploy PR.
- **`ChatSessions` — Case B, trivial.** Local on cli (no `script_name`), so no cross-script 10061 dependency: single PR, drop the binding + `deleted_classes` in all env blocks, standard order (like `AccessFnDO`/`v7`). _(If Phase B chose 3→2 and codegen stays a standalone class, `ChatSessions` is renamed/kept rather than deleted — `renamed_classes` preserves identity if the class is merely renamed.)_
- **`USER_NOTIFY` is out of scope** — cross-vibe notify fan-out, not part of the session collapse. Leave it (also cross-script bound → Case A if ever retired).

Gate every delete on a prior deploy that removed the last code reference. `deleted_classes` is irreversible and destroys all instances/state.

## Why this ordering is safe

- **Spec A fenced correctness first.** By the time a handler can run on a different shard (Phase C), the kind+identity gate already guarantees it can't quietly serve the wrong one. The collapse changes _where code runs_, never _what's allowed to run where_.
- **The lazy-load is verified before any class change.** Phase A's build-time gate proves the lean path before Phase B even decides the class count — the startup-cost risk is measured, not assumed.
- **The GC is irreversible, so it goes last with a generous rollback runway.** Phases C/D roll back by re-routing to the still-existing old classes. Only Phase E deletes, and only after sustained zero-traffic.
- **No shipped migration block is ever modified** — every transition is an append-only new tag, per `do-migrations.md` (10074 trap).

## Testing (TDD-first; detailed in the plan)

- **Phase A:** a build-output assertion (entry chunk excludes QuickJS/wasm; a lazy chunk includes it) as the hard gate; an api-test that the shared/reads path never invokes the access-fn (already implied by `SHARD_POLICY` parity, made explicit). No mocking (rules-bag) — use the real bundle and the real evento dispatch harness.
- **Phase C:** the carried-over parity tests (manifest⇄policy 1:1, `handlersForShard(kind)` per plane) must stay green against the unified class; `route-decision.ts`'s unit test plus a routing test that each plane reaches the unified binding with the correct shard key; the Spec A `shard-gate` regression (wrong-shard → coded `ResError`, no write/no broadcast) must stay green unchanged.
- **Migrations:** the `pkg/test/wrangler-migrations.test.ts` guardrail (per-env `v1..vN` shape, no gaps) on every migration PR.
- **Caveat (#2756):** pkg/app browser tests can't run in cloud/agent envs yet. Any browser-side connection/routing change is verified by updating `vibes.diy/tests/app` and flagged to require CI confirmation; the worker-side and build-output checks are the locally-runnable gates.

## Hard constraints / footguns (carried into the plan)

- `deleted_classes` is irreversible — never delete a class with live instances or undrained traffic, or before the code stops invoking it.
- Cross-script delete ordering is **cli-first** (10061 trap) — get it wrong and the prod deploy fails the validator.
- Never modify/delete a shipped `[[migrations]]` block (10074); transitions are new append-only entries.
- rules-bag applies (no `any`, no `export default` in lib code, `Result` not throw, no mocking); run `pnpm run rules-bag:constructors`.
- The canonical typecheck gate is repo-root `pnpm run build` (core-cli tsc/tsgo), **not** the looser pkg vite build. Run full `pnpm check` before claiming done.
- **NEVER push a prod (`vibes-diy@p*`) or `ship@` tag without explicit human confirmation in the same exchange.** Spec B's prod deploys (esp. the Phase E GC) are user-visible and the GC is not trivially reversible — articulate the rollback/verify/tail/success-shape checklist (`agents/deploy-tags.md`) before recommending any tag.

## Out of scope

- Re-keying the shared plane to `global:0..k` (deferred; a routing change, not a migration — do it only if metrics show contention).
- `/chat/` route deprecation and lazy `chatApi` (a separate item in `do-session-split.md` "Remaining", not part of the physical collapse).
- Retiring `USER_NOTIFY`.
- Re-homing `forkApp`/`setModeFsId` to `shared` (a one-line `SHARD_POLICY` widen, made safe by Spec A's gate — independent follow-up).

## References

- `agents/do-session-split.md` — architecture + the canonical 4-step Spec B plan
- `agents/do-migrations.md` — DO migration runbook (10061 cli-first / 10074 append-only / `renamed_`/`transferred_classes`)
- `docs/superpowers/specs/2026-06-28-do-shard-kind-enforcement-design.md` — Spec A design (precedent + the gate this builds on)
- `vibes.diy/api/svc/cf-serve.ts` — the static QuickJS import (line 26) + `localInvokeAccessFn` call site (line 260)
- `vibes.diy/pkg/workers/{chat,app,shared}-sessions.ts` — the three DO classes (storage-free; identity injection)
- `vibes.diy/pkg/workers/{app.ts,route-decision.ts}` — the routing seam for Phase C
- `vibes.diy/pkg/vite.config.ts` — the Vite + `@cloudflare/vite-plugin` worker bundling (governs the Phase A mechanism)
- `vibes.diy/pkg/wrangler.toml` — current DO bindings/migrations (v1..v8); cli cross-script topology
