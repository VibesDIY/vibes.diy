// Node CLI entry point — compiled by dnt with #!/usr/bin/env node shebang.
// For Deno, use main.deno.ts instead.
import { defaultCliOutput } from "./commands/cli-output.js";
import { dispatch } from "./dispatcher.js";

await dispatch(process.argv.slice(2), {
  output: defaultCliOutput,
  setExitCode(code: number): void {
    process.exitCode = code;
  },
});
