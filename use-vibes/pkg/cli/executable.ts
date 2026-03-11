import type { CliOutput } from "../commands/cli-output.js";
import type { LoginPlatform } from "../commands/login.js";

export interface CliRuntime {
  readonly output: CliOutput;
  readonly setExitCode: (code: number) => void;
  readonly loginPlatform: LoginPlatform;
}

export interface CommandExecutable {
  readonly name: string;
  readonly description: string;
  run(argv: string[], runtime: CliRuntime): Promise<number>;
}
