import type { Result } from "@adviser/cement";
import { command, option, run, string, subcommands, restPositionals } from "cmd-ts";
import { runHelp } from "./commands/help.js";
import { runWhoami } from "./commands/whoami.js";
import { runSkills } from "./commands/skills.js";
import { runSystem } from "./commands/system.js";
import { notImplemented } from "./commands/not-implemented.js";
import type { CliOutput } from "./commands/cli-output.js";

export interface CliRuntime {
  readonly output: CliOutput;
  readonly setExitCode: (code: number) => void;
}

async function emitResult(runtime: CliRuntime, runner: () => Promise<Result<void>>): Promise<void> {
  const result = await runner();
  if (result.isErr()) {
    const err = result.Err();
    runtime.output.stderr(typeof err === "string" ? err : String(err));
    runtime.output.stderr("\n");
    runtime.setExitCode(1);
  }
}

function createStubCommand(runtime: CliRuntime, name: string) {
  return command({
    name,
    description: `${name} is not implemented yet`,
    args: {
      _rest: restPositionals({ description: "arguments" }),
    },
    handler: async function handleStub(): Promise<void> {
      await emitResult(runtime, notImplemented({ name }));
    },
  });
}

function createApp(runtime: CliRuntime) {
  const helpCmd = command({
    name: "help",
    description: "Print CLI help",
    args: {},
    handler: async function handleHelp(): Promise<void> {
      await emitResult(runtime, () => runHelp(runtime.output));
    },
  });

  const whoamiCmd = command({
    name: "whoami",
    description: "Print logged in user",
    args: {},
    handler: async function handleWhoami(): Promise<void> {
      await emitResult(runtime, runWhoami);
    },
  });

  const skillsCmd = command({
    name: "skills",
    description: "List available skills",
    args: {},
    handler: async function handleSkills(): Promise<void> {
      await emitResult(runtime, () => runSkills(runtime.output));
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
      await emitResult(runtime, () => runSystem({ skillsCsv }, runtime.output));
    },
  });

  return subcommands({
    name: "use-vibes",
    description: "Build and deploy React + Fireproof apps",
    cmds: {
      help: helpCmd,
      whoami: whoamiCmd,
      login: createStubCommand(runtime, "login"),
      dev: createStubCommand(runtime, "dev"),
      live: createStubCommand(runtime, "live"),
      generate: createStubCommand(runtime, "generate"),
      edit: createStubCommand(runtime, "edit"),
      skills: skillsCmd,
      system: systemCmd,
      publish: createStubCommand(runtime, "publish"),
      invite: createStubCommand(runtime, "invite"),
    },
  });
}

export async function runCli(cliArgs: readonly string[], runtime: CliRuntime): Promise<void> {
  const app = createApp(runtime);

  switch (true) {
    case cliArgs.length === 0:
      await emitResult(runtime, () => runHelp(runtime.output));
      break;
    case cliArgs.length === 1 && (cliArgs[0] === "-h" || cliArgs[0] === "--help"):
      await emitResult(runtime, () => runHelp(runtime.output));
      break;
    default:
      await run(app, [...cliArgs]);
      break;
  }
}
