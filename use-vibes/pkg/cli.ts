import { defaultCliOutput } from "./commands/cli-output.js";
import { runCli } from "./run-cli.js";

await runCli(process.argv.slice(2), {
  output: defaultCliOutput,
  setExitCode(code: number): void {
    process.exitCode = code;
  },
});
