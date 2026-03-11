import type { CommandExecutable } from "../executable.js";
import { runWhoami } from "../../commands/whoami.js";
import { resultToExitCode } from "./result-to-exit-code.js";

export const whoamiExec: CommandExecutable = {
  name: "whoami",
  description: "Print logged-in user",
  async run(_argv, runtime) {
    const result = await runWhoami(runtime);
    return resultToExitCode(runtime, result);
  },
};
