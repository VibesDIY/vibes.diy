import type { CommandExecutable } from "../executable.js";
import { runSkills } from "../../commands/skills.js";

export const skillsExec: CommandExecutable = {
  name: "skills",
  description: "List available skills",
  async run(_argv, runtime) {
    const result = await runSkills(runtime.output);
    if (result.isErr()) {
      runtime.output.stderr(String(result.Err()) + "\n");
      return 1;
    }
    return 0;
  },
};
