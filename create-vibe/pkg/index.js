#!/usr/bin/env node

import prompts from 'prompts';
import chalk from 'chalk';
import open from 'open';

// Stylish CLI header
console.log();
console.log(chalk.cyan('✨ ') + chalk.bold.magenta('create-vibe') + chalk.cyan(' ✨'));
console.log(chalk.gray('More app for your prompt, build and deploy on Vibes DIY'));
console.log();

async function main() {
  try {
    const response = await prompts({
      type: 'text',
      name: 'prompt',
      message: chalk.bold('What do you want to build?'),
      initial: (() => {
        const suggestions = [
          'a todo list',
          'a habit tracker',
          'a timer app',
          'a syllabus builder',
          'a note-taking app',
          'a grocery list',
          'my digital resume',
          'a portrait generator',
          'a flower arrangement generator',
          'a color palette tool',
          'a 3D spinning cube',
          'a particle system',
          'an animated gradient',
          'a typing speed test'
        ];
        return suggestions[Math.floor(Math.random() * suggestions.length)];
      })(),
    });

    if (!response.prompt) {
      console.log(chalk.yellow('No prompt provided. Goodbye!'));
      process.exit(0);
    }

    console.log();
    console.log(chalk.green('🚀 Opening vibes.diy with your prompt...'));
    
    const encodedPrompt = encodeURIComponent(response.prompt);
    const url = `https://vibes.diy?prompt=${encodedPrompt}`;
    
    await open(url);
    
    console.log(chalk.gray(`Opened: ${url}`));
    console.log();
    console.log(chalk.cyan('Happy coding! 🎉'));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    process.exit(1);
  }
}

main();