import { command } from "cmd-ts";
import { type } from "arktype";
import { Result, Option, EventoResult } from "@adviser/cement";
import type { ValidateTriggerCtx, HandleTriggerCtx, EventoResultType, EventoHandler } from "@adviser/cement";
import { FireflyApiAdapter } from "@vibes.diy/api-impl";
import type { CliCtx } from "../../cli-ctx.js";
import { cmdTsDefaultArgs } from "../../cli-ctx.js";
import { sendProgress, WrapCmdTSMsg } from "../../cmd-evento.js";
import { dbCommonArgs, openVibeDbApi, resolveDbVibeArgs } from "./shared.js";

export const ReqDbSubscribe = type({
  type: "'vibes-diy.cli.db.subscribe'",
  apiUrl: "string",
  appSlug: "string",
  ownerHandle: "string",
  dbName: "string",
});
export type ReqDbSubscribe = typeof ReqDbSubscribe.infer;
export function isReqDbSubscribe(obj: unknown): obj is ReqDbSubscribe {
  return !(ReqDbSubscribe(obj) instanceof type.errors);
}

export const dbSubscribeEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqDbSubscribe, never> = {
  hash: "vibes-diy.cli.db.subscribe",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqDbSubscribe, never>) => {
    if (isReqDbSubscribe(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqDbSubscribe, never>): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    const rApi = await openVibeDbApi(ectx, ctx.validated.apiUrl, ctx.validated.ownerHandle, ctx.validated.appSlug);
    if (rApi.isErr()) return Result.Err(rApi.Err());
    const { api, ownerHandle } = rApi.Ok();
    const adapter = new FireflyApiAdapter(api, ctx.validated.appSlug, { ownerHandle });
    await adapter.enableGrantReactivity();

    // Trigger server-side subscription. The api layer transparently reconnects on
    // mid-stream disconnects (api/impl/index.ts onClose → setTimeout → replay), but
    // the *initial* connect attempt is not retried — surface that as an actionable
    // error rather than letting the underlying WebSocket error bubble up.
    const rSub = await adapter.subscribeDocs(ctx.validated.dbName);
    if (rSub.isErr()) {
      return Result.Err(`Subscribe failed on initial connect: ${rSub.Err()}. Check your network connection and retry.`);
    }

    // Notify user we're listening
    await sendProgress(
      ctx,
      "info",
      `Subscribed to ${ctx.validated.appSlug}/${ctx.validated.dbName} — waiting for events (Ctrl+C to exit)`
    );

    // Register listener — each event prints one JSON line
    adapter.onMsg((event) => {
      sendProgress(ctx, "info", JSON.stringify(event.data)).catch(() => {
        // sendProgress write errors are non-fatal — just drop
      });
    });

    // Block forever — the process exits on SIGINT
    await new Promise<never>(() => {
      /* never resolves */
    });
    return Result.Ok(EventoResult.Continue);
  },
};

export function dbSubscribeCmd(ctx: CliCtx) {
  return command({
    name: "subscribe",
    description:
      "Tail real-time doc-changed events for a database (Ctrl+C to exit). Reconnects mid-stream; events that fire during the gap are not backfilled.",
    args: {
      ...cmdTsDefaultArgs(ctx),
      ...dbCommonArgs(ctx),
    },
    handler: ctx.cliStream.enqueue((args) => {
      const resolved = resolveDbVibeArgs({
        vibe: args.vibe,
        appSlug: args.appSlug,
        ownerHandle: args.ownerHandle,
        ownerHandleDeprecated: args.ownerHandleDeprecated,
      });
      return {
        type: "vibes-diy.cli.db.subscribe",
        apiUrl: args.apiUrl,
        appSlug: resolved.appSlug,
        ownerHandle: resolved.ownerHandle,
        dbName: args.dbName,
      };
    }),
  });
}
