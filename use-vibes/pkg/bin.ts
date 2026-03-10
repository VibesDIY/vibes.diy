// Node CLI entry point — compiled by dnt with #!/usr/bin/env node shebang.
// For Deno, use main.deno.ts instead.
import { defaultCliOutput } from "./commands/cli-output.js";
import { nodeLoginPlatform } from "./commands/login-platform-node.js";
import { runCli } from "./run-cli.js";

await runCli(process.argv.slice(2), {
  output: defaultCliOutput,
  setExitCode(code: number): void {
    process.exitCode = code;
  },
  loginPlatform: nodeLoginPlatform,
});
