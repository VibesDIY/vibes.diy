#!/usr/bin/env -S node --import tsx

import { help } from "./commands/help.js";
import { whoami } from "./commands/whoami.js";
import { skills } from "./commands/skills.js";
import { system } from "./commands/system.js";
import { notImplemented } from "./commands/not-implemented.js";

const commands: Record<string, (args: string[]) => Promise<void>> = {
  help,
  whoami,
  login: notImplemented("login"),
  dev: notImplemented("dev"),
  live: notImplemented("live"),
  generate: notImplemented("generate"),
  edit: notImplemented("edit"),
  skills,
  system,
  publish: notImplemented("publish"),
  invite: notImplemented("invite"),
};

const [cmd, ...args] = process.argv.slice(2);
const handler = cmd === "--help" || cmd === "-h" ? help : commands[cmd];

if (handler) {
  await handler(args);
} else if (cmd) {
  console.error(`Unknown command: ${cmd}`);
  console.error(`Run: use-vibes help`);
  process.exit(1);
} else {
  await help(args);
}
