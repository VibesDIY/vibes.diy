import { Buffer } from "node:buffer";
import type { CliOutput } from "./cli-output.ts";

export const denoCliOutput: CliOutput = {
  stdout(text: string): void {
    Deno.stdout.writeSync(Buffer.from(text));
  },
  stderr(text: string): void {
    Deno.stderr.writeSync(Buffer.from(text));
  },
};
