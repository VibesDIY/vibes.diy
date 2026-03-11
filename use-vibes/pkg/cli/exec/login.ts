import type { CommandExecutable } from "../executable.js";
import { runLogin } from "../../commands/login.js";

function parseArgs(argv: string[]): { caUrl?: string; timeout: number; forceRenew: boolean } {
  let caUrl: string | undefined;
  let timeout = 120;
  let forceRenew = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--ca-url" && i + 1 < argv.length) {
      caUrl = argv[++i];
    } else if (arg === "--timeout" && i + 1 < argv.length) {
      timeout = parseInt(argv[++i], 10);
    } else if (arg === "--force-renew") {
      forceRenew = true;
    }
  }

  return { caUrl, timeout, forceRenew };
}

export const loginExec: CommandExecutable = {
  name: "login",
  description: "Authenticate with vibes.diy",
  async run(argv, runtime) {
    const args = parseArgs(argv);
    const result = await runLogin(args, runtime.output, runtime.loginPlatform);
    if (result.isErr()) {
      runtime.output.stderr(String(result.Err()) + "\n");
      return 1;
    }
    return 0;
  },
};
