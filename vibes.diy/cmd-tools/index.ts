// @vibes.diy/cmd-tools — the generic cmd-ts streaming/evento framework primitives.
//
// This package owns the domain-agnostic CLI-framework slice that used to live in
// `@fireproof/core-cli`: the progress/streaming message shapes that the vibes-diy
// CLI's message pipeline is built on. It has no fireproof-domain content and
// depends only on `@adviser/cement` + `arktype`, so it lives here in our own tree
// rather than as a cross-org dependency. See VibesDIY/vibes.diy#2895.
//
// These are reimplemented natively (not re-exported from core-cli), which is what
// finally removes the runtime coupling to `@fireproof/core-cli` from the CLI
// framework layer. The shapes are kept byte-for-byte compatible with the
// core-cli@0.24.19 originals (same arktype literals, same `core-cli.progress`
// message type) so consumers and any in-flight messages are unaffected.

import { type } from "arktype";
import type { HandleTriggerCtx } from "@adviser/cement";

// A streamed cmd-ts request/response envelope. `result` is left `unknown` here;
// `WrapCmdTSMsg<T>` narrows it per-command at the call site.
export const CmdTSMsg = type({
  type: "'msg.cmd-ts'",
  cmdTs: type({
    raw: "unknown",
    outputFormat: "'json'|'text'",
  }),
  result: "unknown",
});
export type CmdTSMsg = typeof CmdTSMsg.infer;

export function isCmdTSMsg(u: unknown): u is CmdTSMsg {
  return !(CmdTSMsg(u) instanceof type.errors);
}

export type WrapCmdTSMsg<T> = Omit<CmdTSMsg, "result"> & {
  result: T;
};

// A progress notification streamed alongside the eventual command result.
export const CmdProgress = type({
  type: "'core-cli.progress'",
  level: "'info'|'warn'|'error'",
  message: "string",
});
export type CmdProgress = typeof CmdProgress.infer;

export function isCmdProgress(u: unknown): u is CmdProgress {
  return !(CmdProgress(u) instanceof type.errors);
}

// Stream a progress notification on the same channel as the command's result.
export async function sendProgress<Q, S>(
  ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, Q, S>,
  level: CmdProgress["level"],
  message: string
): Promise<void> {
  await ctx.send.send(ctx, {
    ...ctx.request,
    result: {
      type: "core-cli.progress",
      level,
      message,
    },
  });
}
