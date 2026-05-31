import { command, option, optional, positional, string } from "cmd-ts";
import { type } from "arktype";
import { Result, Option } from "@adviser/cement";
import type { ValidateTriggerCtx, HandleTriggerCtx, EventoResultType, EventoHandler } from "@adviser/cement";
import { FireflyApiAdapter } from "@vibes.diy/api-impl";
import { isResGetDoc, isResGetDocNotFound, type ResGetDoc } from "@vibes.diy/api-types";
import type { CliCtx } from "../../cli-ctx.js";
import { cmdTsDefaultArgs } from "../../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../../cmd-evento.js";
import { dbCommonArgs, resolveUserSlug } from "./shared.js";

export const ReqDbGet = type({
  type: "'vibes-diy.cli.db.get'",
  apiUrl: "string",
  appSlug: "string",
  ownerHandle: "string",
  dbName: "string",
  docId: "string",
});
export type ReqDbGet = typeof ReqDbGet.infer;
export function isReqDbGet(obj: unknown): obj is ReqDbGet {
  return !(ReqDbGet(obj) instanceof type.errors);
}

export const ResDbGet = type({
  type: "'vibes-diy.cli.db.get-res'",
  doc: type({ "[string]": "unknown" }),
});
export type ResDbGet = typeof ResDbGet.infer;
export function isResDbGet(obj: unknown): obj is ResDbGet {
  return !(ResDbGet(obj) instanceof type.errors);
}

export const dbGetEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqDbGet, ResDbGet> = {
  hash: "vibes-diy.cli.db.get",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqDbGet, ResDbGet>) => {
    if (isReqDbGet(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqDbGet, ResDbGet>): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (ectx.vibesDiyApiFactory === undefined) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const api = ectx.vibesDiyApiFactory(ctx.validated.apiUrl);
    const rUser = await resolveUserSlug(api, ctx.validated.ownerHandle);
    if (rUser.isErr()) return Result.Err(rUser.Err());
    const adapter = new FireflyApiAdapter(api, ctx.validated.appSlug, { ownerHandle: rUser.Ok() });
    const r = await adapter.getDoc(ctx.validated.docId, ctx.validated.dbName);
    if (r.isErr()) return Result.Err(r.Err());
    const res = r.Ok();
    if (isResGetDocNotFound(res)) {
      return Result.Err(`Document not found: ${ctx.validated.docId}`);
    }
    if (!isResGetDoc(res)) {
      return Result.Err(`Unexpected response: ${JSON.stringify(res)}`);
    }
    const getRes = res as ResGetDoc;
    return sendMsg(ctx, {
      type: "vibes-diy.cli.db.get-res",
      doc: { ...getRes.doc, _id: getRes.id },
    } satisfies ResDbGet);
  },
};

export function dbGetCmd(ctx: CliCtx) {
  return command({
    name: "get",
    description: "Get a document by ID",
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
        type: "vibes-diy.cli.db.get",
        apiUrl: args.apiUrl,
        appSlug: args.appSlug,
        ownerHandle: args.ownerHandle,
        dbName: args.dbName,
        docId,
      };
    }),
  });
}
