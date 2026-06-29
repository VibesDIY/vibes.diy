# An injected fake binding makes a beta-only render path end-to-end testable

Source: `claude/rendervibe-e2e-ssr-test-o5iw6p` (vibe SSR slice 4, #2802 / #2845 checklist item)

Slice 4 wired vibe SSR into the real serve path but left it dormant: `VIBES_SSR=off` by default,
and the live route (`render-vibe.ts`) admits *only* the isolate-backed `loader` executor — `node` is
barred outright because it imports untrusted persisted vibe source in-process with full Node
privileges. The merged unit tests (`attemptVibeSsr`, `VibePage`) cover the pieces, but CharlieHelps'
follow-up condition on #2843 wanted the thing none of them did: a render through the **actual**
`cfServe → serv-entry-point → render-vibe` handler proving the marker + body injection. The catch is
that the only executor the live route trusts needs the Cloudflare `env.LOADER` Worker Loader binding,
which is open beta and absent from CI — so a naive e2e test can't run the path at all.

The unlock was the seam the slice-2/4 PRs had already left open: `params.vibes.loader` (typed
`WorkerLoaderBinding`, structural so it flows without a cast), populated `undefined` in
`create-handler.ts` until the beta binding is plumbed. The test doesn't need a real isolate — it needs
something shaped like one. So the work was a single additive, default-off hook on
`createVibeDiyTestCtx` (`ssrLoader?`): when supplied it flips `VIBES_SSR=loader` in the env map and
sets `params.vibes.loader` to a fake binding whose `getEntrypoint().fetch()` echoes a fixed
`<main>…</main>` — exactly the slice-2 fake-binding shape. Existing tests pass `nothing` and are
untouched. The same fake's `get` calls are recorded in an array, which turns "no executor work" from
an unobservable claim into an assertion: HEAD requests and the `relative_import_unsupported`
fallback both leave the call count flat, while the happy path bumps it.

The lesson worth keeping: when a feature is gated behind infra you can't run in CI, the test surface
you want is usually a binding slot the implementation already exposes for the real plumbing — inject
the fake there, not a mock around it. The trade-off is honest and worth stating in the test's own
header: a fake-binding e2e validates the orchestration, marker, and fallback contract through the real
handler, but **not** live WorkerLoader/edge parity — that still rides the beta binding landing (#2845).
The four edges the design called out (marker+body injection, HEAD does no executor work, pending emits
no marker, relative-import falls back client-only) are now observable regressions instead of prose.
