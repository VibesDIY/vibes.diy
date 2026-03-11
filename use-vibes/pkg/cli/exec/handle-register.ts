import type { CommandExecutable } from "../executable.js";
import { runRegisterHandle } from "../../commands/handle-register.js";

export const handleRegisterExec: CommandExecutable = {
  name: "handle register",
  description: "Register a handle slug",
  async run(argv, runtime) {
    if (argv.length > 1) {
      runtime.output.stderr("handle register accepts at most one slug argument\n");
      return 1;
    }
    const slug = argv.length > 0 ? argv[0] : undefined;
    const result = await runRegisterHandle({ slug }, runtime.output);
    if (result.isErr()) {
      runtime.output.stderr(String(result.Err()) + "\n");
      return 1;
    }
    return 0;
  },
};
