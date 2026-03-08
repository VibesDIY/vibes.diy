import { makeBaseSystemPrompt, getDefaultDependencies, getLlmCatalogNames } from "@vibes.diy/prompts";

export async function system(args: string[]): Promise<void> {
  let skillsArg: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--skills" && args[i + 1]) {
      skillsArg = args[i + 1];
    } else if (args[i].startsWith("--skills=")) {
      skillsArg = args[i].slice("--skills=".length);
    } else if (args[i] === "--skills") {
      console.error("--skills requires a value (e.g., --skills fireproof,d3)");
      process.exit(1);
    }
  }

  const selectedSkills = skillsArg
    ? skillsArg.split(",").map((s) => s.trim()).filter(Boolean)
    : await getDefaultDependencies();

  const validNames = await getLlmCatalogNames();
  const invalid = selectedSkills.filter((s) => !validNames.has(s));
  if (invalid.length > 0) {
    console.error(`Unknown skills: ${invalid.join(", ")}`);
    console.error(`Run: use-vibes skills`);
    process.exit(1);
  }

  // callAi is required by the type but only used when dependenciesUserOverride is false.
  // With override true, skill selection is explicit — no RAG decision call needed.
  const result = await makeBaseSystemPrompt("cli", {
    dependenciesUserOverride: true,
    dependencies: selectedSkills,
    callAi: { ModuleAndOptionsSelection: () => Promise.reject(new Error("not used in CLI")) },
  });

  process.stdout.write(result.systemPrompt);
}
