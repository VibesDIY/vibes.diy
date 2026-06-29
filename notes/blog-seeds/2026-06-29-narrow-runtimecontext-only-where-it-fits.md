# Narrowing a runtime context only where it actually fits — most "30 call sites" were test harnesses

Source: `claude/fix-2468-trddcp` (Bucket E of the de-fireproof roadmap, issue #2468)

The ask: stop recovering runtime context through the broad `ensureSuperThis()` at "~30 call
sites" and give those paths an explicit, narrow `RuntimeContext` (`Pick<SuperThis, "env" |
"txt" | "nextId">`) instead. The interesting part was triage: of the ~90 grep hits, ~80 were
**test harnesses** legitimately building a full context, and of the ~10 real source sites only
**two** (`appSlug.ts`, `call-ai`'s CLI) used nothing but `nextId()`. The rest pass the recovered
context straight into APIs typed against the full `SuperThis` — the api impl, `QueueCtx`, the
device-id signer/keybag, `sts.env2jwk`, plus `cf-serve` which also seeds a `logger` (not even
part of the narrow contract). The post worth writing: a count like "30 call sites" can be mostly
noise once you separate "depends on broad recovery in a hot path" from "test builds a real
context on purpose," and the honest move is to narrow the two that fit, then *document the
rationale* for the ones that can't — because narrowing them means first narrowing every
downstream signature, which is a separate auth-and-core-touching refactor you don't want to do
without a byte-compat gate. The trade-off: a thin-looking PR that's actually the correct
Phase 1, with an inventory doc that turns "fix the rest" into a scoped follow-up instead of a
risky barrel-ahead.
</content>
