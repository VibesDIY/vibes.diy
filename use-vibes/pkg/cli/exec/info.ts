import type { CommandExecutable } from "../executable.js";
import { runInfo } from "../../commands/info.js";

export const infoExec: CommandExecutable = {
  name: "info",
  description: "Show resolved config and target",
  async run(argv, runtime) {
    if (argv.length > 1) {
      runtime.output.stderr("info accepts at most one target argument\n");
      return 1;
    }
    const target = argv.length > 0 ? argv[0] : undefined;
    const result = await runInfo({ target }, runtime.output);
    if (result.isErr()) {
      runtime.output.stderr(String(result.Err()) + "\n");
      return 1;
    }
    return 0;
  },
};
