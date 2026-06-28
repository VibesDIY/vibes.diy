# DO Physical Collapse — Implementation & Migration Plan (#2714 Spec B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Physically collapse the three session DO classes (`ChatSessions`/`AppSessions`/`SharedSessions`) into one shard-keyed surface — behavior-identical — by first making the heavy capability modules (QuickJS) lazy so a lean shared/read shard never parses them, then introducing a unified class, draining the old ones, and GC-ing them last. Spec A's runtime kind+identity gate already fences correctness, so this is a pure infra/migration job.

**Architecture:** Staged. **Phase A** (committed) lazy-loads QuickJS via dynamic `import()` + a bundler config that keeps it out of the worker entry chunk, with a build-output gate proving the lean path. **Phase B** is a decision checkpoint (3→1 vs 3→2, gated on Phase A data + the cli-topology partition). **Phase C** adds the unified class (`new_classes`) and repoints routing. **Phase D** drains + verifies via `wrangler tail`. **Phase E** GCs the old classes (`deleted_classes`, conservative, cli-first for the cross-script Case A pair). Behavior must stay identical through A, C, D.

**Tech Stack:** TypeScript (strict, rules-bag: no `any`, no `export default` in lib code, `Result` not throw, no mocking), `@cf-wasm/quickjs`, Vite + `@cloudflare/vite-plugin` (Rollup worker bundling), wrangler, `@adviser/cement`, vitest, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-06-28-do-physical-collapse-design.md`.

**Branch:** `claude/spec-b-do-collapse-wae5u7`.

**Verification gates (learned on Spec A):**

- Canonical typecheck is **repo-root `pnpm run build`** (core-cli tsc/tsgo), NOT the looser pkg vite build.
- Run full **`pnpm check`** (format + build + test + lint) before claiming done; CI's `compile_test` runs the whole suite.
- Migration guardrail: `cd vibes.diy/pkg && pnpm vitest run wrangler-migrations.test.ts` on every migration PR.
- pkg/app browser tests are unrunnable in cloud/agent envs (#2756) — browser-side changes are flagged to require CI confirmation.
- `pnpm run rules-bag:constructors` must pass.

---

## File Structure

**Phase A — Modify:**

- `vibes.diy/api/svc/cf-serve.ts` — top-level `@cf-wasm/quickjs` value import → dynamic `import()` inside `localInvokeAccessFn`; keep `import type` for `QuickJSWASMModule`.
- `vibes.diy/pkg/vite.config.ts` and/or `vibes.diy/pkg/wrangler.toml` — bundler config so QuickJS emits as a separate lazy chunk (exact lever determined empirically — see Task A2).

**Phase A — Create:**

- `vibes.diy/pkg/test/worker-bundle-lazy-quickjs.test.ts` — build-output gate: entry chunk excludes QuickJS/wasm, a lazy chunk includes it.

**Phase C — Modify (after Phase B decides class count):**

- `vibes.diy/pkg/wrangler.toml` — append `new_classes` migration(s) for the unified class in all six env blocks; binding(s) for the unified class.
- `vibes.diy/pkg/workers/app.ts` — repoint `app-api`/`shared-do`/`api-do` routes to the unified binding(s), same shard keys.
- `vibes.diy/pkg/workers/<unified-sessions>.ts` — the unified DO class (kind+identity injection per route/key).
- `vibes.diy/pkg/workers/route-decision.ts` — unchanged routes (already returns the three); a routing test asserts each reaches the unified binding.

**Phase E — Modify (separate, later PRs):**

- `vibes.diy/pkg/wrangler.toml` — cli unbind (PR 1), then `deleted_classes` (PR 2) for the Case A pair; single PR for the Case B local class.
- `vibes.diy/pkg/workers/*` — remove the retired class source/exports once their bindings are gone.

---

## Phase A — Lazy-load QuickJS (committed; no DO migration)

> **✅ SHIPPED (this PR).** A1 (dynamic import in `cf-serve.ts`, all 88 access-fn tests green), A2 (build-output gate `vibes.diy/pkg/test/worker-bundle-lazy-quickjs.test.ts`), A3 (shared-DO-wires-no-invoker invariant). **Empirical lever result:** the bare dynamic `import()` already code-splits QuickJS out of the entry chunk under Vite + `@cloudflare/vite-plugin` — **escalation-ladder rung 1 sufficed; no `manualChunks` / `find_additional_modules` needed.** Entry chunk has no QuickJS glue (`_QTS_`/`RELEASE_SYNC` absent); glue + the 503 kB `RELEASE_SYNC-*.wasm` are in separate lazy chunks. → Phase B input: startup-cost no longer constrains the class-count choice; the only residual 3→2 tilt is the cli cross-script topology.

### Task A1: Dynamic-import QuickJS at the call site

**Files:**

- Modify: `vibes.diy/api/svc/cf-serve.ts`

- [ ] **Step 1: Write the failing test** (build-output gate — created fully in A2, but author the assertion first as the contract)

The contract: after a worker build, the entry chunk must not contain the QuickJS module text/wasm. (This test cannot pass until both A1 and A2 land; it is the Phase A acceptance gate.)

- [ ] **Step 2: Convert the import**

In `cf-serve.ts`, replace the top-level value import (line 26):

```ts
// before
import { getQuickJSWASMModule, type QuickJSWASMModule } from "@cf-wasm/quickjs";
// after
import type { QuickJSWASMModule } from "@cf-wasm/quickjs"; // type-only, erased
```

At the call site inside `localInvokeAccessFn` (line ~260), load the module dynamically:

```ts
const { getQuickJSWASMModule } = await import("@cf-wasm/quickjs");
const QuickJS = cachedModuleRef.module ?? (await getQuickJSWASMModule());
cachedModuleRef.module = QuickJS;
```

> The existing per-DO `cachedModuleRef.module` cache means the dynamic `import()` + WASM instantiation still happens at most once per DO instance — A1 only defers _when_ the module is parsed (first access-fn eval) instead of at top-level module load. No behavior change for a vibe/codegen shard that does evaluate access fns; the win is that a shared shard that never evaluates one never parses QuickJS.

- [ ] **Step 3: Typecheck**

Run: `pnpm run build` (repo root — the canonical gate)
Expected: PASS. (`import type` is erased; the dynamic import is well-typed.)

- [ ] **Step 4: Confirm access-fn behavior is unchanged**

Run: `cd vibes.diy/api/tests && npx vitest --run access-fn`
Expected: PASS — the existing access-fn unit/integration tests still pass (QuickJS now loaded via dynamic import, same result).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/cf-serve.ts
git commit -m "perf(api-svc): lazy dynamic-import QuickJS at the access-fn call site (#2714)"
```

### Task A2: Keep QuickJS out of the worker entry chunk + build-output gate

**Files:**

- Modify: `vibes.diy/pkg/vite.config.ts` and/or `vibes.diy/pkg/wrangler.toml`
- Create: `vibes.diy/pkg/test/worker-bundle-lazy-quickjs.test.ts`

- [ ] **Step 1: Determine the actual bundler lever (empirical — this is the deferred-decision data)**

The worker is bundled by **Vite + `@cloudflare/vite-plugin`** (Rollup), not raw wrangler/esbuild — so `find_additional_modules` + `rules` (the esbuild mechanism named in `do-session-split.md`) likely does **not** govern this build. Build the worker after A1 and inspect the chunk graph:

Run: `cd vibes.diy/pkg && CLOUDFLARE_ENV=local pnpm exec react-router build` (then inspect `build/` / `dist/stats.html` from the `visualizer` plugin)

Establish empirically whether the bare `import()` already code-splits QuickJS into its own chunk (Rollup's default for dynamic import), or whether `@cloudflare/vite-plugin` re-inlines it (the documented gotcha). If re-inlined, apply the smallest effective lever in this order and re-check after each:

1. nothing beyond A1 (Rollup default dynamic-import splitting);
2. `build.rollupOptions.output.manualChunks` isolating `@cf-wasm/quickjs`;
3. the plugin's wasm/module handling (consult `@cloudflare/vite-plugin` docs for the worker target);
4. only if the plugin defers to wrangler bundling, the wrangler `find_additional_modules` + `rules` path.

Record which lever worked — that result is the primary input to the Phase B class-count decision.

- [ ] **Step 2: Write the build-output gate test**

```ts
// vibes.diy/pkg/test/worker-bundle-lazy-quickjs.test.ts
// After a worker build, assert the ENTRY chunk excludes QuickJS/wasm and a
// separate lazy chunk includes it. Read the built worker output from disk (no
// mocking — the real bundle). Use a marker unique to the QuickJS module (e.g.
// a @cf-wasm/quickjs export name or the .wasm asset reference) to detect it.
```

The test builds (or reads a pre-built) worker bundle and:

- asserts the entrypoint chunk does **not** reference the QuickJS module / `.wasm` asset;
- asserts some **other** chunk does (proving it's split out, not dropped).

- [ ] **Step 3: Run it to verify it fails (if the default re-inlines) or passes (if default splits)**

Run: `cd vibes.diy/pkg && pnpm vitest run worker-bundle-lazy-quickjs`
Expected: depends on Step 1 — drive the config until the entry chunk is QuickJS-free and the test is green.

- [ ] **Step 4: Apply the determined config + re-run to green**

Apply the lever from Step 1 to `vite.config.ts`/`wrangler.toml`. Re-run the gate test until PASS.

- [ ] **Step 5: Full build + check**

Run: `pnpm run build && cd vibes.diy/pkg && pnpm vitest run worker-bundle-lazy-quickjs wrangler-migrations`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/pkg/vite.config.ts vibes.diy/pkg/wrangler.toml vibes.diy/pkg/test/worker-bundle-lazy-quickjs.test.ts
git commit -m "build(pkg): split QuickJS into a lazy chunk; gate the worker entry stays lean (#2714)"
```

### Task A3: Corroborate the lean shared path (runtime)

**Files:**

- (assertion only) `vibes.diy/api/tests/` — extend an existing shared-plane test

- [ ] **Step 1: Assert the shared plane never reaches the access-fn invoker**

`SHARD_POLICY` already pins doc/access ops to `["vibe"]` (never `["shared"]`), and the Spec A parity test enforces it. Make the lazy-load implication explicit: drive `sharedMsgEvento` with the shared handler set and assert no path calls `invokeAccessFn` (SharedSessions passes no `invokeAccessFn` override — `shared-sessions.ts:145` — so a shared instance has no invoker and the dynamic import is never triggered). No mocking — use the real shared evento dispatch harness.

- [ ] **Step 2: Run + commit**

```bash
cd vibes.diy/api/tests && npx vitest --run shared
git add -A && git commit -m "test(api): shared plane never invokes the lazy access-fn (#2714)" || true
```

- [ ] **Step 3: Optional empirical number (non-blocking)**

If a dev/preview deploy is available, capture a `wrangler tail` cold-wake timing on a shared-only instance to attach a concrete millisecond figure to the avoided QuickJS parse. Record it in the spec's gating-measurement section. Do **not** deploy prod for this.

**→ Phase A acceptance:** build-output gate green (entry chunk QuickJS-free) + access-fn tests green + shared-plane no-invoker test green. This is the data that gates Phase B.

---

## Phase B — Class-count decision checkpoint (no code)

- [ ] **Step 1: Reconvene with jchris on 3→1 vs 3→2**, presenting:
  - the Phase A build-output result (did the lean entry chunk hold reliably, or did the bundler fight re-inlining?);
  - the cli cross-script topology partition ({vibe, shared} cross-script→prod vs {codegen} local-on-cli) — a monolithic single class collides with it; 3→2 aligns.
- [ ] **Step 2: Record the decision** in the spec's Decisions table and proceed to Phase C with the chosen class count.

> Default tilt (confirm, don't assume): **3→2** — unify `AppSessions`+`SharedSessions`, keep `ChatSessions` (codegen) standalone. The tasks below are written for either outcome; only the count of `new_classes`/`deleted_classes` and the cli binding shape differ.

---

## Phase C — Unified class + routing (`new_classes` migration; behavior-preserving)

### Task C1: Add the unified DO class

**Files:**

- Create: `vibes.diy/pkg/workers/<unified-sessions>.ts`

- [ ] **Step 1: Write the failing test** — a routing/identity test that the unified class injects `{kind, shardId}` matching the key it was opened with (mirror `app-sessions.ts:173` / `chat-sessions.ts:201` / `shared-sessions.ts:151`). The class composes the same per-plane callbacks (broadcast for vibe, user-notify per plane, local QuickJS invoker for vibe/codegen, none for shared) keyed off the inferred kind.

- [ ] **Step 2: Run to verify it fails** — class not created.

- [ ] **Step 3: Implement the unified class** — fold the three `fetch()` bodies into one, branching the callback wiring on the shard kind (derived from route/key). Reuse `localBroadcastCallbacks`, `userNotifyCallbacksFor*`, `localInvokeAccessFn` unchanged. Inject the correct `ShardIdentity`. No new behavior — same handler surface, same Spec A gate.

- [ ] **Step 4: Run to verify it passes.**

- [ ] **Step 5: Commit.**

```bash
git commit -m "feat(pkg): unified session DO class (kind-keyed; behavior-preserving) (#2714)"
```

### Task C2: `new_classes` migration in all env blocks

**Files:**

- Modify: `vibes.diy/pkg/wrangler.toml`

- [ ] **Step 1: Append the migration** — next sequential tag per env (`v9`; add `v10` if 3→2 introduces a second new class). **Append-only** — never touch v1..v8.
  - Add the unified binding(s) to each env's `durable_objects.bindings`.
  - **cli cross-script shape:** if the unified (vibe+shared) class is cross-script→prod, cli binds it with `script_name = "vibes-diy-v2-prod"` and its `new_classes` follows the prod-before-cli order (like `APP_SESSIONS`/`SHARED_SESSIONS`/`v8`). A standalone codegen class stays local-on-cli (no `script_name`).

- [ ] **Step 2: Run the migration guardrail**

Run: `cd vibes.diy/pkg && pnpm vitest run wrangler-migrations.test.ts`
Expected: PASS (per-env `v1..vN`, no gaps).

- [ ] **Step 3: Commit.**

```bash
git commit -m "feat(pkg): add unified session DO class via new_classes migration (#2714)"
```

### Task C3: Repoint routing to the unified binding(s)

**Files:**

- Modify: `vibes.diy/pkg/workers/app.ts`

- [ ] **Step 1: Write the failing routing test** — assert `app-api` → unified binding with key `?vibe=owner--slug`; `shared-do` → unified binding with `idFromName("global")`; `api-do` → unified binding with per-stream UUID (or, if 3→2, the standalone codegen binding). Keep `route-decision.ts` returning the same three route names.

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Repoint** the three `env.X_SESSIONS.idFromName(...)` calls in `app.ts:121-136` to the unified binding(s), preserving the exact shard keys.

- [ ] **Step 4: Run to verify it passes** + the Spec A `shard-gate` regression stays green (wrong-shard → coded `ResError`, no write/no broadcast).

Run: `cd vibes.diy/api/tests && npx vitest --run shard-gate evento-handler-parity shard-policy-parity`

- [ ] **Step 5: Commit.**

```bash
git commit -m "feat(pkg): route the three planes to the unified session class (#2714)"
```

### Task C4: Full check + browser-test flag

- [ ] **Step 1:** `pnpm run rules-bag:constructors && pnpm build && pnpm lint && cd vibes.diy/api/tests && npx vitest --run`
- [ ] **Step 2:** If any browser-side connection/routing code changed, update `vibes.diy/tests/app` and flag in the PR that it needs CI to confirm (#2756). The browser `Conn<K>` branding from Spec A is unchanged — the unified class is a worker-side change.

> **Deploy note (Phase C):** this is a `new_classes` + routing deploy. Deploy **prod before cli** for the cross-script unified class (cli's cross-script binding needs the prod class to exist first — same 10061 ordering as `APP_SESSIONS`/`v8`). Behavior-preserving; rollback = re-route to the old classes (still present). Never tag prod without explicit human confirmation in the same exchange (`agents/deploy-tags.md`).

---

## Phase D — Drain + verify (no code; operational)

- [ ] **Step 1: Confirm zero traffic to the old classes.** After Phase C is live, `wrangler tail` (dev → prod) and confirm no invocations of `ChatSessions`/`AppSessions`/`SharedSessions` over a sustained window (the conservative coexistence window from the locked GC decision).
- [ ] **Step 2: Re-confirm the storage-free prereq** still holds (no DO storage added to the old classes since this plan was written) — `grep` the three classes for `state.storage`/`blockConcurrencyWhile`/`deserializeAttachment`; expect none. If any appeared, migrate state via `transferred_classes` before Phase E.
- [ ] **Step 3: Record the drain evidence** (tail output summary) in the Phase E GC PR description.

---

## Phase E — The GC (`deleted_classes`; conservative, last, cli-first for Case A)

> **Only after Phase D shows sustained zero-traffic.** `deleted_classes` is irreversible and destroys all instances/state. Each delete is gated on a prior deploy that removed the last code reference. Separate PRs, not folded into Phase C/D.

### Task E1 (Case A — `AppSessions` + `SharedSessions`, or the unified cross-script class they became): cli unbind FIRST

**Files:** `vibes.diy/pkg/wrangler.toml`, `vibes.diy/pkg/workers/*`

- [ ] **Step 1 (PR 1 — cli unbind, deploys FIRST):** drop the cross-script `APP_SESSIONS`/`SHARED_SESSIONS` bindings from `env.cli`. Now nothing external references prod's classes.
- [ ] **Step 2:** migration guardrail + `pnpm check`; deploy cli; confirm live.
- [ ] **Step 3 (PR 2 — prod delete, deploys AFTER cli is live):** remove the remaining non-cli bindings and append `deleted_classes = [...]` in **all** env blocks (cli included — it still needs its own `deleted_classes` for its now-dormant local registry entries once the source is removed). Remove the retired class source/exports.
- [ ] **Step 4:** migration guardrail + `pnpm check`.
- [ ] **Step 5:** **Call out the reversed (cli-first) order in the PR.** Precedent: `DocNotify` #2297→#2298.

### Task E2 (Case B — `ChatSessions`, if 3→1; if 3→2 codegen is renamed/kept instead): single PR

**Files:** `vibes.diy/pkg/wrangler.toml`, `vibes.diy/pkg/workers/*`

- [ ] **Step 1:** drop the local `CHAT_SESSIONS` binding + append `deleted_classes = ["ChatSessions"]` in all env blocks; remove source/exports. (Local on cli → no 10061; standard order, like `AccessFnDO`/`v7`.)
- [ ] **Step 2:** migration guardrail + `pnpm check`.
- [ ] **If 3→2:** do **not** delete codegen — if the class is merely renamed, use `renamed_classes` (preserves identity); if kept as-is, no migration.

### Task E3: Deploy-tag checklist (per `agents/deploy-tags.md`)

- [ ] Before recommending **any** prod/`ship@` tag, articulate: rollback path, verify steps, `wrangler tail` success-shape, and confirm the cli-first ordering for Case A. **Never tag prod without explicit human confirmation in the same exchange.**

---

## Phase F — Docs + blog seed

- [ ] **Step 1:** Update `agents/do-session-split.md` — mark Spec B steps as they ship; record the final class count (3→1 or 3→2) and the lazy-load mechanism that worked.
- [ ] **Step 2:** Blog seed under `notes/blog-seeds/` — hook: "the cheap always-warm read shard is a bundler problem, not a DO problem"; the hibernation/cold-isolate finding; the Vite-not-esbuild lazy-load gotcha; the cli-first GC reversal.
- [ ] **Step 3:** Commit.

---

## Self-Review

**Spec coverage:** ✅ gating measurement (resolved: cold-isolate wake re-runs global scope; 1s budget; lazy-load load-bearing) · Phase A lazy-load + build-output gate (the committed first unit) · Phase B decision checkpoint (3→1 vs 3→2, gated on A data + cli-topology) · Phase C unified class + `new_classes` + routing (behavior-preserving) · Phase D drain + storage-free re-confirm · Phase E conservative cli-first GC (`deleted_classes`, Case A reversed order, Case B trivial) · Phase F docs/blog.

**Decisions honored:** defer class-count (Phase B is an explicit checkpoint, not pre-committed) · singleton shared `"global"` with reshard-later noted out-of-scope · conservative GC last with generous coexistence window.

**Footgun coverage:** 10074 (append-only — every migration is a new tag, v1..v8 untouched) · 10061 (Case A cli-first ordering called out in E1) · irreversible `deleted_classes` (gated on drain + last) · no-prod-tag-without-confirmation (E3) · rules-bag (`rules-bag:constructors` in every check) · canonical `pnpm build` typecheck gate · #2756 browser-test caveat (C4).

**Highest-uncertainty step:** Task A2 (the bundler lever to keep QuickJS out of the entry chunk under Vite + `@cloudflare/vite-plugin`). It is deliberately empirical with a build-output gate as the contract and a documented escalation ladder — and its result is the data that gates the Phase B class-count decision, which is exactly why that decision was deferred.
