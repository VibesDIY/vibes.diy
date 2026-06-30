// @vibes.diy/cmd-harness — the shared cmd-ts runtime harness.
//
// build-cli, deploy-cli (and any future command CLI) used to each carry their
// own byte-identical copies of this plumbing. It lives here once so the copies
// can't silently drift. The domain-agnostic wire protocol (CmdProgress /
// CmdTSMsg / sendMsg / sendProgress) stays owned by @vibes.diy/cmd-tools and is
// re-exported here for convenience, so command packages have a single import.
// See VibesDIY/vibes.diy#2926.
export * from "@vibes.diy/cmd-tools";
export * from "./cli-ctx.js";
export * from "./create-cli-stream.js";
export * from "./cmd-evento.js";
export * from "./run-cli.js";
