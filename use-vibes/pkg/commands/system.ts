import { Result, exception2Result } from "@adviser/cement";
import { makeBaseSystemPrompt, getDefaultDependencies, getLlmCatalogNames } from "@vibes.diy/prompts";

export interface RunSystemOptions {
  readonly skillsCsv?: string;
}

function parseSkillsCsv(options: RunSystemOptions): Result<string[]> {
  const skillsCsv = options.skillsCsv;
  if (typeof skillsCsv === "undefined") {
    return Result.Ok([]);
  }

  switch (true) {
    case skillsCsv.trim().length === 0:
      return Result.Err("--skills requires a value (e.g., --skills fireproof,d3)");
    default:
      break;
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

export async function runSystem(options: RunSystemOptions): Promise<Result<void>> {
  const rParsedSkills = parseSkillsCsv(options);
  if (rParsedSkills.isErr()) {
    return Result.Err(rParsedSkills.Err());
  }

  let selectedSkills: string[] = rParsedSkills.Ok();
  switch (true) {
    case selectedSkills.length > 0:
      break;
    default: {
      const rDefaults = await exception2Result(() => getDefaultDependencies());
      if (rDefaults.isErr()) {
        return Result.Err(`Failed to load default skills: ${rDefaults.Err().message}`);
      }
      selectedSkills = rDefaults.Ok();
      break;
    }
  }

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

  process.stdout.write(rPrompt.Ok().systemPrompt);
  return Result.Ok(undefined);
}
