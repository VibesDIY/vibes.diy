import type { Result } from "@adviser/cement";
import type { CliRuntime } from "../executable.js";

export function resultToExitCode(runtime: CliRuntime, result: Result<unknown>): number {
  if (result.isErr()) {
    runtime.output.stderr(String(result.Err()) + "\n");
    return 1;
  }
  return 0;
}
