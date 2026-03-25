import { command, option, string } from "cmd-ts";
import { exception2Result, Result } from "@adviser/cement";
import { makeBaseSystemPrompt, getDefaultDependencies, getLlmCatalogNames } from "@vibes.diy/prompts";
import { CliCtx } from "../cli-ctx.js";

function parseSkillsCsv(skillsCsv: string): Result<string[]> {
  if (skillsCsv === "") {
    return Result.Ok([]);
  }

  const parsed = skillsCsv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  switch (true) {
    case parsed.length === 0:
      return Result.Err("--skills requires a value (e.g. --skills fireproof,d3)");
    default:
      return Result.Ok(parsed);
  }
}

async function resolveSkills(parsed: readonly string[]): Promise<Result<string[]>> {
  switch (true) {
    case parsed.length > 0:
      return Result.Ok([...parsed]);
    default: {
      const rDefaults = await exception2Result(() => getDefaultDependencies());
      if (rDefaults.isErr()) {
        return Result.Err(`Failed to load default skills: ${rDefaults.Err().message}`);
      }
      return Result.Ok(rDefaults.Ok());
    }
  }
}

export function systemCmd(ctx: CliCtx) {
  return command({
    name: "system",
    description: "Emit the assembled system prompt to stdout.",
    args: {
      skills: option({
        type: string,
        long: "skills",
        description: "Comma-separated skills, e.g. fireproof,d3",
        defaultValue: () => "",
      }),
    },
    handler: async function handleSystem(args: { readonly skills: string }): Promise<void> {
      const { stdout, stderr } = ctx.output;

      const rParsed = parseSkillsCsv(args.skills);
      if (rParsed.isErr()) {
        stderr(`${String(rParsed.Err())}\n`);
        ctx.exitCode = 1;
        return;
      }

      const rSelected = await resolveSkills(rParsed.Ok());
      if (rSelected.isErr()) {
        stderr(`${String(rSelected.Err())}\n`);
        ctx.exitCode = 1;
        return;
      }
      const selectedSkills = rSelected.Ok();

      const rValidNames = await exception2Result(() => getLlmCatalogNames());
      if (rValidNames.isErr()) {
        stderr(`Failed to load skill catalog: ${rValidNames.Err().message}\n`);
        ctx.exitCode = 1;
        return;
      }

      const validNames = rValidNames.Ok();
      const invalid = selectedSkills.filter((name) => validNames.has(name) === false);
      if (invalid.length > 0) {
        stderr(`Unknown skills: ${invalid.join(", ")}\nRun: use-vibes skills\n`);
        ctx.exitCode = 1;
        return;
      }

      const rPrompt = await exception2Result(() =>
        makeBaseSystemPrompt("cli", {
          dependenciesUserOverride: true,
          dependencies: selectedSkills,
          callAi: {
            ModuleAndOptionsSelection() {
              return Promise.resolve(Result.Err("ModuleAndOptionsSelection is not used by CLI"));
            },
          },
        })
      );
      if (rPrompt.isErr()) {
        stderr(`Failed to build system prompt: ${rPrompt.Err().message}\n`);
        ctx.exitCode = 1;
        return;
      }

      stdout(rPrompt.Ok().systemPrompt);
    },
  });
}
