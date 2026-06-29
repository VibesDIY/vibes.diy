# The param slot that has to exist before a beta binding can

Source: `claude/vibe-ssr-loader-binding-wiring` — slice 4 of vibe SSR (#2802):
thread the Worker Loader (`env.LOADER`) binding through the api worker's params
so `render-vibe` can hand it to the SSR executor.

After the render-vibe wiring merged, `attemptVibeSsr` was being called with
`loader: undefined` hard-coded — the isolate executor could never run because
nothing could give it a binding. This change adds the seam: `VIBES_SSR` flows
from the env schema into `params.vibes.env`, and a new `params.vibes.loader`
slot carries the binding (populated `undefined` for now). `render-vibe` reads
`vctx.params.vibes.loader` instead of a literal.

Worth a note:

- **A beta binding you can't test yet still needs its plumbing landed first.**
  The `env.LOADER` Worker Loader binding is open beta and isn't in wrangler, so
  there's nothing real to populate the slot with. But the *slot* is the
  prerequisite for everything downstream — populating it from the Cloudflare
  bindings object, injecting a fake one in an e2e test, flipping the flag. Land
  the seam behavior-neutrally (slot present, value `undefined`) so the next
  step is a one-line population, not a type+wiring refactor on the hot path.

- **Behavior-neutral by construction.** `loader` stays `undefined`, so
  `VIBES_SSR=loader` still degrades to client-only via `select_error` exactly as
  before — the diff changes types and threading, not what any request does. That
  keeps a production-path change safe to land while the executor stays dormant.

- **A type can cross a package boundary even when a value shouldn't.** The
  `WorkerLoaderBinding` type lives in `vibe-runtime` (server-only, off the client
  entry). The api params type needs it, so it's imported `import type` relatively
  — erased at runtime, so it adds no real coupling and never reaches the browser
  bundle, while still giving the param slot a precise shape instead of `unknown`.

- **The env var and the binding take different routes.** `VIBES_SSR` is a string,
  so it rides the existing env-schema → `params.vibes.env` path. `LOADER` is a
  binding object, which can't travel as an env string — it needs its own param
  field populated from the Cloudflare bindings object at the worker bootstrap
  (the deferred half). Same feature, two plumbing paths.
