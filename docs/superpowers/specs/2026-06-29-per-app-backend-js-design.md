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
- **`vibe/runtime/access-runner.ts`** — `evaluateWrite`/`makeClientCtx` — the **same** access
  evaluator the `getDoc`/`queryDocs`/write paths use. backend.js writes go through this, not a fork
  (SSR slice-6 principle).
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
                                                   access-runner (same evaluator)
```

- **BackendDO** (new DO class, keyed `{ownerHandle}/{appSlug}`) holds the _delta_ SSR never needed:
  alarm scheduling, single-flight, retry-with-backoff, and durable token/task state. It is the
  **orchestrator**, not the sandbox.
- **The isolate** runs the actual `backend.js` via a `buildBackendWorkerCode` that dispatches to
  the requested export (`fetch`/`scheduled`/`onChange`) — the backend analog of
  `buildVibeWorkerCode`. `ctx` is supplied through `WorkerCode.env` + RPC bindings (db reader/writer
  proxy, resolved secrets, identity), **not** baked into the hashed source (SSR's "keep per-request
  data out of the hashed module source" carry-forward — else the `sha` cache key forks per request).
- **`ctx.db` proxies back through `access-runner`** as the trigger identity. No new access surface.

## Slices (sharp, CI-verifiable cuts; mirror the SSR slicing discipline)

Each slice is independently landable, defaults dormant, and is unit-tested against a **fake**
`env.LOADER` where the live binding is needed. Order is roughly risk-ascending.

### Slice B1 — Backend executor seam (library-only, fake-binding tested)

Generalize the executor to **invoke a named handler**, not just render.

- `transformBackendSource(src)` — reuse `transformVibeSource` (no JSX needed but harmless; strips TS).
- `buildBackendWorkerCode({ module, handler, ctxWiring })` — sibling to `buildVibeWorkerCode`; the
  `main` module imports the compiled `backend.js`, reads `handler` + the request/event from
  `WorkerCode.env`/the request, dispatches to the matching export, and returns its result. `config`
  is read at push time, not here.
- `BackendExecutor` (loader-backed) + `selectBackendExecutor(mode, { loader })` with a
  `BACKEND_JS=off|loader` flag (no `node` live path — CI-only, like SSR).
- **Out of scope:** real `env.LOADER` load, dep bundling, the DO, routing, ctx wiring to real db.
- **Tests:** `buildBackendWorkerCode` shaping per handler; `BackendExecutor` orchestration
  (`get → getEntrypoint → fetch`) against a fake binding; flag parsing.

### Slice B2 — Push-time discovery + config validation (`processBackendBindings`)

Clone `processAccessBindings`: detect `/backend.js`, store a `backendFunctionBindings` row
(`{ownerHandle, appSlug, cid, config, schedule}`), delete on removal.

- Parse `config.scheduled.interval`; **reject sub-5s** and `> 1h` at push time with a clear error.
- Record which exports exist (so routing/alarm/onChange wiring know what to invoke).
- **Tests:** detection, interval bounds, removal, multi-export recording. No DO yet.

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
runs the `scheduled` handler in the isolate, then re-arms. **No concurrent execution** (single-flight
per vibe); if a tick overruns, the next starts after it finishes. Handler throw → exponential
backoff retry. Push with a new interval re-arms; removing `scheduled` stops re-arming; deleting the
vibe destroys the DO + alarms.

- **Tests** (fake binding, DO test harness): arm/fire/re-arm; interval change; single-flight
  (overlapping ticks serialize); backoff on throw; stop on removal.

### Slice B5 — `onChange` after write commit (via the existing queue/event stream)

After `putDoc` commits, enqueue an `onChange` event (`{ doc, oldDoc, dbName, userInfo }`) onto the
existing `VIBES_SERVICE` queue → BackendDO.invokeOnChange → isolate. **Fire-and-forget**: the write
succeeds regardless. Consume the **same** `vibes.diy.evt-doc-changed` / channel-routing stream —
mind the [#2306](https://github.com/VibesDIY/vibes.diy/issues/2306) "don't overload `dbName`" lesson.

- **Tests:** event shape (create/update/delete via `doc`/`oldDoc` nullness); write succeeds even when
  `onChange` throws; at-least-once delivery semantics.

### Slice B6 — Write-back-through-access as the trigger identity

`ctx.db.put()` proxies to `access-runner.evaluateWrite` as the trigger's `userHandle`
(`onChange` → original writer; `fetch` → session user; `scheduled` → owner). `{ as: "handle" }`
override is **owner-code-only**, enforced by the runtime. **Explicitly define cold/empty
`accessFnOutputs` behavior** (backfill windows) so a backend write never accidentally widens or
hides — mirror SSR slice-6 backfill discipline.

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
backend traffic.

- **Tests:** outbound goes through the proxy binding; rate-limit trip; disallowed egress blocked.

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
- **KYC gate (open question — see below).** The HTML proposes KYC-gating backend.js (because it makes
  outbound requests) while `access.js` stays ungated. Whether launch requires verified-login vs a
  separate KYC step is **still open** and designed alongside the access path.
- **Resource limits.** Per-isolate CPU/memory/duration caps; alarm single-flight; DO eviction as
  natural cleanup.

## Open questions (carried from #2202, annotated; for @CharlieHelps review)

1. **Stored `backend.js` vs precompiled artifact?** Lean **stored-source + transform-at-load**
   (reuse `transformVibeSource`), mirroring how SSR/`render-vibe` handles `App.jsx`. Confirm we
   don't want a publish-time compiled artifact instead.
2. **`ctx` wiring through the isolate.** SSR currently JSON-embeds `mountParams` into the hashed
   `main` (forks the cache key). For backend.js, `ctx` (db RPC handle, resolved secrets, identity) is
   **per-trigger and secret-bearing**, so it must ride `WorkerCode.env`/RPC, _not_ the hashed source.
   Does the Worker Loader `env`/RPC surface comfortably carry a bidirectional `ctx.db` proxy (writes
   that re-enter `access-runner`), or do we need a dedicated reader/writer service binding?
3. **`onChange` delivery substrate.** Reuse the `VIBES_SERVICE` queue + `evt-doc-changed` stream, or
   stand up a dedicated path? At-least-once with handler idempotency is assumed — acceptable, or do we
   need de-dupe/ordering guarantees per `(dbName, _id)`?
4. **Single-flight + alarm ownership in the DO.** One BackendDO per `{owner}/{slug}` owns _all three_
   triggers' execution serialization, or separate concerns (e.g. alarms in the DO, `fetch`/`onChange`
   stateless)? The HTML implies one DO; SSR has no DO at all, so this is net-new and worth a sanity
   check.
5. **Egress policy shape.** Allowlist per vibe, global rate limit, or both? Where does the policy
   live (the proxy binding vs DO state vs config), and what's the default for a brand-new backend?
6. **KYC / gating.** Verified-login sufficient at launch, or a separate KYC step before a BackendDO is
   created? Does an un-approved author's pushed `backend.js` compile-check and store but stay dormant?
7. **Dep-bundling sequencing (#2845).** backend.js live mode is blocked on it just like SSR — should
   B1–B7 land dormant first (no live `loader`) and B8 + #2845 unblock live together, or do we want a
   trusted-author allowlist to exercise the live path sooner?

## Risks / caveats

- **Worker Loader is open beta** (Workers Paid) — keep `BACKEND_JS=off` default until GA, same as
  `VIBES_SSR`.
- **Secret-bearing isolate** raises the stakes of any sandbox gap vs SSR's read-only render — the
  isolate-only rule and egress proxy are load-bearing, not nice-to-haves.
- **Alarm storms / runaway polling** — sub-5s rejected at push time, single-flight, backoff; still
  watch fleet load when many vibes schedule at once.
- **`onChange` amplification** — a backend `ctx.db.put` can itself trigger `onChange`; define
  loop-breaking (depth cap / source tagging) before B5 ships.
- **Cache-key correctness** — per-trigger `ctx` must stay out of the hashed `WorkerCode` or the isolate
  cache forks per request (and worse, could leak one trigger's identity into another's isolate). This
  is the single most important invariant carried from SSR.
- **Access parity drift** — backend writes must use the _same_ evaluator as app writes; a forked path
  is the SSR slice-6 failure mode. Cover allow/deny + cold-grant in tests.
