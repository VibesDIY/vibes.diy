import type { CommandExecutable } from "../executable.js";
import { runSystem } from "../../commands/system.js";

export const systemExec: CommandExecutable = {
  name: "system",
  description: "Emit system prompt",
  async run(argv, runtime) {
    let skillsCsv: string | undefined;

    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === "--skills" && i + 1 < argv.length) {
        skillsCsv = argv[++i];
      } else if (argv[i] === "--skills") {
        // --skills with no value: fall back to defaults
        skillsCsv = undefined;
      }
    }

    const result = await runSystem({ skillsCsv }, runtime.output);
    if (result.isErr()) {
      runtime.output.stderr(String(result.Err()) + "\n");
      return 1;
    }
    return 0;
  },
};
