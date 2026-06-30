# Making the vibe-SSR loader path real: binding, bundle, cache-key

- **Branch / PR:** `claude/2845-status-t5c3za` — #2845 (checkboxes 1–3)
- **Hook:** The slice-4 SSR wiring had been dormant since #2835/#2843: `VIBES_SSR=loader`
  always degraded to client-only because `params.vibes.loader` was hard-`undefined`,
  and even if you handed it a binding, the isolate couldn't load — Cloudflare's Worker
  Loader doesn't resolve npm specifiers, so `react` / `react-dom/server` / `render-vibes.js`
  imports dangled. This lands the three prerequisites that flip it from "fully tested,
  never runs" to "runs, given the beta binding."

## The trade-off / why

Three independent seams, one goal:

1. **Binding plumbing (cb1).** `env.LOADER` is a binding *object*, not a string, so it
   can't ride the string `env` map — it gets its own param threaded
   `cf-serve.ts → createAppContext → params.vibes.loader`. Behavior-neutral until the
   binding actually exists on the deploy.

2. **Dep-bundling (cb2) — the keystone.** The isolate `modules` map is a flat
   key→source lookup with no npm resolution. The hard part isn't bundling, it's *one
   React instance*: react-dom/server and the vibe's own hooks must share it or hydration
   breaks. The design that survives Worker-Loader's (unverified-without-the-binding)
   module resolution: **one self-contained esbuild bundle** (render-vibes + react-dom/server
   + arktype + React, all inlined) that *also* re-exports React's names + jsx/jsxs, plus
   two thin `react` / `react/jsx-runtime` shim modules that re-export from it by bare key.
   Every cross-module edge is then an unambiguous bare-specifier lookup — no relative-chunk
   paths whose edge resolution we can't test here.

3. **Cache-key (cb3).** The root-HTML ETag is computed from `fsId`+meta *before* `renderVibe`
   runs. The moment the body becomes SSR-varying, that validator would 304 a stale shell.
   So the validator folds in an SSR signature — and the load-bearing subtlety is that the
   body only varies when `VIBES_SSR=loader` **and** the binding is present; keying on the
   flag alone leaves a stale-body hole for when the binding lands later.

## Gotcha worth a post

`export * from "react"` silently drops React's CJS named exports (`useState`, `Fragment`)
as static ESM bindings — a hook-using vibe renders `undefined`. You have to **enumerate**
React's export names at build time and re-export them explicitly. And because the live
`env.LOADER` beta binding is absent from CI, the strongest proof obtainable is laying the
exact `WorkerCode.modules` map out on disk (each key as the module a bare specifier resolves
to) and rendering a hook-using vibe in Node — which catches the single-instance and
named-export bugs, but *not* live edge resolution. That last mile is a human-deploy gate,
and it's worth being honest about which rung of the verification ladder a green test buys you.
