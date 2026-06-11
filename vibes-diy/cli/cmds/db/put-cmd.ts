import { command, positional, option, string } from "cmd-ts";
import { readFileSync } from "node:fs";
import { type } from "arktype";
import { Result, Option, exception2Result } from "@adviser/cement";
import type { ValidateTriggerCtx, HandleTriggerCtx, EventoResultType, EventoHandler } from "@adviser/cement";
import { FireflyApiAdapter } from "@vibes.diy/api-impl";
import { isResPutDoc } from "@vibes.diy/api-types";
import type { CliCtx } from "../../cli-ctx.js";
import { cmdTsDefaultArgs } from "../../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../../cmd-evento.js";
import { dbCommonArgs, openVibeDbApi, resolveDbVibeArgs } from "./shared.js";

export const ReqDbPut = type({
  type: "'vibes-diy.cli.db.put'",
  apiUrl: "string",
  appSlug: "string",
  ownerHandle: "string",
  dbName: "string",
  docJson: "string",
  docId: "string",
});
export type ReqDbPut = typeof ReqDbPut.infer;
export function isReqDbPut(obj: unknown): obj is ReqDbPut {
  return !(ReqDbPut(obj) instanceof type.errors);
}

export const ResDbPut = type({
  type: "'vibes-diy.cli.db.put-res'",
  id: "string",
  ok: "true",
});
export type ResDbPut = typeof ResDbPut.infer;
export function isResDbPut(obj: unknown): obj is ResDbPut {
  return !(ResDbPut(obj) instanceof type.errors);
}

export const dbPutEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqDbPut, ResDbPut> = {
  hash: "vibes-diy.cli.db.put",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqDbPut, ResDbPut>) => {
    if (isReqDbPut(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqDbPut, ResDbPut>): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");

    const rawJson = ctx.validated.docJson === "-" ? readFileSync(0, "utf8") : ctx.validated.docJson;
    const rParsed = await exception2Result(() => JSON.parse(rawJson) as Record<string, unknown>);
    if (rParsed.isErr()) return Result.Err(`Invalid JSON: ${rParsed.Err()}`);
    const doc = rParsed.Ok();

    const rApi = await openVibeDbApi(ectx, ctx.validated.apiUrl, ctx.validated.ownerHandle, ctx.validated.appSlug);
    if (rApi.isErr()) return Result.Err(rApi.Err());
    const { api, ownerHandle } = rApi.Ok();
    const adapter = new FireflyApiAdapter(api, ctx.validated.appSlug, { ownerHandle });
    const docId = ctx.validated.docId === "" ? undefined : ctx.validated.docId;
    const r = await adapter.putDoc(doc, docId, ctx.validated.dbName);
    if (r.isErr()) return Result.Err(r.Err());
    const res = r.Ok();
    if (!isResPutDoc(res)) {
      return Result.Err(`Unexpected response: ${JSON.stringify(res)}`);
    }
    return sendMsg(ctx, {
      type: "vibes-diy.cli.db.put-res",
      id: res.id,
      ok: true,
    } satisfies ResDbPut);
  },
};

export function dbPutCmd(ctx: CliCtx) {
  return command({
    name: "put",
    description: "Put (create or update) a document. Pass JSON on argv or '-' to read from stdin.",
    args: {
      ...cmdTsDefaultArgs(ctx),
      ...dbCommonArgs(ctx),
      docJson: positional({
        type: string,
        displayName: "json",
        description: "JSON document to store, or '-' to read from stdin",
      }),
      docId: option({
        long: "id",
        description: "Document ID (_id); generated if omitted",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
    },
    handler: ctx.cliStream.enqueue((args) => {
      const resolved = resolveDbVibeArgs({
        vibe: args.vibe,
        appSlug: args.appSlug,
        ownerHandle: args.ownerHandle,
        ownerHandleDeprecated: args.ownerHandleDeprecated,
      });
      return {
        type: "vibes-diy.cli.db.put",
        apiUrl: args.apiUrl,
        appSlug: resolved.appSlug,
        ownerHandle: resolved.ownerHandle,
        dbName: args.dbName,
        docJson: args.docJson,
        docId: args.docId,
      };
    }),
  });
}
