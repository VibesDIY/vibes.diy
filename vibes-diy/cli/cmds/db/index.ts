import { subcommands } from "cmd-ts";
import type { CliCtx } from "../../cli-ctx.js";
import { dbListCmd } from "./list-cmd.js";
import { dbGetCmd } from "./get-cmd.js";
import { dbPutCmd } from "./put-cmd.js";
import { dbDelCmd } from "./del-cmd.js";
import { dbQueryCmd } from "./query-cmd.js";
import { dbSubscribeCmd } from "./subscribe-cmd.js";

export { dbListEvento, isResDbList, type ResDbList } from "./list-cmd.js";
export { dbGetEvento, isResDbGet, type ResDbGet } from "./get-cmd.js";
export { dbPutEvento, isResDbPut, type ResDbPut } from "./put-cmd.js";
export { dbDelEvento, isResDbDel, type ResDbDel } from "./del-cmd.js";
export { dbQueryEvento, isResDbQuery, type ResDbQuery } from "./query-cmd.js";
export { dbSubscribeEvento } from "./subscribe-cmd.js";

export function dbSubcommands(ctx: CliCtx) {
  return subcommands({
    name: "db",
    description: "Read and write Fireproof documents",
    cmds: {
      list: dbListCmd(ctx),
      get: dbGetCmd(ctx),
      put: dbPutCmd(ctx),
      del: dbDelCmd(ctx),
      query: dbQueryCmd(ctx),
      subscribe: dbSubscribeCmd(ctx),
    },
  });
}
