import type { CommandExecutable, CliRuntime } from "./cli/executable.js";
import { whoamiExec } from "./cli/exec/whoami.js";
import { skillsExec } from "./cli/exec/skills.js";
import { systemExec } from "./cli/exec/system.js";
import { infoExec } from "./cli/exec/info.js";

export type { CliRuntime } from "./cli/executable.js";

const commands: readonly CommandExecutable[] = [
  whoamiExec,
  skillsExec,
  systemExec,
  infoExec,
];

function printHelp(output: CliRuntime["output"]): void {
  output.stdout("use-vibes — Build and deploy React + Fireproof apps\n\n");
  output.stdout("Commands:\n");
  for (const cmd of commands) {
    output.stdout(`  ${cmd.name.padEnd(18)}${cmd.description}\n`);
  }
  output.stdout("\nRun: use-vibes <command> --help\n");
}

export async function dispatch(cliArgs: readonly string[], runtime: CliRuntime): Promise<void> {
  if (cliArgs.length === 0 || cliArgs[0] === "help" || cliArgs[0] === "-h" || cliArgs[0] === "--help") {
    printHelp(runtime.output);
    return;
  }

  const token = cliArgs[0];
  const exec = commands.find((c) => c.name === token);
  if (!exec) {
    runtime.output.stderr(`Unknown command: ${token}\n`);
    runtime.setExitCode(1);
    return;
  }

  const code = await exec.run([...cliArgs.slice(1)], runtime);
  runtime.setExitCode(code);
}
