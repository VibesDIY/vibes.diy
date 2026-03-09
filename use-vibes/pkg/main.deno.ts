import { denoCliOutput } from "./commands/cli-output-deno.ts";
import { runCli } from "./run-cli.ts";

await runCli(Deno.args, {
  output: denoCliOutput,
  setExitCode(code: number): void {
    Deno.exitCode = code;
  },
});
