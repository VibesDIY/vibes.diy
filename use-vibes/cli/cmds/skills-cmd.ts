import { command } from "cmd-ts";
import { exception2Result } from "@adviser/cement";
import { getLlmCatalog } from "@vibes.diy/prompts";
import { CliCtx } from "../cli-ctx.js";

export function skillsCmd(ctx: CliCtx) {
  return command({
    name: "skills",
    description: "List available skill libraries.",
    args: {},
    handler: async function handleSkills(): Promise<void> {
      const { stdout, stderr } = ctx.output;
      const rCatalog = await exception2Result(() => getLlmCatalog());
      if (rCatalog.isErr()) {
        stderr(`Failed to load skills catalog: ${rCatalog.Err().message}\n`);
        ctx.exitCode = 1;
        return;
      }
      for (const skill of rCatalog.Ok()) {
        stdout(`${skill.name.padEnd(12)}${skill.description}\n`);
      }
    },
  });
}
