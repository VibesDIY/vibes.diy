# Nominal vs. load-bearing: not every package.json dependency is real

Source: #2937 (`claude/identity-device-id-2937`), with the cautionary tale from #2947

Two `@fireproof` removals, opposite outcomes — and the difference is whether
anything actually *imports* the package. Removing `@fireproof/core-types-base`
from five SDK packages was a no-op risk: zero importers repo-wide, so nothing
could fail to resolve. Removing `@fireproof/use-fireproof` from the host
(#2947) *looked* identical but broke CI — because those deps were silently
**public-hoisting** `@fireproof/core-device-id` to the repo root, and a test in
`api/tests` resolved through that hoist.

The angle worth a post: a dependency declaration can be (a) genuinely imported,
(b) a nominal/stale pin nobody imports, or (c) load-bearing *only* via the hoist
it provides for some other under-declared package. The grep that tells them
apart — `git grep 'from "@fireproof/x"'` (imports) vs `git grep '"@fireproof/x"'
-- '**/package.json'` (declarations) — and why the gap between those two counts
is where the bodies are buried in a monorepo dependency cleanup.
