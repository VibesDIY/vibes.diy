import { command, flag, option, string } from "cmd-ts";
import { BuildURI } from "@adviser/cement";
import type { ReqDeviceIdRegister } from "@fireproof/core-cli";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";

export function loginCmd(ctx: CliCtx) {
  return command({
    name: "login",
    description: "Authenticate this device with vibes.diy cloud.",
    args: {
      ...cmdTsDefaultArgs(ctx),
      force: flag({
        long: "force",
        description: "Re-register even if a certificate already exists",
      }),
      timeout: option({
        long: "timeout",
        description: "Seconds to wait for browser auth callback",
        type: string,
        defaultValue: () => "120",
        defaultValueIsSerializable: true,
      }),
      commonName: option({
        long: "common-name",
        short: "cn",
        description: "Common name for the device certificate (defaults to random ID)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
    },
    handler: ctx.cliStream.enqueue((_args) => {
      const args = _args as { force: boolean; timeout: string; commonName: string; apiUrl: string };
      const caUrl = BuildURI.from(args.apiUrl).pathname("/settings/csr-to-cert").toString();
      const commonName = args.commonName === "" ? ctx.sthis.nextId().str : args.commonName;
      return {
        type: "core-cli.device-id-register",
        commonName,
        caUrl,
        timeout: args.timeout,
        forceRenew: args.force,
        organization: "",
        locality: "",
        state: "",
        country: "",
        port: "",
      } satisfies ReqDeviceIdRegister;
    }),
  });
}
