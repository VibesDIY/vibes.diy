import type { CommandExecutable } from "../executable.js";
import { runWhoami } from "../../commands/whoami.js";

export const whoamiExec: CommandExecutable = {
  name: "whoami",
  description: "Print device identity and linked handles",
  async run(_argv, runtime) {
    const result = await runWhoami(runtime.output);
    if (result.isErr()) {
      runtime.output.stderr(String(result.Err()) + "\n");
      return 1;
    }
    return 0;
  },
};
