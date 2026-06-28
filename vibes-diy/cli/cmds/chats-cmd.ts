import { command, optional, positional, string } from "cmd-ts";
import { CliCtx } from "../cli-ctx.js";

const SPLIT_MESSAGE =
  "'vibes-diy chats' has been split into two commands:\n" +
  "  vibes-diy codegen-log  — the build transcript (what 'chats --response' used to show)\n" +
  "  vibes-diy app-chats    — the deployed app's runtime in-app chats\n" +
  "Please update your command and re-run.";

export function chatsCmd(_ctx: CliCtx) {
  return command({
    name: "chats",
    description: "(removed) Use 'codegen-log' or 'app-chats' instead.",
    args: {
      // Accept up to two optional positionals so the command resolves (rather
      // than printing a generic "unknown argument" error) regardless of what
      // the caller passes. Any flags the caller adds are silently absorbed by
      // cmd-ts's unknown-arg handling at the subcommand level.
      arg1: positional({
        displayName: "arg1",
        description: "ignored",
        type: optional(string),
      }),
      arg2: positional({
        displayName: "arg2",
        description: "ignored",
        type: optional(string),
      }),
    },
    handler: () => {
      throw new Error(SPLIT_MESSAGE);
    },
  });
}
