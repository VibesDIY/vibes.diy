# The local config that turned a blind crypto lift into a tested one — and a mutation to prove the gate

Source: `claude/bucket-e-phase4-t3-sts` (Bucket E Phase 4 Task 3, issue #2468)

T3 was the scary one: lift the `sts` JWK/JWT crypto (`importJWK`/`env2jwk`/`jwk2env`/`verifyToken`
+ the PEM coercion and well-known-JWKS fetch) out of `@fireproof/core-runtime` — the actual
token sign/verify path. Every prior phase note said "CI is the only gate" because the api/identity
suites run under vitest's Playwright browser provider, which isn't provisioned in cloud worktrees.
That turned out to be only half true: `vibes.diy/identity/vitest.config.ts` is a *plain node*
config (`environment` defaults to node), so `cd vibes.diy/identity && vitest run` executes the
identity suite locally without a browser. The lift became testable: a cross-verification golden
(`sts-golden.test.ts`) that runs every lifted function against the fireproof original on shared key
material — `jwk2env` byte-equal, `importJWK` same alg, `env2jwk` cross-decodes both directions, a
real ES256 JWT verifies under both, a forged token is rejected by both — 39 identity tests green in
1.3s. The post worth writing has two halves. First: "CI is the only gate" is a claim worth
re-checking per-package, because the difference between a blind lift and a verified one was one
config file I hadn't looked at. Second: a passing golden test proves nothing until you've watched it
fail — so the discipline is to mutate the critical section and confirm the red. One stray `+ "x"` in
`jwk2env`'s wire encoding turned two tests red (byte-inequality, and fireproof refusing to decode the
drifted env material); revert, green again. The mutation isn't paranoia, it's the only evidence that
the gate you're trusting with "no forced re-login for any user" actually has teeth.
