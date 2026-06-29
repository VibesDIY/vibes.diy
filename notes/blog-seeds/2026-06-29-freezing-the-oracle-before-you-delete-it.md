# Freezing the oracle before you delete it — how a cross-check survives losing its other half

Source: `claude/bucket-e-phase4-t5-drop-core-runtime` (Bucket E Phase 4 T5, the finish — Fixes #2468)

The whole de-fireproof effort came down to one awkward dependency: the byte-compat tests that
proved the lifted hashing/sts/SuperThis matched `@fireproof/core-runtime` *imported
`@fireproof/core-runtime`*. You can't drop the dep while your proof depends on it. The move is
to freeze the oracle: with the live dep still installed, run a one-shot probe that captures the
exact fireproof outputs for a set of fixed inputs — hash strings/objects, base64/base58 of fixed
strings, the deterministic `timeOrderedNextId` time-prefix, a frozen ES256 keypair and its
`jwk2env` encoding — and write them into a `golden-fixtures.ts`. Then every `extracted == fireproof`
cross-check becomes `extracted == frozen fixture`, the `@fireproof/core-runtime` import disappears,
and the dep can finally leave (`pnpm` resolves zero `@fireproof/core-runtime` repo-wide). The
subtlety worth the post: this is only sound because the *live* equivalence was already gated in CI
across the earlier PRs — T5 isn't re-proving the match, it's *locking* an already-proven one, which
is exactly what a golden test is for. The other thing T5 had to get right was the inverse of the
T4 bug: the consumer-surface gate. Before deleting the dep, grep every `sthis.<member>` any
consumer in the repo touches and diff it against what the in-repo `SuperThis` actually provides;
the diff has to be *empty*, with the proof in the PR, because a thin context that's missing one
method (a `timeOrderedNextId`, an `env.sets`) wouldn't fail to compile against the cast — it would
just strand a production path at runtime. Capture the contract, freeze the oracle, prove the
surface, then delete.
