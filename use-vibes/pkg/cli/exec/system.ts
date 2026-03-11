import type { CommandExecutable } from "../executable.js";
import { runSystem } from "../../commands/system.js";
import { resultToExitCode } from "./result-to-exit-code.js";

function parseArgs(argv: string[]): { skillsCsv?: string } {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--skills" && i + 1 < argv.length) {
      return { skillsCsv: argv[i + 1] };
    }
  }
  return {};
}

export const systemExec: CommandExecutable = {
  name: "system",
  description: "Output assembled system prompt",
  async run(argv, runtime) {
    const args = parseArgs(argv);
    const result = await runSystem(args, runtime);
    return resultToExitCode(runtime, result);
  },
};
