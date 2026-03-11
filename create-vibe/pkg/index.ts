#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { path } from "zx";
import prompts from "prompts";
import chalk from "chalk";

async function loadPlaceholderApp(): Promise<string> {
  const candidates = [
    path.join(import.meta.dirname, "templates", "app.jsx"),
    path.join(import.meta.dirname, "..", "templates", "app.jsx"),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return await readFile(candidate, "utf8");
    } catch {
      // try next candidate
    }
  }

  throw new Error("Unable to locate templates/app.jsx");
}

async function main(): Promise<void> {
  console.log();
  console.log(chalk.cyan("✨ ") + chalk.bold.magenta("create-vibe") + chalk.cyan(" ✨"));
  console.log(chalk.gray("Scaffold a new vibe project"));
  console.log();

  let name = process.argv[2];

  if (!name) {
    const suggestions = [
      "todo",
      "habit-tracker",
      "timer",
      "grocery-list",
      "recipe-book",
      "color-palette",
      "budget",
      "journal",
    ];
    const response = await prompts({
      type: "text",
      name: "name",
      message: chalk.bold("Project name?"),
      initial: suggestions[Math.floor(Math.random() * suggestions.length)],
    });
    name = response.name;
  }

  if (!name) {
    console.log(chalk.yellow("No name provided. Goodbye!"));
    process.exit(0);
  }

  const dir = path.join(process.cwd(), name);
  const placeholderApp = await loadPlaceholderApp();
  const pkg = {
    private: true,
    scripts: {
      "use-vibes": "use-vibes",
    },
    devDependencies: {
      "use-vibes": "latest",
    },
  };

  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  await writeFile(path.join(dir, "vibes.json"), JSON.stringify({ app: name }, null, 2) + "\n");
  await writeFile(path.join(dir, "app.jsx"), placeholderApp);

  console.log(chalk.green(`✨ Created ${name}/`));
  console.log();
  console.log(`  ${chalk.cyan("cd")} ${name}`);
  console.log(`  ${chalk.cyan("npm install")}`);
  console.log(`  ${chalk.cyan("npm run use-vibes dev")}`);
  console.log();
  console.log(chalk.gray("Happy vibing!"));
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(chalk.red("Error:"), message);
  process.exit(1);
});
