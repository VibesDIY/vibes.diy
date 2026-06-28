# The flaky test that wasn't about its own code

**Hook:** A pure-function test (`copyable-toaster.test.tsx`, which only checks three
string helpers) kept failing CI with "Failed to import test file" — but only on *some*
branches, for *some* agents, never tied to a code change. It blocked a prod npm publish
(`pkg@p2.6.14`) even though prod + cli had already shipped the same commit green.

**Source:** extracted the pure helpers into `copyable-toast-logic.ts` (React-free, `Toast`
imported as a *type* only) and moved the unit test to the node `pkg-infra` project
(`vibes.diy/pkg/test/`). Deleted the old browser test.

**Why / the gotcha:** The `tests/app` browser project runs with `isolate: false` to amortize
browser setup — all 51 files share one worker page + module graph. A pure-logic test had no
business there: it only lived in the browser project because it imported the `.tsx` component
to reach three exported helpers, which transitively pulls in `react-hot-toast`. In a shared
worker whose graph a sibling file had perturbed, that top-level import would intermittently
throw → "Failed to import test file." The victim is whoever the scheduler co-locates, so it
moved by SHA and by agent.

**The trap I fell into:** the first instinct was a one-line `optimizeDeps.include` fix — the
isolation repro printed a `react-hot-toast` re-optimize + reload warning, and vitest itself
recommends pre-bundling. It made the *isolated* run clean… but isolation never reproduces a
shared-worker flake. CI still failed identically. **A green isolated run is not evidence
about a cross-file `isolate: false` bug**, and I can't reproduce CI's exact scheduling
locally. The only deterministic fix is to remove the file from the shared graph entirely:
pure logic belongs in a node project.

**Trade-off:** decoupling means one more tiny module + a re-export so existing importers
(`PreviewApp`) keep their path. Cheap, and the test now runs in 129ms in node instead of
~5s in a browser — and can never be a contamination victim again.
