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
