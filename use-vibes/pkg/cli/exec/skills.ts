import type { CommandExecutable } from "../executable.js";
import { runSkills } from "../../commands/skills.js";
import { resultToExitCode } from "./result-to-exit-code.js";

export const skillsExec: CommandExecutable = {
  name: "skills",
  description: "List available skill libraries",
  async run(_argv, runtime) {
    const result = await runSkills(runtime.output);
    return resultToExitCode(runtime, result);
  },
};
