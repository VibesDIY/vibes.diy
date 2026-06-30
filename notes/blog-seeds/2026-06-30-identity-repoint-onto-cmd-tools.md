# When two extractions converge: repointing identity onto cmd-tools

Source: `claude/implement-2895-4zvy5d` (follow-up to #2899 + #2897)

Two independent extractions out of `@fireproof/core-cli` landed within hours of
each other: #2897 lifted the device-id register flow into `@vibes.diy/identity`,
and #2899 lifted the generic cmd-ts framework slice into a new
`@vibes.diy/cmd-tools` workspace package. They were designed not to block on each
other — so #2897 deliberately left two stopgaps in `identity/device-id/register.ts`:
a **type-only** `import type { WrapCmdTSMsg, CmdProgress } from "@fireproof/core-cli"`
and **module-private copies** of the `sendMsg` / `sendProgress` streaming glue. Both
were the right call at the time (keep zero core-cli *value* imports without a home
to point the glue at yet).

Once #2899 merged, that home existed. This PR is the convergence: `sendMsg` moves
into `@vibes.diy/cmd-tools` next to `sendProgress` (it's the same generic
cmd-evento glue), and `register.ts` imports both helpers plus the `WrapCmdTSMsg`
type from there — deleting both private copies and the last `@fireproof/core-cli`
reference from the module. The interesting angle is the sequencing discipline:
parallel extractions that each carry a small, clearly-labeled stopgap, then a
tiny third PR that collapses the duplication the moment the dependency it was
waiting on exists. The wire-contract `core-cli.*` string literals stay verbatim
(they're the on-the-wire protocol an enrolled device still registers with) — only
the *code path* moved homes. core-cli stays installed only for the `core-cli tsc`
build bin and the deliberate byte-parity test, both separate follow-ups.
