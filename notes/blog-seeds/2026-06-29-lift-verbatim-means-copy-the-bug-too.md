# Lift-verbatim means copying the bug too — byte-compat over correctness

Source: `claude/bucket-e-phase4-t2-hashing` (Bucket E Phase 4 Task 2, issue #2468)

The first real cutover of the identity crypto lift: move `hashStringSync`/`hashStringAsync`
(keybag store keys), `hashObjectAsync` (the device-cert `subjectKeyIdentifier`), `hashObjectSync`,
and `deepFreeze` out of `@fireproof/core-runtime` into an in-repo module. The whole job is a
verbatim copy — XXH64→base58 for the sync hash, dag-json+sha256→CIDv1 for the async one — and
the discipline that matters is *resisting the urge to fix things on the way through*. Upstream's
`hashObjectSync` has a `"Symbol"` branch that hashes the literal string `S:(x as symbol).toString()}`
— clearly a copy-paste escape that was meant to interpolate the symbol. It's a bug. You copy it
anyway, with a comment explaining why, because the keybag filenames and cert identifiers that
real users have on disk were computed *with* that bug; "correcting" it would silently relocate
every keybag and invalidate every cert. The gate that proves the lift is the golden test that
was already there: `keybag-golden` pins `base58btc(hashStringSync("FIREProof:deviceId"))` to the
literal `z3QkefAC57rcrs.json`, so a one-byte hash drift fails loudly — and the cross-check added
here asserts `extracted(x) === fireproof(x)` across strings and objects so the equality is the
test's explicit claim, not a side effect. The post worth writing: in a wire-format lift, the
test of a good copy is that it reproduces the original's mistakes, and the cheapest proof of that
is a golden value captured before you touched anything.
