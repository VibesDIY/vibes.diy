import { command, flag, option, optional, positional, string } from "cmd-ts";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";

const SPLIT_MESSAGE =
  "'vibes-diy chats' has been split into two commands:\n" +
  "  vibes-diy codegen-log  — the build transcript (what 'chats --response' used to show)\n" +
  "  vibes-diy app-chats    — the deployed app's runtime in-app chats\n" +
  "Please update your command and re-run.";

export function chatsCmd(ctx: CliCtx) {
  return command({
    name: "chats",
    description: "(removed) Use 'codegen-log' or 'app-chats' instead.",
    // Every historical positional and flag is declared as an ignored no-op so
    // that any legacy invocation — e.g. `chats <vibe> <chatId> --response` —
    // parses successfully and reaches the handler, which prints the migration
    // message. Without these, cmd-ts rejects the unknown flags ("Unknown
    // arguments") before the handler runs and the user never sees the guidance.
    args: {
      // --api-url / --json / --text (shared defaults the old command accepted).
      ...cmdTsDefaultArgs(ctx),
      // Up to two positionals: the old `<vibe> [chatId]` shape.
      arg1: positional({ displayName: "vibe", description: "ignored", type: optional(string) }),
      arg2: positional({ displayName: "chatId", description: "ignored", type: optional(string) }),
      vibe: option({
        long: "vibe",
        description: "ignored",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      handle: option({
        long: "handle",
        description: "ignored",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      // The legacy `--response` family (codegen deep-read flags).
      response: flag({ long: "response", short: "r", description: "ignored" }),
      raw: flag({ long: "raw", description: "ignored" }),
      files: flag({ long: "files", description: "ignored" }),
      jsonl: flag({ long: "jsonl", description: "ignored" }),
      user: flag({ long: "user", description: "ignored" }),
      turn: option({ long: "turn", description: "ignored", type: optional(string) }),
    },
    handler: () => {
      throw new Error(SPLIT_MESSAGE);
    },
  });
}
