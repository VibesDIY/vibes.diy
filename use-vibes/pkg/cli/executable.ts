import type { CliOutput } from "../commands/cli-output-node.js";

export interface CliRuntime {
  readonly cwd: string;
  readonly output: CliOutput;
  readonly setExitCode: (code: number) => void;
}

export interface CommandExecutable {
  readonly name: string;
  readonly description: string;
  run(argv: string[], runtime: CliRuntime): Promise<number>;
}
