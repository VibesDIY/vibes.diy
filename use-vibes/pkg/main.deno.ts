import { denoCliOutput } from "./commands/cli-output-deno.js";
import { runCli } from "./run-cli.js";

await runCli(Deno.args, {
  output: denoCliOutput,
  setExitCode(code: number): void {
    Deno.exitCode = code;
  },
});
