import { VibesDiyApi } from "@vibes.diy/api-impl";
import { cmd_tsStream } from "./cmd-ts-stream.js";
import { SuperThis } from "@fireproof/core";
import { flag, option, string } from "cmd-ts";

export const DEFAULT_API_URL = "https://vibes.diy/api?@stable-entry@=cli";

export function cmdTsDefaultArgs(ctx: CliCtx) {
  return {
    apiUrl: option({
      long: "api-url",
      short: "u",
      description: "set the api url",
      type: string,
      defaultValue: () => ctx.sthis.env.get("VIBES_API_URL") ?? DEFAULT_API_URL,
      defaultValueIsSerializable: true,
    }),
    json: flag({
      long: "json",
      short: "j",
      description: "selects json output format",
    }),
    text: flag({
      long: "text",
      short: "t",
      description: "select text output format",
      defaultValue: () => true,
      defaultValueIsSerializable: true,
    }),
  };
}

export interface CliOutput {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export const defaultCliOutput: CliOutput = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

export interface CliCtx {
  readonly sthis: SuperThis;
  readonly cliStream: ReturnType<typeof cmd_tsStream>;
  readonly output: CliOutput;
  readonly vibesDiyApiFactory?: (apiUrl: string) => VibesDiyApi;
  exitCode: number;
}
