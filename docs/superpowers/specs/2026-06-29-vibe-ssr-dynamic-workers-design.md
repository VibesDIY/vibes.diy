# Vibe SSR via Cloudflare Dynamic Workers — design

Tracking issue: [#2802](https://github.com/VibesDIY/vibes.diy/issues/2802). Origin of the
re-open: jchris's comment — "[SSR] need to run live query and other db operations at least
through quiesce, so e.g. blog articles are in SSR. This makes it harder. Cloudflare has new
eval tools. Investigate." Investigation comment:
[#2802 (comment)](https://github.com/VibesDIY/vibes.diy/issues/2802#issuecomment-4826965520).

## Problem

A published vibe paints nothing until the browser downloads React + the vibe bundle and
mounts client-side. We already SSR the _chrome_ (React Router 7 on the worker) but not the
user's vibe component. We want first-paint-before-JS, per-vibe meta/OG tags, and a no-JS
fallback — **including data-driven content** (e.g. blog articles) that requires running the
vibe's live queries to quiescence on the server before rendering.

The original #2802 write-up concluded true per-request SSR could not run on Cloudflare
Workers (no `eval`, no `import()` of a request-time `data:` URL) and would need a Node/Deno
container. That conclusion is now outdated: **Cloudflare Dynamic Workers** (the
`env.LOADER` Worker Loader binding, open beta) instantiate a fresh V8 isolate from
code supplied at runtime, dissolving the eval wall while staying on the edge. The isolate
can receive bindings/RPC + a controlled `globalOutbound`, which is what makes the
live-query-to-quiesce requirement tractable server-side.

## The seam

A vibe SSR has two halves:

1. **Execute** untrusted, freshly-compiled vibe code in isolation and call `renderToString`.
   This is the runtime-specific half (Node container today, Worker Loader at the edge
   tomorrow). It is _not_ unit-testable in this repo's CI because the LOADER binding is beta
   and not present.
2. **Render** — given the already-compiled vibe component(s) and a mount context, produce the
   exact HTML that the client will hydrate, wrapped in the same provider tree the client
   uses. This half is pure, runtime-agnostic, and fully unit-testable today. It is the code
   that runs _inside_ whatever executor half (1) chooses.

Half (2) is the natural first slice: it de-risks the whole feature, lands the
server/client markup contract, and the executor drops in later behind a flag.

## Slice 1 (this spec's implementation) — render + hydrate contract

Package: `@vibes.diy/vibe-runtime` (`vibes.diy/vibe/runtime`), which already depends on
`react`, `react-dom`, and `sucrase`, and already owns the client mount (`mount-vibes.ts`).

- **`render-vibes.ts` → `renderVibeToString(comps, iprops): string`** — the server
  counterpart to `mountVibe`. Validates `iprops` with the existing `vibeMountParams`
  arktype validator, builds the **same** `VibeContextProvider`-wrapped `Fragment(...comps)`
  tree `mountVibe` builds, and returns `renderToString(tree)`.
- **Shared tree builder** — extract the element-construction both functions use into one
  internal helper so the server tree and the client tree are byte-identical by construction.
  Matching markup is the entire point of hydration; a divergence here silently throws away
  the SSR pass.
- **`mountVibe` hydration upgrade** — when the mount container already holds SSR markup
  (`container.hasChildNodes()`), create the root with `hydrateRoot(container, tree)` instead
  of `createRoot(container).render(tree)`. Empty container keeps today's behavior exactly
  (client-only render, hot-swap-safe root reuse). This satisfies the issue's "hydrate, not
  re-render" acceptance item. `hasChildNodes()` is the right default for this slice; once
  route wiring lands (slice 4) it should be tightened to an explicit server marker
  (`data-vibe-ssr` on the container) so incidental child nodes can't be mistaken for an SSR
  payload. (Per @CharlieHelps review on #2823.)

`VibeContextProvider` is already SSR-safe: every `document`/`window` access is guarded by a
`typeof … === "undefined"` check or lives inside a `useEffect` (which does not run during
`renderToString`). No changes needed there.

### Tests

- **Browser project** (`vibes.diy/tests/app`, real DOM via playwright):
  - `renderVibeToString` returns HTML containing a component's output and context-derived
    values (a component reading `useVibeContext()` sees the passed `mountParams`).
  - `mountVibe` hydrates pre-existing SSR markup: render to string → inject into the
    container → `mountVibe` → DOM content is preserved (not blown away) and the tree is live.
  - Empty container path still uses client render (regression guard on existing behavior).
- **Node SSR project** (`vibes.diy/tests/app/ssr`, `environment: node`, no `window`):
  - `renderVibeToString` of a simple component succeeds with `globalThis.window` undefined —
    proves it runs in the worker/isolate server context. Mirrors the existing
    `vibe-route-ssr.test.tsx` pattern (relative source import, node env).

### Out of scope for slice 1 (explicit YAGNI)

- The transform step (Sucrase TSX→JS string), dependency/import-map resolution, the executor
  interface + Node/Worker-Loader implementations, the `VIBES_SSR` flag, route wiring,
  caching, and the live-query/quiesce data path. All deferred to the slices below so this PR
  stays sharp and entirely CI-verifiable.

## Follow-up slices (design recorded, not built here)

2. **Transform + executor interface.** `transformVibeSource(src): { module }` via Sucrase
   (Workers-safe, no wasm, no eval — already proven by the deleted prototype). An
   `Executor` interface: `NodeExecutor` (dynamic-import / `vm`, for CI + the container
   fallback) and `WorkerLoaderExecutor` (`env.LOADER.get(sha, () => WorkerCode)` →
   `getEntrypoint().fetch()`), selected by a `VIBES_SSR=off|node|loader` flag. Executors
   supply compiled comps + ctx and call `renderVibeToString` from slice 1.
3. **Live-query / quiesce data path (view-time, public vibes first).** Pass the isolate a
   Fireproof reader binding/RPC via `WorkerCode.env` (or proxy sync via `globalOutbound`); run
   the vibe's live queries to quiescence behind a hard server-side deadline, then render. This
   is **per request at view time**, not publish — the content is DB-hydrated and mutable, so a
   publish-time snapshot is wrong by construction (this is why the old "option 2" cannot stand
   alone). **Scope decided: render data content only for public vibes (`isWorldReadable`)
   first** — one shared view per `(appSlug, dataVersion, urlState)`, no per-viewer dimension,
   no access-evaluation in the isolate. See [SEO model](#seo--the-iframe-boundary) for why
   public-first is the right de-risk.
4. **Route wiring + caching + OG/meta + no-JS fallback.** Inject SSR HTML into the
   `vibe-app-container` (with a `data-vibe-ssr` marker so `mountVibe` hydrates only a real SSR
   payload, not incidental child nodes — replaces the slice-1 `hasChildNodes()` heuristic),
   emit per-vibe meta/OG tags, hydrate on the client, LRU/Cache-API the rendered HTML.
5. **Markdown SEO / no-JS layer (public vibes).** On the view-time render path, derive
   Markdown from the SSR HTML, then render that Markdown to **semantic HTML** (headings/lists/
   links — not raw Markdown text) into the **parent** document under the canonical vibe URL, as
   the genuine no-JS / crawler view (humans with JS still get the live iframe). Strict rule:
   never surface iframe HTML directly in the parent — only `HTML → Markdown → trusted renderer`
   with raw-HTML off + URL-scheme allowlist. Solves the cross-origin-iframe SEO gap; see
   [SEO model](#seo--the-iframe-boundary). Gated on `isWorldReadable` (Phase A).
6. **Access-consistent per-viewer SSR (do-later).** Carry viewer identity + grants through the
   view-time quiesce render so the no-JS view is correct per viewer — authorized → granted
   content, unauthorized → the existing no-grant result — with **no fork of the access path**.
   Concretely (per @CharlieHelps review), SSR must call the **same** server-side grant/channel
   visibility evaluator the `getDoc`/`queryDocs` paths use, not an SSR-specific one — the access
   seams are already distributed across `vibe/runtime/access-runner.ts`,
   `api/svc/public/channel-read-filter.ts`, `api/svc/public/app-documents-read-eventos.ts`,
   `api/svc/public/who-am-i.ts`, `api/svc/public/grant-reduce.ts`, so parity drift is the real
   risk. Preserve viewer resolution exactly (`resolve-active-handle.ts` + grant-reduce +
   wildcard-binding behavior), and **explicitly define SSR behavior for cold/empty
   `accessFnOutputs`** (backfill windows) so a render never accidentally widens or hides
   content. Acceptance: authorized vs unauthorized viewers get different, correct no-JS output
   for the same gated vibe, matching the `getDoc`/`queryDocs` visibility decision.

## Slice 2 (this PR) — transform + executor interface

Builds directly on slice 1's `renderVibeToString` (#2823). Everything here lives in
`@vibes.diy/vibe-runtime` (`vibes.diy/vibe/runtime`). Library-only: **no route wiring, no env
plumbing into the real worker, no caching, no data path** — all later slices. The deliverable is
the transform step plus a flag-selectable executor abstraction with the two impls the design
named, and the tests that can run in CI today.

### `transformVibeSource(src) → { module }`

Pure Sucrase TSX→JS. `transforms: ["jsx", "typescript"]`, `production: true`,
`jsxRuntime: "automatic"` — the same options the existing hot-swap path uses
(`register-dependencies.ts` `applyHotSwap`), plus `"typescript"` so `.tsx` type annotations are
stripped. Returns `{ module }` where `module` is the compiled ESM source string. No import-map
resolution here — that is the executor's concern (Node) or the isolate's (Loader). Sucrase is
Workers-safe (no wasm, no `eval`), so this same function runs in both executors.

### `Executor` interface

```ts
interface VibeExecuteInput {
  source: string;
  mountParams: unknown;
} // raw TSX + mount ctx
interface VibeExecuteResult {
  html: string;
}
interface Executor {
  render(input: VibeExecuteInput): Promise<VibeExecuteResult>;
}
```

`source` is raw vibe TSX; each executor calls `transformVibeSource` itself (so the transform is
shared, not duplicated by callers). `mountParams` is the slice-1 `VibeMountParams` shape, passed
straight through to `renderVibeToString`. Both executors converge on the same slice-1 renderer —
deep-imported as `@vibes.diy/vibe-runtime/render-vibes.js` (Node) or imported inside the isolate
module (Loader) — never pulled through the package root (the `react-dom/server` guard test).

- **`NodeExecutor`** — runs the compiled module in this process. `transformVibeSource` → rewrite
  the transform's bare specifiers (`react/jsx-runtime`, `react`, …) to resolved `file://` URLs via
  `import.meta.resolve` (a `data:` URL has no parent path for bare resolution) → dynamic-`import`
  the `data:` URL → take `.default` as the component → `renderVibeToString([Comp], mountParams)`.
  Resolving through the runtime package's own `node_modules` keeps a **single React instance**
  shared with `react-dom/server`, which is what makes hydration-parity markup come out right. This
  is the CI-testable executor and the container fallback. Bare-specifier resolution beyond React
  (full vibe dependency graphs / import maps) is a later slice; slice 2 resolves what
  `import.meta.resolve` can reach, and leaves unresolvable bare specifiers untouched (they throw at
  import time with a clear message rather than silently mis-resolving).

  **Untrusted-fallback carry-forward — Deno (slice 3+).** `NodeExecutor`'s `import()` runs the vibe
  module **in-process with full Node privileges**; `import()`/`vm` is not a sandbox. That is safe
  only while the input is TRUSTED (CI, local dev). The moment a non-edge fallback must render
  _untrusted_ published vibes, this in-process path is unsafe — the Risks section mandates
  per-request isolation for untrusted code. The intended path forward is a sibling **`DenoExecutor`**
  (`VIBES_SSR=deno`): Deno's deny-by-default permission model (`--allow-none` + granular grants,
  process/Worker-per-request) is a real runtime sandbox, and its Web-standard APIs mirror the Worker
  Loader isolate more closely than Node — so the container fallback behaves like the edge target.
  It drops in behind the existing `Executor` interface + flag with no change to the seam; this is a
  sibling executor, not a rewrite. Until then, **do not widen `NodeExecutor` to untrusted traffic**
  (reach for Deno or a process-isolated / microVM runner instead). A code comment in
  `node-executor.ts` carries the same warning at the edit site.

- **`WorkerLoaderExecutor`** — the edge path. `transformVibeSource` → `buildVibeWorkerCode({ module,
mountParams })` shapes a Cloudflare Worker Loader `WorkerCode` (`{ mainModule, modules,
compatibilityDate }`): a `main` module string that imports `renderVibeToString` from
  `@vibes.diy/vibe-runtime/render-vibes.js`, imports the vibe component from a sibling module
  carrying `module`, and `export default { async fetch() }`s the rendered HTML as a
  `text/html` `Response`, with `mountParams` JSON-embedded. The executor then
  `env.LOADER.get(sha, () => workerCode).getEntrypoint().fetch(...)` and returns the response text.
  `sha` is a content hash of the worker code so identical source reuses the isolate. **The
  `env.LOADER` binding is open beta and absent from CI**, so `render()` is guarded behind the flag
  and the binding's presence; we unit-test the pure **`buildVibeWorkerCode` shaping logic** and the
  executor's orchestration against a **fake LOADER binding** (a stub `get`/`getEntrypoint`/`fetch`
  that echoes), never a live isolate load. The slice-2 shape also pins
  `globalOutbound: null` (Worker Loader otherwise inherits the parent worker's network, exposing
  untrusted vibe code to the public Internet — per @CharlieHelps/Codex review); slice 3 replaces
  `null` with a restricted Fireproof-reader binding when the data path needs proxied access.

**Two slice-3 carry-forwards on the Loader path (recorded now, not built in slice 2):**

- **Dependencies must be bundled before a live load.** Worker Loader does not resolve npm
  specifiers, so the `modules` map's `@vibes.diy/vibe-runtime/render-vibes.js` + `react/jsx-runtime`
  imports won't resolve in a real isolate — they must be bundled into `modules` (pairs with bundling
  the reader binding). Documented in `buildVibeWorkerCode`; intentional for the fake-binding-only
  slice-2 path.
- **Keep per-request data out of the hashed module source.** `sha` is a content hash of the worker
  code, and slice 2 JSON-embeds `mountParams` directly into `main`, so request-varying mount context
  forks the isolate cache key and defeats reuse (per @CharlieHelps review). Slice 3 should pass
  per-request `mountParams` via `WorkerCode.env` / the request, not baked into generated source, so
  the hashed code stays stable across requests for the same vibe.

### `VIBES_SSR=off|node|loader` flag

`parseVibesSsrMode(raw): "off" | "node" | "loader"` — unknown/undefined ⇒ `"off"` (the safe
default the Risks section mandates until Loader is GA). `selectExecutor(mode, { loader? })` returns
`undefined` for `"off"`, a `NodeExecutor` for `"node"`, and a `WorkerLoaderExecutor` for
`"loader"` (throwing if no `loader` binding is supplied). No call site wires this into the real
worker yet — that is slice 4; here it is a pure factory with unit coverage.

### File layout & the `react-dom/server` guard

New files in `vibes.diy/vibe/runtime`: `transform-vibe-source.ts` (pure, root-safe),
`vibe-executor.ts` (interface + flag + `selectExecutor`), `node-executor.ts` (deep-imports
`render-vibes.js`, so transitively pulls `react-dom/server`), `worker-loader-executor.ts`
(`buildVibeWorkerCode` + the executor; pulls `react-dom/server` only as a _string_, not an import).
Like `render-vibes.ts`, the executor modules are **not** re-exported from `index.ts` (the client
entry loaded natively in the iframe, where `react-dom/server` is not in the import map). Server
callers deep-import them. The existing `runtime-client-entry-no-server-dom.test.ts` guard is
extended to assert `index.ts` re-exports none of the SSR-executor modules.

### Tests (all CI-runnable today)

- **Node SSR project** (`vibes.diy/tests/app/ssr`, `environment: node`):
  - `transformVibeSource` turns TSX (typed props + JSX) into JS that imports `react/jsx-runtime`
    and strips types.
  - `NodeExecutor.render` of a TSX source returns HTML containing the component output and a
    `mountParams`-derived value (a component reading `useVibeContext()`), proving the executor →
    slice-1 renderer round-trip with `globalThis.window` undefined.
  - `buildVibeWorkerCode` produces a `WorkerCode` whose `main` module deep-imports
    `render-vibes.js`, embeds the transformed module + JSON `mountParams`, and exposes a `fetch`
    default export.
  - `WorkerLoaderExecutor.render` against a **fake LOADER** drives `get → getEntrypoint → fetch`
    and returns the response text (orchestration only; no live isolate).
  - `parseVibesSsrMode` / `selectExecutor`: `off`→`undefined`, `node`→`NodeExecutor`,
    `loader`→`WorkerLoaderExecutor` (and throws without a binding); unknown ⇒ `off`.
- **Guard** (`runtime-client-entry-no-server-dom.test.ts`): `index.ts` does not re-export
  `node-executor` / `worker-loader-executor` / `render-vibes`.

### Out of scope for slice 2 (explicit YAGNI)

Route wiring, caching, OG/meta, the live-query/quiesce data path, full vibe dependency-graph /
import-map resolution in the Node path, a live Worker Loader load, and access-consistent
per-viewer SSR. All deferred to slices 3–6 above.

## Slice 4 (this PR) — route wiring + hydrate marker

**Sequencing note: slice 4 ahead of slice 3.** The follow-up list numbers the data path (3) before
route wiring (4), but route wiring is the _enabler_ — without it the slice-2 executor renders to
nothing a user can see, and the data path (3) can't be exercised end-to-end until a render lands in
a page. Slice 4 is also the higher-confidence cut: it's almost entirely CI-verifiable behind the
default-`off` flag and carries **no** dependency on the beta `env.LOADER` binding, whereas slice 3
needs it plus a Fireproof reader. So we wire the seam first, then slot the data path in behind it.

### Where it plugs in

The vibe iframe document is **already server-rendered React on the Cloudflare Worker**:
`api/svc/intern/render-vibe.ts` assembles a `VibesDiyServCtx` (`vsctx`) and streams
`renderToReadableStream(VibePage(vsctx))` (render-vibe.ts:239). `VibePage`
(`api/svc/intern/components/vibe-page.tsx:65`) emits an **empty** `<div class="vibe-app-container" />`
plus an inline `<script type="module">` (`vsctx.mountJS`) that imports the entry component from
`/~<fsId>~/App.jsx` and calls `mountVibe([App], { usrEnv, viewerEnv, accessFnBindings })` on the
client. The vibe component is _referenced_ here, not executed — the browser fetches it as an asset.

Slice 4 makes the Worker optionally **execute** the entry component server-side and inject its HTML
into the container:

1. **Select the executor** from env in `render-vibe.ts`:
   `selectExecutor(parseVibesSsrMode(env.VIBES_SSR), { loader: env.LOADER })`. `off` (default) ⇒
   `undefined` ⇒ skip SSR, ship today's empty container (exact current behavior, zero risk).
   **Selection is inside the fallback boundary.** `selectExecutor("loader", …)` _throws_ when the
   binding is absent (slice 2's contract), so a **misconfigured** `VIBES_SSR=loader` on a Worker
   without `env.LOADER` must not 500 the page. The route wraps selection **and** render in one
   `exception2Result` (see Fallback discipline): any selection/config failure degrades to the empty
   container exactly like a render failure. (Per Codex review — selection throwing pre-render was a
   real 500 path.)
2. **Acquire the entry source.** The executor needs the entry component's raw TSX. The
   convention-entry items (`/App.jsx` | `/App.tsx`, already resolved at render-vibe.ts:130) carry the
   source bytes served at `/~<fsId>~/<file>`; read those and hand the source to the executor.
3. **Render + inject.** `await executor.render({ source, mountParams })` → `{ html }`. Add a new
   optional `vsctx.ssrHtml`; `VibePage` renders
   `<div class="vibe-app-container" data-vibe-ssr dangerouslySetInnerHTML={{ __html: ssrHtml }} />`
   when present, else the empty `<div class="vibe-app-container" />` unchanged. The injected string is
   exactly `renderVibeToString(comps, mountParams)` (slice 1), and `mountVibe` rebuilds the **same**
   tree — byte-identical by construction, so hydration matches. The outer `VibePage` shell and the
   inner vibe HTML are two independent `react-dom/server` passes stitched via
   `dangerouslySetInnerHTML` (opaque to the shell's React), so there's no cross-render reconciliation.
4. **Tighten `mountVibe` to the marker.** Replace slice 1's `container.hasChildNodes()` heuristic
   with an explicit `container.getAttribute("data-vibe-ssr") !== null` check (the slice-1 spec already
   flagged this as the slice-4 follow-up, per @CharlieHelps on #2823). `hydrateRoot` only when the
   marker is present; empty/marker-less container keeps today's `createRoot` client render.

### Fallback discipline (load-bearing)

SSR is an optimization, never a correctness dependency. The **entire** SSR attempt — executor
_selection_ (which can throw on a missing-binding misconfig), source acquisition, and `render` (which
can throw or time out) — is wrapped in one `exception2Result` in `render-vibe.ts`. On any failure the
route **falls back to the empty container** (client-only render, today's path) and logs a structured
reason — it never 500s the page or blocks first byte. This is the "never add a fallback — fix the real
path" rule's _legitimate_ exception: the client render IS the real path; SSR is additive. A misconfigured
`VIBES_SSR=loader` (flag on, binding absent) therefore renders exactly like `off`, never an error page.

**Structured fallback reasons** (recorded + asserted in tests so regressions are observable, per
@CharlieHelps): `ssr_disabled` (flag `off`/undefined — not a failure, the normal path),
`select_error` (misconfigured loader / selection threw), `source_missing` (no entry source bytes),
`entry_ambiguous` (see below), `relative_import_unsupported` (single-file scope, below),
`executor_error` (render threw / timed out), `ok` (SSR injected). Each non-`ok`/`ssr_disabled`
outcome ships the empty container.

**Explicit behavior on the edges (per @CharlieHelps nits):**

- **HEAD requests do no executor work.** `render-vibe.ts` already returns an empty body for HEAD; the
  SSR attempt is skipped entirely for `method === "HEAD"` (no isolate spin-up just to discard it).
- **Entry resolution is deterministic.** The convention already prefers `/App.jsx | /App.tsx`. SSR
  acts only when there is **exactly one** convention entry: zero → `source_missing` fallback; more
  than one (both `App.jsx` and `App.tsx`, or the old multi-item fallback set) → `entry_ambiguous`
  fallback. No guessing which file is "the" entry.
- **`renderPendingVibe` is untouched.** The pending-vibe path (pre-publish placeholder) never runs the
  executor and never emits the `data-vibe-ssr` marker — SSR is only for the published `renderVibe`
  path.

### Scope decisions (sharp, CI-verifiable cut)

- **Single-file entry first.** A vibe whose `App.{jsx,tsx}` imports sibling files (`./Badge.jsx`)
  needs those modules resolved for the executor too — that is exactly the **relative / full
  dependency-graph resolution** slice 2 explicitly deferred (`NodeExecutor` resolves bare specifiers
  only; the Loader path needs bundling). Slice 4 SSRs **single-file entries** (no unresolved relative
  imports); a vibe with relative imports cleanly **falls back to client-only** (per above) rather than
  rendering wrong. Multi-file SSR rides the slice-2 dep-resolution carry-forward, landed when the data
  path / bundling does.
- **Production stays `off`, and the live route admits ONLY the isolate-backed executor.**
  `NodeExecutor` cannot run on the Cloudflare Worker (it uses `Buffer` / `import.meta.resolve` /
  `data:`-URL import — Node-only); the Worker path needs `WorkerLoaderExecutor` (beta, gated). So in
  prod `VIBES_SSR=off` until Loader is GA — slice 4 lands the **fully-tested wiring + marker contract
  dormant behind the flag**, exactly as slice 2 landed the executors dormant.
  - **SECURITY — `node` is barred from the live render path (per Codex review).** `render-vibe.ts`
    renders **untrusted, persisted** vibe source, and `NodeExecutor` imports it **in-process with full
    Node privileges** (`node:fs`, `process.env`, …). So `render-vibe.ts` maps any non-`loader` mode to
    `off`: only the isolate-backed `loader` executor may ever touch live traffic; `node` would be
    server-side code execution / secret exposure on a node/container deploy. `node` stays a
    **CI/test-only** mode, exercised by calling `attemptVibeSsr` **directly** with trusted test source
    (the merged unit tests) — never through the live route. So `node`-mode CI validates the
    orchestration + marker + fallback contract, NOT live WorkerLoader/edge parity.
- **Caching carry-forward — vary the validator when SSR can change the body (per Codex review).** The
  root-HTML ETag (`serv-entry-point.ts`, keyed on `fsId` + meta) is computed and may 304 **before**
  `renderVibe` runs. While `loader` is unplumbed the live body is **SSR-invariant** (always the
  empty-container shell), so there is no stale-body bug today. But the moment the Loader path enables
  an SSR-varying body, the validator MUST include the SSR mode/version (or bypass early 304s) — else a
  cache that validated the client-only shell keeps getting 304s after SSR is enabled (and stale SSR
  after a rollback). This lands with the Loader-binding plumbing and is already covered by the Phase A
  **"SSR cache-key contract is canonical + complete — any content-affecting change flips the key"**
  acceptance criterion.
- **Caching + OG/meta unchanged this cut.** The serve path already does ETag + `no-cache,
must-revalidate` (unversioned) / `max-age=86400` (versioned), and the ETag already keys on
  `fs.meta`; that's adequate for an SSR payload derived from the same `fsId`+meta. An SSR-HTML
  LRU/Cache-API and content-derived OG/meta are deferred (the latter is the slice-5 Markdown layer).
  No crawler-visible change either: the iframe SSR is still inside the cross-origin sandbox (see SEO
  model) — slice 4 buys **first paint**, not SEO.
- **React-version parity is a hydration prerequisite** (per Codex review). "Byte-identical" only
  holds if the SSR-side React and the React the iframe client hydrates with are the **same version**.
  The client iframe loads React via the import map pinned to `lockedVersions.REACT`
  (`api/svc/intern/grouped-vibe-import-map.ts`), while a server render resolves React from whatever
  the executor's runtime has. So: (a) **CI `node` mode is consistent by construction** — both the
  server render and the browser-project `mountVibe` resolve React from the workspace `node_modules`,
  so the test plan is valid as written; but (b) the **prod Loader path must render with the
  import-map-pinned version**, i.e. `WorkerLoaderExecutor`'s bundled `react`/`react-dom/server` must
  match `lockedVersions.REACT` (this rides the slice-2 "bundle deps before a live load"
  carry-forward — the bundle pins the version). The implementation adds a parity check/assertion so a
  drift between the runtime's React and `lockedVersions.REACT` is caught, not silently shipped as a
  hydration mismatch. (React tolerates patch skew in practice, but the design must not _rely_ on it.)

### Tests (CI-runnable today)

- **Node SSR project** (`tests/app/ssr`, node env):
  - `render-vibe` wiring (with an injected `NodeExecutor` / fake executor): a single-file vibe →
    response HTML contains `data-vibe-ssr` and the component's output inside `vibe-app-container`.
  - `VIBES_SSR=off` (no executor) → empty `<div class="vibe-app-container">`, no marker (regression
    guard on today's behavior).
  - Executor throws → falls back to the empty container, no 500, reason `executor_error`.
  - **Misconfig: `VIBES_SSR=loader` with no `env.LOADER` binding** → selection throws but the route
    catches it → empty container, no 500, reason `select_error` (renders exactly like `off`).
  - A vibe with a relative import → client-only fallback, reason `relative_import_unsupported`.
  - **Entry resolution**: zero convention entries → `source_missing`; both `App.jsx` + `App.tsx`
    present → `entry_ambiguous`; exactly one → SSRs.
  - **HEAD request** → no executor invoked (assert the injected executor's `render` was never called),
    empty body as today.
  - **`renderPendingVibe`** → never emits `data-vibe-ssr`, never calls the executor (regression guard).
- **Browser project** (`tests/app`, real DOM): `mountVibe` hydrates **only** when `data-vibe-ssr` is
  present; a marker-less container with incidental child nodes uses `createRoot` (tightening guard vs.
  the slice-1 `hasChildNodes()` behavior).

### Out of scope for slice 4 (explicit YAGNI)

The live-query/quiesce data path (slice 3), multi-file/relative dependency resolution, an SSR-HTML
LRU/Cache-API, content-derived OG/meta + the Markdown no-JS SEO layer (slice 5), a live Worker Loader
load, and per-viewer access-consistent SSR (slice 6).

## SEO & the iframe boundary

The vibe must run in a cross-origin **sandboxed iframe** for safety (untrusted code execution).
That has a direct SEO consequence: an iframe's content is indexed as **its own document**
(attributed to the sandbox subdomain `myapp--alice.vibesdiy.app`), not folded into the
canonical vibe page (`vibes.diy/vibe/alice/myapp`). Cross-origin + `sandbox` push crawlers
further toward "separate, untrusted resource." So **SSR-into-the-iframe buys first paint, not
SEO** for the URL we care about.

What the iframe boundary does **not** hurt: `<title>` / meta / OG / Twitter tags already live
on the **parent** route (`vibe.$ownerHandle.$appSlug.tsx` `meta()`), which is trusted and
SSR'd today. Social unfurls and the search snippet read the parent `<head>`. The part the
iframe hurts is **crawlable body text attributed to the canonical URL**.

**Key reframing: rendering ≠ executing.** The iframe exists to _execute_ untrusted code
safely. SEO needs _rendered output_ in the parent, not execution. Emitting untrusted output as
**Markdown** (not raw HTML) shrinks the trust boundary: HTML→Markdown is a lossy projection
that drops `<script>`, event handlers, `<style>`, arbitrary attributes as a side effect of the
format — turning "sanitize arbitrary HTML" into "render a Markdown string." Residual edges:
render Markdown with **raw-HTML disabled** (`html:false` / no `rehype-raw`) and **allowlist
link/image URL schemes** (`javascript:`/`data:` survive Markdown). Clean Markdown is also
higher signal-to-noise for crawlers than the app DOM, and doubles as an OG description source
and an LLM/agent-readable artifact.

**It must be view-time, not publish.** The content is hydrated from the DB and mutable, so the
Markdown must reflect live state at request time, run **to quiescence** — it rides the slice-3
per-request execution path. Markdown only buys _safe embedding_; it does nothing for the data
problem, which still mandates view-time execution + a quiesce deadline.

**Two timescales — the server owes only the first:**

1. **View-time freshness** — content as of this request's DB state. Server-rendered (read →
   quiesce → `renderToString` → Markdown). Crawlers, no-JS, first paint need this.
2. **Post-load interaction** — clicks/filters/writes that mutate the view _after_ load. That is
   the live iframe app updating client-side; a crawler never interacts. The server Markdown
   must **not** chase these. So: no server re-derive per interaction.

Shareable/crawlable _interacted_ states must be **URL-encoded** so the server reproduces them
deterministically; ephemeral in-memory state that isn't in the URL is not shareable/crawlable
by definition and stays client-only.

**Access is the mechanism — don't fork it.** Because access gating is consistent client/server,
running the SSR through the **same** access path yields a correct per-viewer no-JS view for
free (authorized → granted content; unauthorized → the existing no-grant result). No
special-casing. The only requirement is to reuse `access-runner` / grants / `canSeeDoc`, not a
parallel implementation.

**Phased scope (decided):**

- **Phase A — public vibes only (`isWorldReadable`).** One shared view per
  `(appSlug, dataVersion, urlState)`; no per-viewer dimension, no access-eval in the isolate.
  This is the right de-risk: it removes both the per-viewer cache explosion and the
  access-in-isolate complexity from the first cut, and public content is exactly what should be
  indexed anyway. The gate is literally `isWorldReadable` — non-public vibes keep today's
  client-only iframe behavior until Phase B.
- **Phase B — access-consistent per-viewer SSR (slice 6, do-later).** Carry viewer identity +
  grants through the quiesce render so authenticated viewers get a correct personalized no-JS
  view via the shared access path.

**The real cost to respect:** Phase A still puts full vibe execution + DB-quiesce on the hot
path of every _uncached public view_, including every crawl — so the protections below are
load-bearing, not nice-to-haves. They're what stop a crawler from melting the render fleet
(refined per @CharlieHelps review):

- **Quiesce deadline**, hard and server-side.
- **Public-render cache.** Key on more than `dataVersion`: `app/runtime version + dataVersion
(or SSR-HTML content hash) + canonical route/search + locale + renderer version`, so a
  renderer or runtime bump can't serve stale-shaped output.
- **Timeout fallback = stale-last-good public render** (when one exists), not an empty page —
  avoids repeated "thin page" crawls degrading the canonical URL. Empty / iframe-fill is only
  the cold-start fallback when there is no last-good render.
- **Load-shedding:** a per-vibe concurrency cap + a global circuit breaker that serves
  stale/fallback fast under pressure.
- **No crawler-only rendering gate** as the primary strategy — that invites parity/cloaking
  risk. Keep one canonical parent output path for humans and bots alike, and control the crawl
  surface with sitemap + `rel=canonical` hygiene instead.

## Phase A acceptance criteria (slices 3–5)

Authored by @CharlieHelps ([#2823 review](https://github.com/VibesDIY/vibes.diy/pull/2823)).
These gate the public-vibe (`isWorldReadable`) cut before it ships.

- [ ] **SSR cache-key contract is canonical + complete**
  - Key includes: `app/runtime version` + (`dataVersion` **or** deterministic `ssrInputHash`) +
    canonical `route/search` + `locale` + `renderer version`.
  - Canonicalization is deterministic (same semantic input ⇒ same key; query-order / ignored-param
    noise does not fork keys).
  - Any content-affecting change flips the key.
  - Unit tests cover key stability + invalidation.
- [ ] **Quiesce-deadline semantics are explicit + enforced**
  - SSR waits for live-query settling only until `quiesceDeadlineMs`.
  - On deadline, render uses the last settled safe snapshot (no unbounded wait).
  - Outcome is recorded as a structured reason (`quiesced` | `deadline` | `error`) plus timing.
  - Tests cover: settles-before-deadline, deadline-hit-with-partial-data, no work admitted after cutoff.
- [ ] **Crawler hot-path fallback is resilient**
  - Timeout/error fallback is **stale-last-good public render**.
  - Empty / iframe-fill fallback only on cold start (no stale render exists).
  - Per-vibe concurrency cap + global circuit-breaker behavior defined and test-covered.
  - No crawler-only render gate; crawl surface controlled via sitemap + `rel=canonical`.
- [ ] **Access parity with app reads is guaranteed**
  - SSR calls the same evaluator path as `getDoc`/`queryDocs` (reuse the seams named in slice 6).
  - Viewer-resolution parity preserved (`resolve-active-handle.ts` + grant-reduce + wildcard binding).
  - Cold/empty `accessFnOutputs` behavior explicitly defined (backfill-safe).
  - Parity tests cover allow/deny, channel-read filtering, wildcard bindings, anonymous vs signed-in.
  - SSR output never includes docs/fields the same viewer could not read through normal app APIs.
- [ ] **Phase A observability + reviewability**
  - Structured logs/metrics include cache outcome, quiesce outcome, fallback path, access-eval mode.
  - At least one end-to-end test proves: warm hit, stale fallback on timeout, hydrate parity on the
    same route.

## Risks / caveats

- Worker Loader is open beta on Workers Paid — confirm production-readiness before it backs
  published vibes; keep `VIBES_SSR=off` the default until then.
- Per-isolate CPU/memory/duration limits still apply — heavy renders need a timeout and a
  client-only fallback.
- Quiesce must have a hard server deadline, else a slow/looping vibe stalls first paint.
- Executing untrusted vibe code server-side is a sandbox-escape surface — per-request isolate
  isolation (exactly what Dynamic Workers give) is mandatory; never a shared isolate.
- Markdown SEO layer: the renderer must run with raw-HTML disabled and URL schemes allowlisted,
  or the format's safety property is lost. The iframe app and the Markdown snapshot must derive
  from the **same** view-time render pass, or they drift across data versions.
- Crawler load: an uncached public view triggers a full execute + DB-quiesce render. Without
  the public-render cache + quiesce deadline, crawl traffic can melt the render fleet.
