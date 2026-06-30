// CLI-framework (cmd-ts) seam. The single point where the vibes-diy CLI couples
// to the cmd-ts progress/streaming primitives. Import these from here, never from
// the backing package directly, so the coupling stays contained behind this
// boundary and the internals can be swapped without touching call sites.
//
// The backing is now our own @vibes.diy/cmd-tools workspace package — a native
// reimplementation of the generic cmd-ts framework slice that used to live in
// @fireproof/core-cli. This removes the runtime coupling to @fireproof/core-cli
// from the CLI framework layer. See VibesDIY/vibes.diy#2895 and
// docs/superpowers/specs/2026-06-20-cli-framework-seam-design.md (#2470).
export { isCmdProgress, isCmdTSMsg, sendProgress } from "@vibes.diy/cmd-tools";
export type { CmdProgress, CmdTSMsg, WrapCmdTSMsg } from "@vibes.diy/cmd-tools";
