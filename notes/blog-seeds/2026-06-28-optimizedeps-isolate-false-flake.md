# A one-line vitest fix for a flake that broke npm publishes

**Hook:** A pure-function test (`copyable-toaster.test.tsx`, which only checks three
string helpers) kept failing CI with "Failed to import test file" — but only on *some*
branches, for *some* agents, never deterministically tied to a code change. It blocked a
prod npm publish (`pkg@p2.6.14`) even though prod + cli had already shipped the same commit
green.

**Source:** `vibes.diy/tests/app/vitest.config.ts` — added `react-hot-toast` to
`optimizeDeps.include`.

**Why / the gotcha:** The tests/app browser project runs with `isolate: false` to amortize
browser setup across files (one shared worker page + module graph). `react-hot-toast` was
*not* in `optimizeDeps.include`, so the first test to import it triggered a Vite dependency
re-optimization **mid-run**, which forces a reload. Under `isolate: false` that reload
corrupts the in-flight import of whichever file is loading — surfacing as a flaky
"Failed to import test file" on a file that itself never changed. The victim file is
whoever the scheduler put in the poisoned worker, so it moves around by SHA and by agent.
The isolation repro made it obvious: vitest printed `✨ new dependencies optimized:
react-hot-toast` → `optimized dependencies changed. reloading` → `Vite unexpectedly
reloaded a test`. Vitest literally recommends the fix (add to `optimizeDeps.include`).

**Trade-off:** The tempting fix was to decouple the pure test from the React component so it
stops importing `react-hot-toast`. That only moves the flake — some *other* browser test
imports the real component and re-triggers the same mid-run optimize. Pre-bundling the dep
up front fixes it for every importer, deterministically, in one line.

**Meta-lesson:** "passes on 2.6.13, fails 2/2 on 2.6.14, unchanged file" is the signature of
shared-state/scheduler flake, not a code regression. Don't bisect the diff — reproduce in
isolation and read the tooling's own warning.
