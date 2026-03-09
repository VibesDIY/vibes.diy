import { Result, exception2Result } from "@adviser/cement";
import { getLlmCatalog } from "@vibes.diy/prompts";
import { type CliOutput, defaultCliOutput } from "./cli-output.js";

export async function runSkills(output: CliOutput = defaultCliOutput): Promise<Result<void>> {
  const rCatalog = await exception2Result(() => getLlmCatalog());
  if (rCatalog.isErr()) {
    return Result.Err(`Failed to load skills catalog: ${rCatalog.Err().message}`);
  }
  for (const skill of rCatalog.Ok()) {
    output.stdout(`${skill.name.padEnd(12)}${skill.description}\n`);
  }
  return Result.Ok(undefined);
}
