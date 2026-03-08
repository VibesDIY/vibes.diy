import { Result } from "@adviser/cement";
import { command, option, run, string, subcommands, restPositionals } from "cmd-ts";
import { runHelp } from "./commands/help.js";
import { runWhoami } from "./commands/whoami.js";
import { runSkills } from "./commands/skills.js";
import { runSystem } from "./commands/system.js";
import { notImplemented } from "./commands/not-implemented.js";
import { defaultCliOutput } from "./commands/cli-output.js";

async function emitResult(runner: () => Promise<Result<void>>): Promise<void> {
  const result = await runner();
  if (result.isErr()) {
    const err = result.Err();
    defaultCliOutput.stderr(typeof err === "string" ? err : String(err));
    defaultCliOutput.stderr("\n");
    process.exitCode = 1;
  }
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
      defaultValue: () => "",
    }),
  },
  handler: async function handleSystem(args: { readonly skills: string }): Promise<void> {
    const skillsCsv = args.skills.length > 0 ? args.skills : undefined;
    await emitResult(() => runSystem({ skillsCsv }));
  },
});

function createStubCommand(name: string) {
  return command({
    name,
    description: `${name} is not implemented yet`,
    args: {
      _rest: restPositionals({ description: "arguments" }),
    },
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
  default:
    await run(app, cliArgs);
    break;
}
