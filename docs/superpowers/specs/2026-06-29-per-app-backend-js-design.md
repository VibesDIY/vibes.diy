# Per-app `backend.js` on the shared vibe-execution isolate substrate — design

Tracking issue: [#2856](https://github.com/VibesDIY/vibes.diy/issues/2856). This is the
**informed, canonical replacement for [#2202](https://github.com/VibesDIY/vibes.diy/issues/2202)**:
it keeps #2202's author-facing API verbatim and supplies the execution architecture #2202 left
open, now that the vibe-SSR effort ([#2802](https://github.com/VibesDIY/vibes.diy/issues/2802),
PRs #2823 / #2828 / #2835 / #2843 / #2851) has built and shipped the
"run untrusted vibe code in a Cloudflare isolate" seam.

Author-facing API artifact: [`2026-06-03-firefly-backend-js.html`](./2026-06-03-firefly-backend-js.html)
(unchanged — the handler shapes and `ctx` below are lifted from it). Sibling substrate design:
[`2026-06-29-vibe-ssr-dynamic-workers-design.md`](./2026-06-29-vibe-ssr-dynamic-workers-design.md).

> **Status: spec-first.** This PR lands the design only. Implementation follows in slices on the
> same branch/PR after review (per [`agents/pr-lifecycle.md` § Spec-first workflow](../../../agents/pr-lifecycle.md)).

## Problem

A vibe today is a frontend (`App.jsx`) plus a write-time gatekeeper (`access.js`). It has no place
for **server-side reactors**: OAuth callbacks and webhooks (HTTP in), periodic polling/sync
(timer), and side effects after a write lands (notifications, external sync). #2202 specified the
author API for this — one `backend.js` next to `App.jsx`/`access.js` exporting `fetch`,
`scheduled`, and `onChange` plus a `config` — but left "how does this actually run" open, pointing
at #1796's per-app Agents/DO runtime.

That open question is now answered by a **different, already-shipped** substrate. backend.js is the
same core problem SSR solved (compile author TSX/JS → run it in an isolate with an injected
context), plus four genuinely-new layers: **writes, durable state, scheduling, and outbound**.
The strategy of this design: **reuse the SSR seam wholesale; build only the stateful/scheduled
delta.**

## Author-facing API (unchanged from #2202 — do not redesign)

```
vibe-project/
├── App.jsx       # frontend (already SSR-able via #2802)
├── access.js     # the gatekeeper — validates writes, routes to channels
└── backend.js    # server-side reactors
```

```js
export async function fetch(request, ctx) {
  /* OAuth callbacks, webhooks, REST */
} // → Response
export async function scheduled(event, ctx) {
  /* polling, periodic sync, cleanup  */
} // → void
export async function onChange(event, ctx) {
  /* notifications, external sync, log */
} // → void
export const config = { scheduled: { interval: "5m" } };
```

`ctx = { db: FireflyDB, secrets: Record<string,string>, userInfo: UserContext | null, appInfo: { ownerHandle, appSlug } }`.
Every `ctx.db.put()` writes **as a real `userHandle`** (the trigger's identity; `{ as: "alice" }`
only for the vibe owner), so `access.js` validates backend writes exactly like frontend writes — no
system-write knob. Secrets resolve vibe → account → platform; remixes run with the remixer's
hierarchy. Reserved `_api` path routes to the backend; `scheduled` rides DO alarms (5s–1h,
single-flight, retry-with-backoff); `onChange` is fire-and-forget after the write commits.

Full handler examples (Sonos OAuth+poll, Stripe webhook+email) live in the design HTML.

## Correction: the design HTML's _execution_ model is superseded

The 2026-06-03 HTML's **author API is canonical**, but its **Runtime Architecture / Security
Model** sections describe an execution model we now know is wrong and must not be built:

| HTML says (2026-06-03)                                                 | This design (post-#2802)                                                                                                                                                                                 | Why                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compile handlers with `new Function()` **inside the DO's own isolate** | DO owns state+alarms; it **drives a Worker Loader isolate** (`env.LOADER`) that runs the author code                                                                                                     | In-process eval of untrusted, secret-bearing, network-capable code is a sandbox escape. Codex caught a **real RCE** in the SSR PR where persisted `App.jsx` reached `node:fs`/`process.env` via in-process Node execution. backend.js is strictly more dangerous. |
| "via the `unsafe_eval` flag already present for `AccessFnDO`"          | There is **no `AccessFnDO`** — it was retired in [#2265](https://github.com/VibesDIY/vibes.diy/issues/2265). Access functions run in a QuickJS isolate via `workers/access-fn.ts` (cross-script binding) | Stale reference; the access path is not a DO anymore.                                                                                                                                                                                                             |
| QuickJS rejected because handlers need real `fetch`/async              | Correct conclusion, **right primitive**: Worker Loader gives real `fetch`/async **and** a V8 isolate boundary                                                                                            | We don't need to bridge async through QuickJS host fns; the isolate is a first-class Worker.                                                                                                                                                                      |
| `globalOutbound` unspecified                                           | `globalOutbound` = a **controlled egress proxy/allowlist binding** (never `null`, never inherit-parent)                                                                                                  | SSR pins `null` (no network); backend.js _needs_ network but on a leash where rate-limiting + egress policy live.                                                                                                                                                 |

Net: keep the HTML's three-handler API, `ctx` shape, identity-passthrough rule, secrets hierarchy,
and `_api` routing. Replace its "DO runs `new Function()`" core with "**DO orchestrates a Worker
Loader isolate**," exactly as SSR's `WorkerLoaderExecutor` does.

## The substrate we reuse (concrete, already in-repo)

All in `vibes.diy/vibe/runtime/` unless noted:

- **`vibe-executor.ts`** — `Executor` interface (`render(input) → { html }`), `VibeExecuteInput`,
  `parseVibesSsrMode`, `selectExecutor`. backend.js generalizes this into a **handler-dispatch**
  executor (a sibling, not a fork).
- **`worker-loader-executor.ts`** — `buildVibeWorkerCode` (shapes the `WorkerCode`
  `{ compatibilityDate, mainModule, modules, globalOutbound }`), `WorkerLoaderBinding`,
  `WorkerStub`/`WorkerEntrypoint`, content-`sha`-keyed `env.LOADER.get(id, factory)`, and the
  `globalOutbound` knob (currently pinned `null`). This is the live-path execution primitive.
- **`transform-vibe-source.ts`** — Sucrase TSX→JS, Workers-safe (no wasm/eval). Same transform for
  handler source.
- **`ssr-source-check.ts`** — `hasRelativeImports` via `es-module-lexer`. Same single-file gate
  until dep-bundling lands.
- **`api/svc/intern/vibe-ssr-attempt.ts`** — `attemptVibeSsr` + `selectConventionEntry` + the
  `SsrFallbackReason` discipline (`exception2Result` around selection/source/render; structured
  reasons). The template for "discover entry → load source → run in isolate → structured outcome."
- **`api/svc/intern/process-access-bindings.ts`** — `processAccessBindings` detects `/access.js` in
  the pushed filesystem and upserts an `accessFunctionBindings` row keyed by `{ownerHandle, appSlug}`.
  **Exact template for `processBackendBindings`** detecting `/backend.js`.
- **`api/svc/public/app-documents-write-eventos.ts`** — the production `putDoc` write gate:
  `vctx.invokeAccessFn` (wired to `localInvokeAccessFn`/**QuickJS** in `cf-serve.ts`), source
  lookup, active-handle/admin-mode resolution, grant-state reduction, fail-closed behavior, and the
  `AccessFnOutputs` sidecar upsert. **This — not the runtime mirror — is the path backend writes
  must reuse** (see the correction below).
- **`vibe/runtime/access-runner.ts`** — `evaluateWrite`/`makeClientCtx`: the **runtime _mirror_** of
  the access evaluator (used by SSR/tests). Note it compiles via `new Function` (`access-runner.ts:65`),
  so it is explicitly **NOT** what backend writes route through on the live path — that would both
  diverge from frontend writes and reintroduce in-process eval. It is useful only as the spec for
  what `invokeAccessFn` must do.
- **Worker plumbing** — `api/types/cf-env.ts` (DO + queue bindings), `pkg/wrangler.toml`
  (`[durable_objects]` `Sessions`/`UserNotify` classes + migrations; `VIBES_SERVICE` queue
  producer; `wrangler.queue-consumer.toml`), `api/types/vibes-types.ts` /
  `vibes-diy-serv-ctx.ts` (the `params.vibes.loader` slot #2851 added — reuse it, don't add a new
  one).

### Five things #2802 already taught us (resolving #2202's open questions)

1. **Worker Loader is the execution primitive; a DO is _not_ the sandbox.** The DO owns
   per-app state + alarms; it calls `env.LOADER.get(sha, () => WorkerCode).getEntrypoint().fetch()`
   for the untrusted execution. Never run author code in the DO's own isolate.
2. **Isolate-only on the live path.** Any in-process/Node executor (`NodeExecutor`) is
   **CI/trusted-only** and must never touch live traffic — same hard rule SSR slice 4 enforced
   (`render-vibe.ts` maps any non-`loader` mode to `off`).
3. **`globalOutbound` is the outbound-abuse answer.** Invert SSR's `null` to a controlled
   proxy/allowlist binding.
4. **Worker Loader can't resolve npm specifiers** — deps must be bundled into `WorkerCode.modules`
   before a live load (SSR carry-forward [#2845](https://github.com/VibesDIY/vibes.diy/issues/2845)).
   Do it once, shared.
5. **Beta-binding rollout pattern transfers wholesale.** `env.LOADER` is open beta, absent from CI.
   Ship fully-wired-but-dormant behind a flag; unit-test `WorkerCode` shaping + orchestration
   against a **fake binding**; land a behavior-neutral param slot first (#2851's
   `params.vibes.loader`).

## Architecture

```
                       push time                         live triggers
   ┌──────────────┐  processBackendBindings   ┌────────────────────────────┐
   │  /backend.js │ ───────────────────────▶  │  backendFunctionBindings   │ (D1 row: CID, config, schedule)
   └──────────────┘  (detect, compile-check,  └────────────────────────────┘
                      validate interval, arm)              │
                                                           ▼
  HTTP  /vibe/{owner}/{slug}/api/*  ─────────▶  ┌──────────────────────────┐
  alarm (scheduled interval)        ─────────▶  │        BackendDO         │  state + alarms + single-flight
  write-commit  onChange event      ─────────▶  │  (per {owner}/{slug})    │  + retry/backoff + token storage
                                                └────────────┬─────────────┘
                                                             │ env.LOADER.get(sha, ()=>WorkerCode)
                                                             ▼  globalOutbound = egress proxy
                                                ┌──────────────────────────┐
                                                │  Worker Loader isolate   │  runs backend.js handler
                                                │  buildBackendWorkerCode  │  ctx.db / ctx.secrets / ctx.userInfo
                                                └────────────┬─────────────┘
                                                             │ ctx.db.put as trigger identity
                                                             ▼
                                            putDoc → invokeAccessFn (QuickJS) — same gate as frontend writes
```

- **BackendDO** (new DO class, keyed `{ownerHandle}/{appSlug}`) is the **control plane** for the
  _delta_ SSR never needed: alarm scheduling, retry/backoff, dedupe windows, and durable token/task
  state. It is the **orchestrator**, not the sandbox. Single-flight is scoped to **`scheduled`**
  (one tick at a time per vibe) — `fetch`/`onChange` execution stays as **unblocked** as possible,
  _not_ serialized behind one lane (per @CharlieHelps). Ship contention/queue-latency instrumentation
  from day one so any "split the DO" decision is data-driven.
- **The isolate** runs the actual `backend.js` via a `buildBackendWorkerCode` that dispatches to
  the requested export (`fetch`/`scheduled`/`onChange`) — the backend analog of
  `buildVibeWorkerCode`. Per-trigger context is split by where it can safely live (per @CharlieHelps,
  who verified our `loader.get(id, …)` keys `id` on `compatibilityDate + mainModule + modules`):
  - **Stable for the isolate identity** — hashed `modules` bytes, compat date/flags, **and**
    `WorkerCode.env`, which carries **only** stable **service/transport bindings** (the db-RPC
    transport, the egress-proxy binding). No per-trigger identity or secrets here.
  - **Per-invocation, never in `env` or the hashed source** — `userHandle`, source-tag, depth,
    dedupe-key, the request/event — passed via the **request payload/headers or RPC method args** on
    each call. This is what keeps "stable hashed code, variable context" true: identical `backend.js`
    ⇒ one isolate id across all triggers/identities, with no cross-invocation identity bleed.
- **`ctx.db` proxies back through the production `putDoc` path** (`invokeAccessFn`/QuickJS, with the
  `AccessFnOutputs` sidecar + fail-closed behavior) as the trigger identity — the **same gate
  frontend writes use**, _not_ the `access-runner` runtime mirror (which uses `new Function`). No new
  access surface, and no second access implementation. (Corrected per Codex P1 review.)

## Slices (sharp, CI-verifiable cuts; mirror the SSR slicing discipline)

Each slice is independently landable, defaults dormant, and is unit-tested against a **fake**
`env.LOADER` where the live binding is needed. Order is roughly risk-ascending.

### Slice B1 — Backend executor seam (library-only, fake-binding tested) — ✅ implemented

Generalize the executor to **invoke a named handler**, not just render. Lives in
`vibes.diy/vibe/runtime/` (`transform-backend-source.ts`, `backend-executor.ts`,
`backend-worker-loader-executor.ts`).

- `transformBackendSource(src)` — reuse `transformVibeSource` (no JSX needed but harmless; strips TS).
- `buildBackendWorkerCode({ module, policyVersion? })` — sibling to `buildVibeWorkerCode`. The `main`
  module imports the compiled `backend.js` and reads **both the handler name and the per-trigger
  context** (identity, source-tag, depth, dedupe-key, request/event) from the **incoming request** on
  each call, then dispatches to the matching export — **never** from the hashed source or `env`.
  Because `handler` rides the request too, the `modules` map depends only on the vibe's `backend.js`
  bytes + `policyVersion`, so **one isolate per vibe serves all three handlers and every identity**
  (handler is not part of the cache key). `policyVersion` (egress-policy / binding-schema version) IS
  folded into the hash so a policy bump forces a new isolate id. `config` is read at push time, not
  here.
- `WorkerLoaderBackendExecutor` (loader-backed, `invoke(input)`) + the `BackendExecutor` interface +
  `parseBackendJsMode` + `selectBackendExecutor(mode, { loader, policyVersion })` with a
  `BACKEND_JS=off|loader` flag (**no `node` mode at all** — in-process execution is never allowed).
- **Out of scope:** real `env.LOADER` load, dep bundling, the DO, routing, real `ctx.db`/secrets
  wiring (the `ctx` built in `main` is a B1 stub), the egress proxy (`globalOutbound` stays `null`).
- **Tests** (`tests/app/ssr/backend-*.test.ts`): `buildBackendWorkerCode` shaping; orchestration
  (`get → getEntrypoint → fetch`) against a fake binding; flag parsing; the client-entry guard extended
  to backend modules; and **cache-key isolation (@CharlieHelps's matrix): (a) same code + different
  trigger identities ⇒ same loader id; (b) no cross-invocation identity bleed (identity in the request,
  never the WorkerCode); (c) policyVersion bump ⇒ new id.**

### Slice B2 — Push-time discovery + config validation

Split into a pure parsing cut and a persistence cut so the schema migration doesn't ride along with
the parser (sharp, lower-risk).

#### B2a — `parseBackendConfig` (pure, library-only) — ✅ implemented

`vibes.diy/vibe/runtime/parse-backend-config.ts`. Given `backend.js` source, report which trigger
exports exist (`fetch`/`scheduled`/`onChange`, plus whether a `config` export is present) and validate
the schedule.

- Parses `config.scheduled.interval` (scoped to the `scheduled:` block so a stray `interval:` is
  ignored) and **rejects sub-5s, over-1h, and malformed intervals at push time with a clear error** —
  never silently clamped. A `scheduled` handler with no interval is an error; an interval with no
  `scheduled` handler is ignored.
- Detects exports across `function` / `const`-arrow / `export { x as fetch }` forms; word-boundaried so
  `prefetch` ≠ `fetch`.
- Pure, Workers-safe, zero I/O — the push path (B2b) consumes the result.
- **Tests** (`tests/app/ssr/parse-backend-config.test.ts`): handler detection across export forms;
  interval units + inclusive boundaries (5s, 1h); sub-5s / over-1h / malformed rejection;
  scheduled-without-interval error; interval-without-scheduled ignored; substring guard.

#### B2b — `processBackendBindings` + the `backendFunctionBindings` table (persistence + wiring) — _next_

Clone `processAccessBindings`: detect `/backend.js`, upsert a `backendFunctionBindings` row
(`{ownerHandle, appSlug, cid, assetUri, handlers, intervalMs, updated}`) using the B2a parse result,
delete on removal; wire it into the push path (`ensure-app-slug-item.ts`) next to
`processAccessBindings`. Carries the new D1/pg table + Drizzle migration — intentionally landed with
(or just before) B3's DO that reads it, so no unused schema ships early.

- **Tests:** detection, upsert/delete on removal, handlers + interval persisted from the parse result.

### Slice B3 — `_api` routing → BackendDO.fetch → isolate

Route `/vibe/{owner}/{slug}/api/*` to the BackendDO; strip the `/api/` prefix so the handler sees a
path relative to `/api/`. DO loads source from the asset store (cache-in-memory, recompile on
eviction — SSR pattern), runs the `fetch` handler in the isolate, returns the `Response`.

- `ctx.userInfo` = session user or `null` (webhooks); default write identity = vibe owner.
- **Fallback discipline** like `attemptVibeSsr`: a missing/empty/uncompilable `backend.js` → 404 for
  `_api`, never a 500 of the page.
- **Tests:** route match/prefix-strip; DO dispatch to `fetch`; absent-handler → 404.

### Slice B4 — Durable layer: alarms (`scheduled`), single-flight, retry/backoff

The genuinely-new work. BackendDO arms an alarm from `config.scheduled.interval`; on `alarm()` it
runs the `scheduled` handler in the isolate, then re-arms. **No concurrent execution _of `scheduled`_**
(single-flight is scoped to the timer lane, per vibe); if a tick overruns, the next starts after it
finishes. `fetch`/`onChange` are **not** serialized behind this lane — they run unblocked (per
@CharlieHelps). Handler throw → exponential backoff retry. Push with a new interval re-arms; removing
`scheduled` stops re-arming; deleting the vibe destroys the DO + alarms.

- **Tests** (fake binding, DO test harness): arm/fire/re-arm; interval change; single-flight
  (overlapping ticks serialize); backoff on throw; stop on removal.

### Slice B5 — `onChange` after write commit (a NEW dedicated post-commit queue message)

After `putDoc` commits, enqueue a **new, dedicated** `onChange` message carrying the full
`{ doc, oldDoc, dbName, userInfo }` payload onto the `VIBES_SERVICE` queue →
BackendDO.invokeOnChange → isolate. **Fire-and-forget**: the write succeeds regardless.

> **Do NOT reuse `vibes.diy.evt-doc-changed` for this** (corrected per Codex P2 review). That stream
> is **local WebSocket fan-out** via `notifyDocChanged` (`cf-serve.ts`), not a durable queue event:
> it "carries no document content" (`cf-serve.ts:117`) — only ids/channel — and it only reaches
> currently-subscribed sockets. Consuming it for backend `onChange` would (a) **miss handlers** when
> no client is subscribed, (b) **duplicate** per channel, and (c) arrive **without the document
> payload** the handler needs. `VIBES_SERVICE` today carries other explicit queued events, so this is
> a new message type on it, emitted in the same post-commit step as `putDoc`. Mind the
> [#2306](https://github.com/VibesDIY/vibes.diy/issues/2306) "don't overload `dbName`" lesson when
> shaping the payload.

- **Delivery contract:** **at-least-once, no strict ordering** per `(dbName, _id)` at launch (per
  @CharlieHelps). Document handler **idempotency** expectations + an optional dedupe-key the handler
  can supply.
- **Loop-breaking (in B5, not a follow-up):** a backend `ctx.db.put` inside `onChange` can re-enqueue
  another `onChange` — use **source-tagging _and_ a depth cap together** (per @CharlieHelps).
- **Tests:** event shape (create/update/delete via `doc`/`oldDoc` nullness); write succeeds even when
  `onChange` throws; at-least-once delivery + handler idempotency; loop guard (source-tag + depth cap);
  **delivered even with zero subscribed sockets** (the regression guard against the evt-doc-changed
  mistake).

### Slice B6 — Write-back-through-access as the trigger identity

`ctx.db.put()` routes through the **production `putDoc` path** (`vctx.invokeAccessFn` →
`localInvokeAccessFn`/QuickJS, with source lookup, active-handle/admin-mode resolution, grant-state
reduction, fail-closed behavior, and the `AccessFnOutputs` sidecar upsert) as the trigger's
`userHandle` (`onChange` → original writer; `fetch` → session user; `scheduled` → owner). This is the
**same gate frontend writes use** — **not** `access-runner.evaluateWrite`, the `new Function`-based
runtime mirror, which would diverge from frontend writes and reintroduce in-process eval (Codex P1).
`{ as: "handle" }` override is **owner-code-only**, enforced by the runtime. **Explicitly define
cold/empty `accessFnOutputs` behavior** (backfill windows) so a backend write never accidentally
widens or hides — mirror SSR slice-6 backfill discipline.

- **Tests:** identity passthrough per trigger; owner-only impersonation; access denial surfaces to
  the handler; cold-grant behavior.

### Slice B7 — Secrets hierarchy (vibe → account → platform), remix-safe

Resolve secrets server-side only, never to the browser. Vibe-level overrides account-level overrides
platform-level. **Remix runs with the remixer's hierarchy — original creator's keys never exposed.**

- **Tests:** precedence; remix isolation (creator secret absent under remixer); never serialized into
  any client-visible payload.

### Slice B8 — `globalOutbound` egress proxy + rate limiting

Replace the isolate's `globalOutbound: null` with a controlled proxy/allowlist binding where egress
policy + per-vibe rate limiting live. This is the abuse boundary; it is **required** before any live
backend traffic. The **egress proxy binding is the policy source-of-truth** (per @CharlieHelps):
`config` may _declare_ a requested policy and the DO may cache/coordinate, but **neither is the policy
authority** — enforcement happens at the proxy.

- **Tests:** outbound goes through the proxy binding; rate-limit trip; disallowed egress blocked;
  `config`-declared policy is advisory, proxy decision wins.

### Slice B9 — Codegen docs + signal detection (`backend-js.llms.md`)

Author the LLM codegen doc around **complete, copy-adaptable examples** per handler (path-router
`fetch`, HMAC webhook, OAuth exchange, polling `scheduled`, type-filtered `onChange`). Wire the
signal-word detection (webhook/OAuth → `fetch`; every/poll/cron → `scheduled`; when/notify/after →
`onChange`) so prompts that need a backend get one, and static apps don't.

### Dependency-bundling (shared carry-forward, not a backend-only slice)

Worker Loader can't resolve npm specifiers; handler imports (and the SSR renderer imports) must be
bundled into `WorkerCode.modules` before any live load. This is **#2845, shared with SSR** — do it
once. Live `loader` mode for both SSR and backend.js is gated on it.

## Security model

- **Isolate-only live path.** Untrusted author code runs **only** in a per-request/per-trigger
  Worker Loader isolate. `NodeExecutor`-style in-process execution is CI/trusted-only and barred from
  live routing (the SSR Codex-RCE lesson, applied a fortiori — backend.js is secret-bearing and
  network-capable).
- **Network on a leash.** `globalOutbound` = controlled proxy; never `null` (would block the whole
  point) and never inherit-parent (would expose untrusted code to the open Internet from the edge).
- **Secrets never leave the server**, resolved per the hierarchy, remix-isolated.
- **Writes always go through `access.js`** as a real `userHandle` — no system-write backdoor; the
  access function can't tell a backend write from a frontend write.
- **Gating: verified-login at launch; KYC as a pluggable follow-on.** The HTML proposes KYC-gating
  backend.js (because it makes outbound requests). Decided (per @CharlieHelps): a **verified-login /
  claims gate is sufficient for launch**; design KYC as a **pluggable follow-on gate at the same
  decision point**, not a hard launch blocker.
- **Resource limits.** Per-isolate CPU/memory/duration caps; `scheduled` single-flight; DO eviction as
  natural cleanup.

## Resolved defaults (decided with @CharlieHelps; [PR #2859 review](https://github.com/VibesDIY/vibes.diy/pull/2859))

The seven open questions are now settled with these defaults; the must-hold invariants below make them
testable.

1. **Stored `backend.js` vs precompiled artifact** → **stored-source + transform-at-load** (reuse
   `transformVibeSource`), mirroring how SSR/`render-vibe` handles `App.jsx`. No publish-time compiled
   artifact.
2. **`ctx` through the isolate** → keep `ctx` **out of both the hashed module source _and_
   `WorkerCode.env`** (env is part of the isolate identity, so it holds only stable service/transport
   bindings). Carry per-trigger identity/secrets/source-tag/depth/dedupe-key via the **request payload
   / RPC method args** on each invocation. `ctx.db` is a **narrow RPC surface**
   (`get`/`query`/`put`/`del`); **writes re-enter the access-enforced `putDoc` path** as the trigger's
   active `userHandle`, never a privileged bypass. Avoid a separate reader/writer binding **unless it
   is purely transport and still re-enters the same access policy path**.
3. **`onChange` delivery** → **new dedicated post-commit message on `VIBES_SERVICE`** (not
   `evt-doc-changed`); **at-least-once, no strict ordering** at launch; loop-breaking via
   **source-tag + depth-cap together**, in B5; document idempotency + optional dedupe-key.
4. **DO ownership** → DO is the **control plane** (alarms, retry/backoff, durable token/state, dedupe
   windows). Keep `fetch`/`onChange` execution **unblocked**; single-flight only on the `scheduled`
   lane. One DO per app to start, **with contention/queue-latency instrumentation from day one** so a
   future split is data-driven.
5. **Egress policy** → enforcement at the **egress proxy binding (source-of-truth)**; `config` declares
   _requested_ policy, the DO may cache/coordinate, but neither is the authority.
6. **Gating** → **verified-login/claims gate sufficient for launch**; KYC is a **pluggable follow-on
   gate at the same decision point**, not a launch blocker.
7. **Sequencing vs #2845** → land **B1–B7 dormant** (`BACKEND_JS=off`); enable live **only with B8 +
   #2845 together**. Earlier exercise happens via **non-prod env-level canaries**, _not_ trusted-author
   prod allowlists.

## Must-hold invariants & acceptance checks

Modeled on the SSR design's Phase A acceptance criteria; these gate the live cut and turn the
defaults above into testable guarantees (the follow-up pass @CharlieHelps offered, folded in here).

- [ ] **Cache-key isolation.** Isolate identity is derived from **stable code + stable policy surface
      only** — module bytes, compat date/flags, egress-policy version, binding-schema version
      (optionally app scope) — and **`WorkerCode.env` is stable for that identity** (service/transport
      bindings only). No per-trigger `ctx` (identity, secrets, request/event) enters the hashed source
      _or_ `env`; it travels by request/RPC args. _Tests (B1/B5, per @CharlieHelps's matrix): (a) same
      code + different trigger identities ⇒ **same loader id**; (b) **no cross-invocation identity
      bleed**; (c) an egress-policy or binding-schema bump **forces a new id**._
- [ ] **Write-path parity.** Every `ctx.db.put` goes through the production `putDoc`/`invokeAccessFn`
      (QuickJS) gate with the `AccessFnOutputs` sidecar — never the `access-runner` mirror. A backend
      write and an identical frontend write produce the same allow/deny + sidecar outcome. _Tests:
      allow/deny parity, cold/empty `accessFnOutputs`, owner-only `{ as }` impersonation._
- [ ] **Loop-guard semantics.** `onChange`-induced writes carry a source-tag and a bounded depth;
      beyond the cap, no further `onChange` is enqueued. _Tests: self-write loop terminates at the cap;
      source-tagged writes don't re-trigger their own handler._
- [ ] **Egress enforcement locus.** All isolate outbound traverses the proxy binding; a
      `config`-declared policy that the proxy disallows is still blocked. `globalOutbound` is never
      `null` and never inherit-parent on the live path. _Tests: proxy decision overrides config;
      disallowed egress blocked; rate-limit trip._
- [ ] **Dormant-by-default + flag discipline.** `BACKEND_JS=off` ships the entire feature dark; a
      misconfigured `loader` with no `env.LOADER` binding degrades safely (no 500), mirroring SSR's
      `select_error` fallback. _Tests: off ⇒ no DO/route/alarm; missing-binding ⇒ structured fallback._
- [ ] **Delivery + idempotency.** `onChange` is delivered at-least-once with zero subscribed sockets;
      handlers are documented idempotent; no ordering guarantee is promised. _Tests: delivery with no
      sockets; duplicate delivery tolerated._

## Rollout runbook (flag-gated the whole way; staged flip for final review)

Nothing reaches end users until the operator flips a flag. Two independent gates:

1. **Platform flag `BACKEND_JS`** (worker env var, per-environment — the `VIBES_SSR` analog). `off`
   (default) = inert; `loader` = live. There is no `node` mode.
2. **Per-vibe + per-author** — even with the flag on, a vibe gets backend behavior only if it ships a
   `backend.js` _and_ its author passes the gate (verified-login at launch; KYC pluggable follow-on).
   So flipping the flag touches no existing vibe; it only lets opted-in ones run a backend.

**Every slice (B1–B9) lands dormant behind `BACKEND_JS=off`.** Merging them ships zero runtime change.
`loader` mode cannot do anything useful until **B8** (egress proxy replaces `globalOutbound: null`) and
**#2845** (dep bundling) land — and `env.LOADER` reaches GA (open beta today). That's why B1–B7 are
safe to merge while dark.

**Final-review process before opening to users** (per resolved default #7 — staged env flip, not a
trusted-author prod allowlist):

1. Merge B1–B7 dormant; prod unaffected.
2. Land B8 + #2845 (still default-off).
3. **Flip `BACKEND_JS=loader` in a non-prod env first** (dev/preview canary). Hands-on review: push a
   vibe with a real `backend.js` and exercise an OAuth/webhook (`fetch`), a poller (`scheduled`), and an
   email-on-write (`onChange`); watch the egress proxy, DO alarms, and that writes land through
   `access.js`.
4. **Verify the must-hold invariants** (above) on real traffic: cache-key isolation, write-path parity,
   loop-guard, egress locus, delivery/idempotency.
5. **Flip prod** — still gated per author by verified-login. The reversible escape hatch throughout is
   flipping `BACKEND_JS` back to `off`.

Caveat: this assumes `env.LOADER` reaches GA. If it's still beta when B8 lands, the canary happens but
the prod flip waits on Cloudflare — same posture as SSR.

## Risks / caveats

- **Worker Loader is open beta** (Workers Paid) — keep `BACKEND_JS=off` default until GA, same as
  `VIBES_SSR`.
- **Secret-bearing isolate** raises the stakes of any sandbox gap vs SSR's read-only render — the
  isolate-only rule and egress proxy are load-bearing, not nice-to-haves.
- **Alarm storms / runaway polling** — sub-5s rejected at push time, single-flight, backoff; still
  watch fleet load when many vibes schedule at once.
- **`onChange` amplification** — a backend `ctx.db.put` can itself trigger `onChange`; define
  loop-breaking (depth cap / source tagging) before B5 ships.
- **Cache-key correctness** — per-trigger `ctx` must stay out of **both** the hashed `WorkerCode`
  source **and** `WorkerCode.env` (which is part of the loader `id`'s identity surface), travelling by
  request/RPC args instead; otherwise the isolate cache forks per request (and worse, a trigger's
  identity could leak into another's isolate). This is the single most important invariant carried
  from SSR — see invariant #1.
- **Access parity drift** — backend writes must go through the **same production `putDoc`/
  `invokeAccessFn` (QuickJS) gate** as app writes, including the `AccessFnOutputs` sidecar; the
  `access-runner` `new Function` mirror is a forked path and the failure mode (Codex P1). Cover
  allow/deny + cold-grant in tests.
