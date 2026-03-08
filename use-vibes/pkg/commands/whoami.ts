import { Result } from "@adviser/cement";

export async function runWhoami(): Promise<Result<void>> {
  return Result.Err("Not logged in. Run: use-vibes login");
}
