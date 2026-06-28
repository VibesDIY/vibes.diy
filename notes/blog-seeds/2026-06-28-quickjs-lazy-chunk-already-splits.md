# The dynamic import that already did the right thing — and a test that doesn't need a build

Source: #2714 Spec B Phase A (branch `claude/spec-b-phase-a-quickjs-lazy-load`)

The design feared a fight with the bundler. To keep a lean shared/read Durable
Object from re-parsing QuickJS on a cold-isolate wake, we needed QuickJS out of
the worker entry chunk — and the architecture doc said to reach for wrangler's
`find_additional_modules` + `rules`. But this worker is bundled by **Vite +
`@cloudflare/vite-plugin` (Rollup)**, where that esbuild knob doesn't apply. So
the plan staged an escalation ladder: bare `import()` → `manualChunks` → the
plugin's wasm handling → wrangler. Rung 1 won outright: converting the static
top-level `import { getQuickJSWASMModule }` to `await import("@cf-wasm/quickjs")`
at the call site was enough — Rollup's default dynamic-import code-splitting put
the entire 622 kB of QuickJS glue (and the 503 kB `RELEASE_SYNC.wasm`) into their
own chunks, leaving the entry with nothing but the `import()` reference. Zero
extra config. The scariest task in the plan was a one-liner.

Two angles worth a post:

1. **Verify the bundle, not the source — but make the source the CI gate.** The
   real property ("a shared instance never parses QuickJS") is a *build-output*
   fact: is the glue in the entry chunk or a lazy one? You can only see that in
   the built bundle. But `pnpm check` here is tsc + vitest — it never builds the
   worker, so a test that needs the bundle would just be skipped in CI and rot.
   The fix is two-layer: an always-on **source invariant** (no worker file may
   *statically value-import* `@cf-wasm/quickjs` — the only way the glue re-enters
   the entry graph) that runs in CI as the regression guard, plus a **bundle
   assertion** that `skipIf`s when no build is present and runs locally / in build
   jobs for the empirical confirmation. The cheap proxy guards the expensive
   truth.

2. **A comment can break a regex that scans for imports.** First cut of the
   source guard, `/import\s+(?!type)[^;]*?from\s+["']@cf-wasm\/quickjs["']/`, kept
   flagging the file that was *correctly* using `import type` + dynamic import.
   Cause: a doc comment above the import contained the word "import," and `[^;]*?`
   happily bridged across the comment (no semicolons in comments) to the real
   statement's `from "..."`. Strip comments before matching source. Lazy
   quantifiers + comment text = false positives that look like real violations.

Bonus measurement that motivated all this: a Durable Object **constructor**
re-runs on every hibernation wake, but **global/top-level scope** re-runs only
when the *isolate* is recreated — and the isolate isn't guaranteed warm across a
hibernation, so a static heavy import is a tax you can pay again and again. The 1 s
startup budget is real; the repo already lazy-inits its React Router handler to
dodge "error 10021."
