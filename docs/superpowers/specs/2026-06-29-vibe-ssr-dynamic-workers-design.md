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
3. **Live-query / quiesce data path.** Pass the isolate a Fireproof reader binding/RPC via
   `WorkerCode.env` (or proxy sync via `globalOutbound`); run the vibe's live queries to
   quiescence behind a hard server-side deadline, then render. Cache key becomes
   data-versioned `(appSlug, groupId, dataVersion)` — this is why publish-time pre-render
   (the old "option 2") cannot stand alone.
4. **Route wiring + caching + OG/meta + no-JS fallback.** Inject SSR HTML into the
   `vibe-app-container` (with a `data-vibe-ssr` marker so `mountVibe` hydrates only a real SSR
   payload, not incidental child nodes — replaces the slice-1 `hasChildNodes()` heuristic),
   emit per-vibe meta/OG tags, hydrate on the client, LRU/Cache-API the rendered HTML.

## Risks / caveats

- Worker Loader is open beta on Workers Paid — confirm production-readiness before it backs
  published vibes; keep `VIBES_SSR=off` the default until then.
- Per-isolate CPU/memory/duration limits still apply — heavy renders need a timeout and a
  client-only fallback.
- Quiesce must have a hard server deadline, else a slow/looping vibe stalls first paint.
- Executing untrusted vibe code server-side is a sandbox-escape surface — per-request isolate
  isolation (exactly what Dynamic Workers give) is mandatory; never a shared isolate.
