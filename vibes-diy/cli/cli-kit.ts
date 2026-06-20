// CLI-framework (cmd-ts) seam. The single point where the vibes-diy CLI couples
// to @fireproof/core-cli's progress/streaming primitives. Import these from here,
// never from "@fireproof/core-cli" directly, so the coupling stays contained and
// the internals can be swapped (native cmd-ts glue, or another framework) behind
// this boundary. core-cli remains the internal backing for now.
//
// Only the three value exports are runtime coupling; the three type exports erase
// at build. See docs/superpowers/specs/2026-06-20-cli-framework-seam-design.md (#2470).
export { isCmdProgress, isCmdTSMsg, sendProgress } from "@fireproof/core-cli";
export type { CmdProgress, CmdTSMsg, WrapCmdTSMsg } from "@fireproof/core-cli";
