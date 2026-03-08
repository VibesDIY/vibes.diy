#!/usr/bin/env -S node --import tsx

import { Result, exception2Result } from "@adviser/cement";
import { command, option, run, string, subcommands } from "cmd-ts";
import { runHelp } from "./commands/help.js";
import { runWhoami } from "./commands/whoami.js";
import { runSkills } from "./commands/skills.js";
import { runSystem } from "./commands/system.js";
import { notImplemented } from "./commands/not-implemented.js";

interface MessageError {
  readonly message: string;
}

function isMessageError(value: unknown): value is MessageError {
  if (typeof value !== "object") {
    return false;
  }
  if (value === null) {
    return false;
  }
  if (("message" in value) === false) {
    return false;
  }
  return typeof value.message === "string";
}

function toErrorMessage(value: unknown): string {
  switch (true) {
    case typeof value === "string":
      return value;
    case isMessageError(value):
      return value.message;
    default:
      return "Unknown CLI error";
  }
}

async function emitResult(runner: () => Promise<Result<void>>): Promise<void> {
  const result = await runner();
  if (result.isErr()) {
    console.error(toErrorMessage(result.Err()));
    process.exitCode = 1;
  }
}

const skillsDefaultSentinel = "__use_vibes_default_skills__";
const knownCommands = new Set([
  "help",
  "whoami",
  "login",
  "dev",
  "live",
  "generate",
  "edit",
  "skills",
  "system",
  "publish",
  "invite",
]);
const skillsValueError = "--skills requires a value (e.g., --skills fireproof,d3)";

function validateKnownCommand(cliArgs: readonly string[]): Result<void> {
  if (cliArgs.length === 0) {
    return Result.Ok(undefined);
  }

  const cmd = cliArgs[0];
  if (cmd.startsWith("-")) {
    return Result.Ok(undefined);
  }
  if (knownCommands.has(cmd)) {
    return Result.Ok(undefined);
  }

  return Result.Err(`Unknown command: ${cmd}\nRun: use-vibes help`);
}

function validateSystemArgs(cliArgs: readonly string[]): Result<void> {
  if (cliArgs.length === 0 || cliArgs[0] !== "system") {
    return Result.Ok(undefined);
  }

  for (let index = 1; index < cliArgs.length; index += 1) {
    const arg = cliArgs[index];
    if (arg === "--skills") {
      const value = cliArgs[index + 1];
      if (typeof value === "undefined" || value.startsWith("-")) {
        return Result.Err(skillsValueError);
      }
      continue;
    }
    if (arg.startsWith("--skills=")) {
      const value = arg.slice("--skills=".length);
      if (value.trim().length === 0) {
        return Result.Err(skillsValueError);
      }
    }
  }

  return Result.Ok(undefined);
}

const helpCmd = command({
  name: "help",
  description: "Print CLI help",
  args: {},
  handler: async function handleHelp(): Promise<void> {
    await emitResult(runHelp);
  },
});

const whoamiCmd = command({
  name: "whoami",
  description: "Print logged in user",
  args: {},
  handler: async function handleWhoami(): Promise<void> {
    await emitResult(runWhoami);
  },
});

const skillsCmd = command({
  name: "skills",
  description: "List available skills",
  args: {},
  handler: async function handleSkills(): Promise<void> {
    await emitResult(runSkills);
  },
});

const systemCmd = command({
  name: "system",
  description: "Emit system prompt",
  args: {
    skills: option({
      type: string,
      long: "skills",
      description: "Comma-separated skills, e.g. fireproof,d3",
      defaultValue: () => skillsDefaultSentinel,
    }),
  },
  handler: async function handleSystem(args: { readonly skills: string }): Promise<void> {
    await emitResult(async function runSystemCommand() {
      switch (true) {
        case args.skills === skillsDefaultSentinel:
          return runSystem({});
        default:
          return runSystem({ skillsCsv: args.skills });
      }
    });
  },
});

function createStubCommand(name: string): ReturnType<typeof command> {
  return command({
    name,
    description: `${name} is not implemented yet`,
    args: {},
    handler: async function handleStub(): Promise<void> {
      await emitResult(notImplemented({ name }));
    },
  });
}

const app = subcommands({
  name: "use-vibes",
  description: "Build and deploy React + Fireproof apps",
  cmds: {
    help: helpCmd,
    whoami: whoamiCmd,
    login: createStubCommand("login"),
    dev: createStubCommand("dev"),
    live: createStubCommand("live"),
    generate: createStubCommand("generate"),
    edit: createStubCommand("edit"),
    skills: skillsCmd,
    system: systemCmd,
    publish: createStubCommand("publish"),
    invite: createStubCommand("invite"),
  },
});

const cliArgs = process.argv.slice(2);

switch (true) {
  case cliArgs.length === 0:
    await emitResult(runHelp);
    break;
  case cliArgs.length === 1 && (cliArgs[0] === "-h" || cliArgs[0] === "--help"):
    await emitResult(runHelp);
    break;
  default: {
    const rKnownCommand = validateKnownCommand(cliArgs);
    if (rKnownCommand.isErr()) {
      console.error(rKnownCommand.Err());
      process.exitCode = 1;
      break;
    }

    const rSystemArgs = validateSystemArgs(cliArgs);
    if (rSystemArgs.isErr()) {
      console.error(rSystemArgs.Err());
      process.exitCode = 1;
      break;
    }

    const rRun = await exception2Result(() => run(app, cliArgs));
    if (rRun.isErr()) {
      console.error(toErrorMessage(rRun.Err()));
      process.exitCode = 1;
    }
    break;
  }
}
