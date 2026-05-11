import { subcommands } from "cmd-ts";
import type { CliCtx } from "../../cli-ctx.js";
import { dbListCmd } from "./list-cmd.js";

export { dbListEvento, isResDbList, type ResDbList } from "./list-cmd.js";

export function dbSubcommands(ctx: CliCtx) {
  return subcommands({
    name: "db",
    description: "Read and write Fireproof documents",
    cmds: {
      list: dbListCmd(ctx),
    },
  });
}
