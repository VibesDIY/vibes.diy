import { Result, loadAsset } from "@adviser/cement";
import { type CliOutput, defaultCliOutput } from "./cli-output.ts";

export async function runHelp(output: CliOutput = defaultCliOutput): Promise<Result<void>> {
  const rHelpText = await loadAsset("./help.txt", { basePath: () => import.meta.url });
  if (rHelpText.isErr()) {
    return Result.Err(`Failed to load help text: ${rHelpText.Err()}`);
  }
  output.stdout(rHelpText.Ok());
  return Result.Ok(undefined);
}
