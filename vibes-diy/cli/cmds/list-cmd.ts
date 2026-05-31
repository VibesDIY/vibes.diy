import { command } from "cmd-ts";
import { ValidateTriggerCtx, Result, HandleTriggerCtx, Option, EventoHandler, EventoResultType } from "@adviser/cement";
import { type } from "arktype";
import { resRecentVibesItem } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";

export const ReqVibesList = type({
  type: "'vibes-diy.cli.list'",
  apiUrl: "string",
});
export type ReqVibesList = typeof ReqVibesList.infer;

export function isReqVibesList(obj: unknown): obj is ReqVibesList {
  return !(ReqVibesList(obj) instanceof type.errors);
}

export const ResVibesList = type({
  type: "'vibes-diy.cli.res-list'",
  items: resRecentVibesItem.array(),
});
export type ResVibesList = typeof ResVibesList.infer;

export function isResVibesList(obj: unknown): obj is ResVibesList {
  return !(ResVibesList(obj) instanceof type.errors);
}

export const listEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqVibesList, ResVibesList> = {
  hash: "vibes-diy.cli.list",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqVibesList, ResVibesList>) => {
    if (isReqVibesList(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqVibesList, ResVibesList>): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (!ectx.vibesDiyApiFactory) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const api = ectx.vibesDiyApiFactory(ctx.validated.apiUrl);
    const items: (typeof resRecentVibesItem.infer)[] = [];
    let cursor: string | undefined;
    do {
      const rPage = await api.listRecentVibes({ limit: 100, ...(cursor ? { cursor } : {}) });
      if (rPage.isErr()) {
        return Result.Err(rPage.Err());
      }
      const page = rPage.Ok();
      items.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    return sendMsg(ctx, { type: "vibes-diy.cli.res-list", items } satisfies ResVibesList);
  },
};

export function listCmd(ctx: CliCtx) {
  return command({
    name: "list",
    description: "List your vibes (ownerHandle/appSlug). Use --json for NDJSON output.",
    args: {
      ...cmdTsDefaultArgs(ctx),
    },
    handler: ctx.cliStream.enqueue((args) => {
      return { type: "vibes-diy.cli.list", apiUrl: args.apiUrl } satisfies ReqVibesList;
    }),
  });
}
