# A parity test that ships with its own expiry date

Source: `jchris/retire-core-cli-seams` (#2906) — the identity half of retiring
`@fireproof/core-cli` after the build-tool lift (#2904).

The device-id register flow was lifted into `@vibes.diy/identity` verbatim from
`@fireproof/core-cli`. To prove the lift was byte-equivalent, someone wrote a
**differential parity test** that ran the same inputs through *both* the old
external impl and the new in-repo one and asserted they agree. The clever part
wasn't the test — it was the header comment, which named its own deletion
condition: *"delete it once core-cli is removed (#2483), at which point
`register-golden.test.ts` remains the standalone gate."*

Worth a note:

- **A parity-vs-external test is load-bearing scaffolding, not permanent
  coverage.** Its whole job is to import the thing you're trying to delete. Keep
  it and you can never drop the dependency; delete it blindly and you lose the
  cross-check. The fix is to pair it with a *self-contained* golden test from day
  one and write the hand-off into the parity test's own header — so the agent who
  finally removes the dep knows exactly which test dies and which one stays.

- **"Decouple the package" turned out to be one type-only import.** Identity's
  remaining tie to `@fireproof/core-cli` was a single `import type { WrapCmdTSMsg,
  CmdProgress }` — already type-only, already erased at runtime. Re-point it at the
  monorepo-owned `@vibes.diy/cmd-tools` (same shapes), delete the parity test, swap
  the build bin to `@vibes.diy/build-cli`, drop the dep. The "runtime coupling" was
  a ghost; the real work was retiring the scaffolding that still named it.

- **Down to one declaration — and it's a *command*, not a *symbol*.** After this,
  only `vibes-diy` still declares `@fireproof/core-cli`, and not because any code
  imports it: the deploy pipeline runs `core-cli writeEnv` to push worker secrets,
  and `writeEnv` pulls `@fireproof/core-runtime`. The last mile of a dependency
  retirement isn't always a library import you can re-point — sometimes it's a CLI
  *command* your deploy scripts shell out to, which needs its own rehome (and its
  own design call, since deploy tooling can't be exercised by PR CI).
