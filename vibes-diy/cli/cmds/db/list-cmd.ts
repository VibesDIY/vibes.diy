import { command } from "cmd-ts";
import { type } from "arktype";
import { Result, Option, EventoResult } from "@adviser/cement";
import type { ValidateTriggerCtx, HandleTriggerCtx, EventoResultType, EventoHandler } from "@adviser/cement";
import type { CliCtx } from "../../cli-ctx.js";
import { cmdTsDefaultArgs } from "../../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../../cmd-evento.js";
import { dbCommonArgs, resolveUserSlug } from "./shared.js";

export const ReqDbList = type({
  type: "'vibes-diy.cli.db.list'",
  apiUrl: "string",
  appSlug: "string",
  userSlug: "string",
});
export type ReqDbList = typeof ReqDbList.infer;
export function isReqDbList(obj: unknown): obj is ReqDbList {
  return !(ReqDbList(obj) instanceof type.errors);
}

export const ResDbList = type({
  type: "'vibes-diy.cli.db.list-res'",
  dbNames: type("string").array(),
});
export type ResDbList = typeof ResDbList.infer;
export function isResDbList(obj: unknown): obj is ResDbList {
  return !(ResDbList(obj) instanceof type.errors);
}

export const dbListEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqDbList, ResDbList> = {
  hash: "vibes-diy.cli.db.list",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqDbList, ResDbList>) => {
    if (isReqDbList(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqDbList, ResDbList>): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (ectx.vibesDiyApiFactory === undefined) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const api = ectx.vibesDiyApiFactory(ctx.validated.apiUrl);
    const rUser = await resolveUserSlug(api, ctx.validated.userSlug);
    if (rUser.isErr()) return Result.Err(rUser.Err());
    const r = await api.listDbNames({ appSlug: ctx.validated.appSlug, userSlug: rUser.Ok() });
    if (r.isErr()) return Result.Err(r.Err());
    return sendMsg(ctx, {
      type: "vibes-diy.cli.db.list-res",
      dbNames: r.Ok().dbNames,
    } satisfies ResDbList);
  },
};

export function dbListCmd(ctx: CliCtx) {
  return command({
    name: "list",
    description: "List database names for an app",
    args: {
      ...cmdTsDefaultArgs(ctx),
      ...dbCommonArgs(ctx),
    },
    handler: ctx.cliStream.enqueue((args) => ({
      type: "vibes-diy.cli.db.list",
      apiUrl: args.apiUrl,
      appSlug: args.appSlug,
      userSlug: args.userSlug,
    })),
  });
}
