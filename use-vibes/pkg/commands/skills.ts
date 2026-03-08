import { getLlmCatalog } from "@vibes.diy/prompts";

export async function skills(_args: string[]): Promise<void> {
  const catalog = await getLlmCatalog();
  for (const skill of catalog) {
    process.stdout.write(`${skill.name.padEnd(12)}${skill.description}\n`);
  }
}
