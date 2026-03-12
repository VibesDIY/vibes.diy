import { VibesDiyApi } from "@vibes.diy/api-impl";
import { cmd_tsStream } from "./cmd-ts-stream.js";
import { SuperThis } from "@fireproof/core";
import { flag, option, string } from "cmd-ts";

export function cmdTsDefaultArgs(ctx: CliCtx) {
  return {
    apiUrl: option({
      long: "api-url",
      short: "u",
      description: "set the api url",
      type: string,
      defaultValue: () => ctx.sthis.env.get("VIBES_API_URL") ?? "https://vite.localhost.vibesdiy.net:8888/api",
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

export interface CliCtx {
  sthis: SuperThis;
  cliStream: ReturnType<typeof cmd_tsStream>;
  vibesDiyApiFactory: (apiUrl: string) => VibesDiyApi;
}
