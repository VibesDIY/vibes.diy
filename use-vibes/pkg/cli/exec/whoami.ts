import type { CommandExecutable } from "../executable.js";
import { runWhoami } from "../../commands/whoami.js";

export const whoamiExec: CommandExecutable = {
  name: "whoami",
  description: "Print logged-in user",
  async run(_argv, runtime) {
    const result = await runWhoami();
    if (result.isErr()) {
      runtime.output.stderr(String(result.Err()) + "\n");
      return 1;
    }
    return 0;
  },
};
