import { Result, exception2Result } from "@adviser/cement";
import { makeBaseSystemPrompt, getDefaultDependencies, getLlmCatalogNames } from "@vibes.diy/prompts";
import type { CliOutput } from "./cli-output-node.js";

export interface RunSystemOptions {
  readonly skillsCsv?: string;
}

function parseSkillsCsv(options: RunSystemOptions): Result<string[]> {
  const skillsCsv = options.skillsCsv;
  if (typeof skillsCsv === "undefined") {
    return Result.Ok([]);
  }

  if (skillsCsv.trim().length === 0) {
    return Result.Err("--skills requires a value (e.g., --skills fireproof,d3)");
  }

  const parsedSkills = skillsCsv
    .split(",")
    .map((skillName) => skillName.trim())
    .filter((skillName) => skillName.length > 0);

  switch (true) {
    case parsedSkills.length === 0:
      return Result.Err("--skills requires a value (e.g., --skills fireproof,d3)");
    default:
      return Result.Ok(parsedSkills);
  }
}

async function resolveSkills(parsedSkills: string[]): Promise<Result<string[]>> {
  switch (true) {
    case parsedSkills.length > 0:
      return Result.Ok(parsedSkills);
    default: {
      const rDefaults = await exception2Result(() => getDefaultDependencies());
      if (rDefaults.isErr()) {
        return Result.Err(`Failed to load default skills: ${rDefaults.Err().message}`);
      }
      return Result.Ok(rDefaults.Ok());
    }
  }
}

export async function runSystem(
  options: RunSystemOptions,
  output: CliOutput,
): Promise<Result<void>> {
  const rParsedSkills = parseSkillsCsv(options);
  if (rParsedSkills.isErr()) {
    return Result.Err(rParsedSkills);
  }

  const rSelectedSkills = await resolveSkills(rParsedSkills.Ok());
  if (rSelectedSkills.isErr()) {
    return Result.Err(rSelectedSkills);
  }
  const selectedSkills = rSelectedSkills.Ok();

  const rValidNames = await exception2Result(() => getLlmCatalogNames());
  if (rValidNames.isErr()) {
    return Result.Err(`Failed to load skill catalog names: ${rValidNames.Err().message}`);
  }

  const validNames = rValidNames.Ok();
  const invalid = selectedSkills.filter((skillName) => !validNames.has(skillName));
  if (invalid.length > 0) {
    return Result.Err(`Unknown skills: ${invalid.join(", ")}\nRun: use-vibes skills`);
  }

  const rPrompt = await exception2Result(() =>
    makeBaseSystemPrompt("cli", {
      dependenciesUserOverride: true,
      dependencies: selectedSkills,
      callAi: {
        ModuleAndOptionsSelection(_msgs) {
          return Promise.resolve(Result.Err("ModuleAndOptionsSelection is not used by CLI"));
        },
      },
    })
  );
  if (rPrompt.isErr()) {
    return Result.Err(`Failed to build system prompt: ${rPrompt.Err().message}`);
  }

  output.stdout(rPrompt.Ok().systemPrompt);
  return Result.Ok(undefined);
}
