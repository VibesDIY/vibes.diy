import { Result, exception2Result } from "@adviser/cement";
import { getLlmCatalog } from "@vibes.diy/prompts";

export async function runSkills(): Promise<Result<void>> {
  const rCatalog = await exception2Result(() => getLlmCatalog());
  if (rCatalog.isErr()) {
    return Result.Err(`Failed to load skills catalog: ${rCatalog.Err().message}`);
  }
  for (const skill of rCatalog.Ok()) {
    process.stdout.write(`${skill.name.padEnd(12)}${skill.description}\n`);
  }
  return Result.Ok(undefined);
}
