# Knowing when the next phase is a plan, not a PR — the risk gradient inside one refactor

Source: `claude/bucket-e-phase4-plan` (Bucket E Phase 4, follows #2826/#2833/#2834 / issue #2468)

Bucket E shipped three code PRs in a row, each one a safe mechanical move that `tsc` fully
validated: narrow two call sites, swap 74 imports, delete 18 dead deps. The natural momentum
says PR #4 is more of the same. It isn't. Phase 4 is the part that *reimplements* the auth
crypto still pinning `@fireproof/core-runtime` inside the identity package — device-cert
hashing, keybag lookup keys, the JWT/JWK sign+verify. Three things flip the risk profile at
once: (1) a one-byte drift forces re-login for every user (no `tsc` catches that — only a
byte-for-byte golden harness does); (2) slicing it by symbol *adds* `multiformats` +
`ts-xxhash` before it removes `core-runtime`, so partial progress is net-negative dep churn;
and (3) the gating golden tests run under a browser provider that isn't provisioned in cloud
worktrees, so I literally can't verify locally — CI is the only gate. The post worth writing:
the discipline isn't "always ship code," it's noticing the exact commit where the work crosses
from refactor into reimplementation-of-a-wire-format, and downshifting to a lift-verbatim plan
with provenance and cross-verification gates *before* writing a line of crypto. The audit that
makes the plan real is cheap and worth doing inline — grepping every `sthis.<member>` the
identity code touches (it needs `pathOps`, `start()`, and env mutation, not just the narrow
`env/txt/nextId` context) pins the contract the in-repo runtime must satisfy before anyone
builds it.
