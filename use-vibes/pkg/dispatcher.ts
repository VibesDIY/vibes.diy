import type { CommandExecutable, CliRuntime } from "./cli/executable.js";
import { loginExec } from "./cli/exec/login.js";
import { whoamiExec } from "./cli/exec/whoami.js";
import { skillsExec } from "./cli/exec/skills.js";
import { systemExec } from "./cli/exec/system.js";
import { infoExec } from "./cli/exec/info.js";
import { handleRegisterExec } from "./cli/exec/handle-register.js";

export type { CliRuntime } from "./cli/executable.js";
export type { LoginPlatform } from "./commands/login.js";

const commands: readonly CommandExecutable[] = [
  loginExec,
  whoamiExec,
  skillsExec,
  systemExec,
  infoExec,
  handleRegisterExec,
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

  // Handle nested "handle register" command
  if (token === "handle") {
    if (cliArgs.length < 2 || cliArgs[1] === "--help" || cliArgs[1] === "-h") {
      runtime.output.stdout("use-vibes handle — Manage handles\n\n");
      runtime.output.stdout("Commands:\n");
      runtime.output.stdout(`  register          ${handleRegisterExec.description}\n`);
      return;
    }
    if (cliArgs[1] === "register") {
      const code = await handleRegisterExec.run([...cliArgs.slice(2)], runtime);
      runtime.setExitCode(code);
      return;
    }
    runtime.output.stderr(`Unknown handle subcommand: ${cliArgs[1]}\n`);
    runtime.setExitCode(1);
    return;
  }

  const exec = commands.find((c) => c.name === token);
  if (!exec) {
    runtime.output.stderr(`Unknown command: ${token}\n`);
    runtime.setExitCode(1);
    return;
  }

  const code = await exec.run([...cliArgs.slice(1)], runtime);
  runtime.setExitCode(code);
}
