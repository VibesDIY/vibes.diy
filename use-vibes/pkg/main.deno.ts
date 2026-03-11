import { denoCliOutput } from "./commands/cli-output-deno.js";
import { dispatch } from "./dispatcher.js";

await dispatch(Deno.args, {
  output: denoCliOutput,
  setExitCode(code: number): void {
    Deno.exitCode = code;
  },
});
