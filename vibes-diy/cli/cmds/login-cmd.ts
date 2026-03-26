import { command, flag, option, string } from "cmd-ts";
import {
  ValidateTriggerCtx,
  Result,
  HandleTriggerCtx,
  Option,
  EventoHandler,
  EventoResultType,
  exception2Result,
  BuildURI,
} from "@adviser/cement";
import { type } from "arktype";
import { $ } from "zx";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";

export const ResLogin = type({
  type: "'use-vibes.cli.res-login'",
  message: "string",
});
export type ResLogin = typeof ResLogin.infer;

export function isResLogin(obj: unknown): obj is ResLogin {
  return !(ResLogin(obj) instanceof type.errors);
}

export const ReqLogin = type({
  type: "'use-vibes.cli.login'",
});
export type ReqLogin = typeof ReqLogin.infer;

export function isReqLogin(obj: unknown): obj is ReqLogin {
  return !(ReqLogin(obj) instanceof type.errors);
}

function apiUrlToCaUrl(apiUrl: string): string {
  return BuildURI.from(apiUrl).pathname("/settings/csr-to-cert").toString();
}

const LoginRawArgs = type({ force: "boolean", timeout: "string", commonName: "string" });

export const loginEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqLogin, ResLogin> = {
  hash: "use-vibes.cli.login",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqLogin, ResLogin>) => {
    if (isReqLogin(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqLogin, ResLogin>): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    const rRaw = LoginRawArgs(ctx.request.cmdTs.raw);
    if (rRaw instanceof type.errors) {
      return Result.Err(`invalid args: ${rRaw.summary}`);
    }
    const apiUrl = ctx.request.cmdTs.apiUrl;
    const caUrl = apiUrlToCaUrl(apiUrl);
    const commonName = rRaw.commonName === "" ? ectx.sthis.nextId().str : rRaw.commonName;

    const args: string[] = [
      "core-cli",
      "deviceId",
      "register",
      "--ca-url",
      caUrl,
      "--common-name",
      commonName,
      "--timeout",
      rRaw.timeout,
    ];
    if (rRaw.force) {
      args.push("--force-renew");
    }

    const rRun = await exception2Result(() => $`${args}`);
    if (rRun.isErr()) {
      return Result.Err(`Login failed: ${rRun.Err().message}`);
    }
    return sendMsg(ctx, {
      type: "use-vibes.cli.res-login",
      message: "Login complete.",
    } satisfies ResLogin);
  },
};

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
      return { type: "use-vibes.cli.login" } satisfies ReqLogin;
    }),
  });
}
