import { command, flag, option, string, run } from "cmd-ts";
import { ValidateTriggerCtx, Result, HandleTriggerCtx, Option, EventoHandler, EventoResultType, exception2Result, BuildURI } from "@adviser/cement";
import { type } from "arktype";
import { deviceIdCmd } from "@fireproof/core-cli/device-id-cmd.js";
import { hostname } from "os";
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
  force: "boolean",
  timeout: "string",
});
export type ReqLogin = typeof ReqLogin.infer;

export function isReqLogin(obj: unknown): obj is ReqLogin {
  return !(ReqLogin(obj) instanceof type.errors);
}

function apiUrlToCaUrl(apiUrl: string): string {
  return BuildURI.from(apiUrl).pathname("/settings/csr-to-cert").toString();
}

export const loginEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqLogin, ResLogin> = {
  hash: "use-vibes.cli.login",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqLogin, ResLogin>) => {
    if (isReqLogin(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (
    ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqLogin, ResLogin>
  ): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    const req = ctx.request.result as ReqLogin;
    const apiUrl = ctx.request.cmdTs.apiUrl;
    const caUrl = apiUrlToCaUrl(apiUrl);

    const argv: string[] = ["register", "--ca-url", caUrl, "--common-name", hostname(), "--timeout", req.timeout];
    if (req.force) {
      argv.push("--force-renew");
    }

    const deviceId = deviceIdCmd(ectx.sthis);
    const rRun = await exception2Result(() => run(deviceId, argv));
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
    },
    handler: ctx.cliStream.enqueue((_args) => {
      const args = _args as { readonly force: boolean; readonly timeout: string };
      return {
        type: "use-vibes.cli.login",
        force: args.force,
        timeout: args.timeout,
      } satisfies ReqLogin;
    }),
  });
}
