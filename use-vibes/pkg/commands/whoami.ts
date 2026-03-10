import { Result } from "@adviser/cement";

export function runWhoami(): Promise<Result<void>> {
  return Promise.resolve(Result.Err("Not logged in. Run: use-vibes login"));
}
