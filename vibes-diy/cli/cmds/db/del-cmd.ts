import { command, option, optional, positional, string } from "cmd-ts";
import { type } from "arktype";
import { Result, Option } from "@adviser/cement";
import type { ValidateTriggerCtx, HandleTriggerCtx, EventoResultType, EventoHandler } from "@adviser/cement";
import { FireflyApiAdapter } from "@vibes.diy/api-impl";
import { isResDeleteDoc } from "@vibes.diy/api-types";
import type { CliCtx } from "../../cli-ctx.js";
import { cmdTsDefaultArgs } from "../../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../../cmd-evento.js";
import { dbCommonArgs, resolveUserSlug } from "./shared.js";

export const ReqDbDel = type({
  type: "'vibes-diy.cli.db.del'",
  apiUrl: "string",
  appSlug: "string",
  userSlug: "string",
  dbName: "string",
  docId: "string",
});
export type ReqDbDel = typeof ReqDbDel.infer;
export function isReqDbDel(obj: unknown): obj is ReqDbDel {
  return !(ReqDbDel(obj) instanceof type.errors);
}

export const ResDbDel = type({
  type: "'vibes-diy.cli.db.del-res'",
  id: "string",
  ok: "true",
});
export type ResDbDel = typeof ResDbDel.infer;
export function isResDbDel(obj: unknown): obj is ResDbDel {
  return !(ResDbDel(obj) instanceof type.errors);
}

export const dbDelEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqDbDel, ResDbDel> = {
  hash: "vibes-diy.cli.db.del",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqDbDel, ResDbDel>) => {
    if (isReqDbDel(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqDbDel, ResDbDel>): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (ectx.vibesDiyApiFactory === undefined) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const api = ectx.vibesDiyApiFactory(ctx.validated.apiUrl);
    const rUser = await resolveUserSlug(api, ctx.validated.userSlug);
    if (rUser.isErr()) return Result.Err(rUser.Err());
    const adapter = new FireflyApiAdapter(api, ctx.validated.appSlug, { userSlug: rUser.Ok() });
    const r = await adapter.deleteDoc(ctx.validated.docId, ctx.validated.dbName);
    if (r.isErr()) return Result.Err(r.Err());
    const res = r.Ok();
    if (!isResDeleteDoc(res)) {
      return Result.Err(`Unexpected response: ${JSON.stringify(res)}`);
    }
    return sendMsg(ctx, {
      type: "vibes-diy.cli.db.del-res",
      id: res.id,
      ok: true,
    } satisfies ResDbDel);
  },
};

export function dbDelCmd(ctx: CliCtx) {
  return command({
    name: "del",
    description: "Delete a document by ID",
    args: {
      ...cmdTsDefaultArgs(ctx),
      ...dbCommonArgs(ctx),
      docIdPositional: positional({
        type: optional(string),
        displayName: "docId",
        description: "Document ID (or pass --id)",
      }),
      docIdFlag: option({
        long: "id",
        description: "Document ID — same as positional, kept for symmetry with `db put --id`",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
    },
    handler: ctx.cliStream.enqueue((args) => {
      const docId = args.docIdPositional ?? args.docIdFlag;
      if (docId === "") {
        throw new Error("docId is required: pass as positional or --id");
      }
      return {
        type: "vibes-diy.cli.db.del",
        apiUrl: args.apiUrl,
        appSlug: args.appSlug,
        userSlug: args.userSlug,
        dbName: args.dbName,
        docId,
      };
    }),
  });
}
