# Test once, deploy twice — making `ship@` front-run the compile_test it already trusted

Source: `claude/deploy-tag-parallel-compile-gpmnpi` (touches `.github/workflows/ship-fanout.yaml`, `agents/deploy-tags.md`)

The deploy workflow already had a clean optimization: a `gate` job looks up whether the exact
commit SHA already has a green `compile_test` check-run, and if so skips the whole `checks + test×4`
matrix. The `ship@<ver>` meta-tag fans one tag out into `vibes-diy@p` + `vibes-diy@c` + `pkg@p` at
the same commit. Put those two facts together and there's a quiet waste: a freshly-merged main
commit usually has *no* green check (ci runs on the PR-head SHA, we rebase-merge, the SHA changes),
so when `ship@` pushed both `vibes-diy@` tags at the same instant, each fired the deploy workflow
and — neither seeing a green check yet — both ran the full sharded suite *in parallel*. Same tests,
twice, racing each other to be the first to land the check nobody would reuse.

The fix needed *zero* changes to the downstream tags, which is the satisfying part: the gate is
already SHA-keyed and source-agnostic, so `ship@` just has to make the green check *exist* before
the child tags fire. So `ship-fanout` now runs the same `gate → checks ‖ test×4 → compile_test`
graph once, on the ship SHA, and only pushes the child tags after it greens. The trick that makes
it free: name the aggregator job exactly `compile_test` — a job's check-run inherits its name, so
the run stamps a `compile_test` check on that commit, which is precisely the string the child
gates grep for.

The gotcha worth the post: the *clean* refactor — extract the test graph into a `workflow_call`
reusable workflow shared by both — would have silently broken it, because reusable-workflow jobs
get their check-runs prefixed (`caller / compile_test`) and the gate matches the name *exactly*.
The boring inline duplication is the correct call here precisely because the magic lives in an
exact-string match on a check-run name. Sometimes DRY is the trap.
