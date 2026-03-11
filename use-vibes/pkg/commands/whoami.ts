import { Result } from "@adviser/cement";
import type { CliRuntime } from "../cli/executable.js";

export function runWhoami(_runtime: CliRuntime): Promise<Result<void>> {
  return Promise.resolve(Result.Err("Not logged in. Run: use-vibes login"));
}
