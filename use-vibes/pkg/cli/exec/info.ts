import type { CommandExecutable } from "../executable.js";
import { runInfo } from "../../commands/info.js";
import { resultToExitCode } from "./result-to-exit-code.js";

export const infoExec: CommandExecutable = {
  name: "info",
  description: "Show project info from vibes.json",
  async run(argv, runtime) {
    if (argv.length > 1) {
      runtime.output.stderr("info accepts at most one argument (target)\n");
      return 1;
    }
    const target = argv[0];
    const result = await runInfo({ target, startDir: runtime.cwd }, runtime.output);
    return resultToExitCode(runtime, result);
  },
};
