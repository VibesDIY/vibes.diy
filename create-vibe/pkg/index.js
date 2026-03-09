#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import prompts from 'prompts';
import chalk from 'chalk';

const PLACEHOLDER_APP = `export default function App() {
  return (
    <div className="min-h-dvh grid place-items-center bg-slate-50 text-slate-900">
      <main className="p-6 max-w-xl text-center space-y-3">
        <h1 className="text-2xl font-semibold">Your Vibe goes here</h1>
        <p className="text-sm opacity-60">Edit app.jsx and run use-vibes dev</p>
      </main>
    </div>
  )
}
`;

console.log();
console.log(chalk.cyan('✨ ') + chalk.bold.magenta('create-vibe') + chalk.cyan(' ✨'));
console.log(chalk.gray('Scaffold a new vibe project'));
console.log();

async function main() {
  let name = process.argv[2];

  if (!name) {
    const suggestions = [
      'todo', 'habit-tracker', 'timer', 'grocery-list',
      'recipe-book', 'color-palette', 'budget', 'journal',
    ];
    const response = await prompts({
      type: 'text',
      name: 'name',
      message: chalk.bold('Project name?'),
      initial: suggestions[Math.floor(Math.random() * suggestions.length)],
    });
    name = response.name;
  }

  if (!name) {
    console.log(chalk.yellow('No name provided. Goodbye!'));
    process.exit(0);
  }

  const dir = join(process.cwd(), name);

  const pkg = {
    private: true,
    scripts: {
      dev: 'use-vibes dev',
      publish: 'use-vibes publish',
    },
    devDependencies: {
      'use-vibes': 'latest',
    },
  };

  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  await writeFile(join(dir, 'vibes.json'), JSON.stringify({ app: name }, null, 2) + '\n');
  await writeFile(join(dir, 'app.jsx'), PLACEHOLDER_APP);

  console.log(chalk.green(`✨ Created ${name}/`));
  console.log();
  console.log(`  ${chalk.cyan('cd')} ${name}`);
  console.log(`  ${chalk.cyan('npm install')}`);
  console.log(`  ${chalk.cyan('npx use-vibes dev')}`);
  console.log();
  console.log(chalk.gray('Happy vibing!'));
}

main().catch((err) => {
  console.error(chalk.red('Error:'), err.message);
  process.exit(1);
});
