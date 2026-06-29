# The executor seam: running a vibe's code where there's no `eval`

Source: `claude/nice-bell-ujv4th` — slice 2 of vibe SSR (#2802): the transform
step plus a flag-selectable `Executor` abstraction with Node + Worker-Loader
impls, building on slice 1's `renderVibeToString` (#2823).

The design splits vibe SSR into two halves: **render** (pure, runtime-agnostic,
shipped in slice 1) and **execute** (run untrusted freshly-compiled vibe code in
isolation, then call the renderer). Slice 2 builds the execute half as an
interface with two implementations behind a `VIBES_SSR=off|node|loader` flag —
`off` by default, so nothing lights up until the Cloudflare binding is GA.

Worth a note:

- **A `data:` URL module has no parent path, so Node can't resolve its bare
  imports.** Sucrase compiles a vibe to ESM that still `import`s
  `react/jsx-runtime`. Load that as `data:text/javascript;base64,…` and Node
  throws on the bare specifier — there's no directory to resolve against. Fix:
  rewrite the transform's bare specifiers to absolute `file://` URLs via
  `import.meta.resolve` _before_ the data-URL import. Bonus: resolving through
  the runtime package's own `node_modules` guarantees a **single React
  instance** shared with `react-dom/server`, which is exactly what makes the SSR
  markup match what the client hydrates.

- **Regex-rewriting imports is safe only because Sucrase's output is
  deterministic.** The bare-specifier rewrite targets `import … from "x"` and
  side-effect `import "x"` with a pattern tight enough to skip dynamic
  `import("x")` (next char is `(`, not a quote) and to stay inside one
  import/export statement (`[^"';]*?` between the keyword and `from`). It's not a
  general ESM parser — it leans on the compiled shape. Unresolvable specifiers
  are left untouched so they throw a clear error at import time rather than
  silently mis-resolving. Full vibe dependency-graph resolution is a later slice.

- **You can unit-test a beta binding you don't have — just not a live load.** The
  `env.LOADER` Worker Loader binding is open beta and absent from CI, so
  `WorkerLoaderExecutor.render` can't load a real isolate. But the part worth
  testing is the **`WorkerCode`-shaping** (a main module that deep-imports
  `render-vibes.js`, embeds the compiled vibe + JSON `mountParams`, and exports a
  `fetch` handler) and the **`get → getEntrypoint → fetch` orchestration** —
  both exercised against a fake binding that echoes a `Response`. The isolate is
  the only untestable atom; everything around it is pure.

- **The `react-dom/server` guard grows with the package.** Slice 1's guard test
  pins the client entry (`index.ts → mount-vibes.ts → vibe-tree.ts`) free of
  `react-dom/server` — the vibe iframe loads the package natively and that
  module isn't in its import map. The new executors reach `react-dom/server`
  (NodeExecutor deep-imports the renderer; the Worker Loader code embeds it as a
  string), so the guard now also asserts `index.ts` never re-exports them.
  Server callers deep-import. The same off-the-root discipline, one slice wider.
