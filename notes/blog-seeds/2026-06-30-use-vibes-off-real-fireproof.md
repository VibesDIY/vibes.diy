# The published SDK was carrying a database engine it never ran

Source: `claude/validate-2952-k6ujwy`

`use-vibes` — the SDK external vibe authors `import` — declared and bundled
`@fireproof/use-fireproof` + `@fireproof/core`, the *real* local-first Fireproof
engine. The interesting part: tracing every value import showed that engine is
**never executed in production**. In the vibe iframe an import map rewrites
`use-vibes`/`use-fireproof` → `@vibes.diy/vibe-runtime` (Firefly, the
server-backed runtime) *before* the module loads, so the SDK's custom
`useFireproof()` wrapper, `toCloud()`, and the cloud-attach plumbing never get a
turn. Outside the iframe the wrapper's first line (`useVibeContext()`) throws.
The only real-Fireproof value imports left were a default param on the ImgGen
hook (always injected/aliased) — everything else was already Firefly or
types-only (the `fireproof()` node factory had quietly migrated to
`FireflyDatabase` a while back).

So this wasn't a refactor, it was a decision: keep a real DB the SDK doesn't run,
or delete it. We deleted — re-exporting `useFireproof` straight from the runtime
so the npm package and the iframe agree on one surface, and dropping `toCloud`
(Firefly *is* the cloud; the runtime already no-ops `attach`). The angle worth
writing up: **"vestigial" is a claim you have to earn by tracing, not assume.**
The trade-off is a contract break — anyone who imported the raw Fireproof surface
(`toCloud`, `ImgFile`, the `Fireproof` type namespace) loses it, so it ships as a
major. The gotcha that kept this from being a one-line dep bump: dropping
`@fireproof/core` is hoist-sensitive — it can be the package an under-declared
consumer silently resolves *through* — so the manifest drop has to clear a
frozen-install + full docker test matrix, not just a green local build.
