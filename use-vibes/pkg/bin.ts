// Node CLI entry point — compiled by dnt with #!/usr/bin/env node shebang.
// For Deno, use main.deno.ts instead.
import { defaultCliOutput } from "./commands/cli-output.js";
import { nodeLoginPlatform } from "./commands/login-platform-node.js";
import { dispatch } from "./dispatcher.js";

await dispatch(process.argv.slice(2), {
  output: defaultCliOutput,
  setExitCode(code: number): void {
    process.exitCode = code;
  },
  loginPlatform: nodeLoginPlatform,
});
