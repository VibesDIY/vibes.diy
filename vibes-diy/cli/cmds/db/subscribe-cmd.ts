import { command } from "cmd-ts";
import { type } from "arktype";
import { Result, Option, EventoResult } from "@adviser/cement";
import type { ValidateTriggerCtx, HandleTriggerCtx, EventoResultType, EventoHandler } from "@adviser/cement";
import { FireflyApiAdapter } from "@vibes.diy/api-impl";
import type { CliCtx } from "../../cli-ctx.js";
import { cmdTsDefaultArgs } from "../../cli-ctx.js";
import { sendProgress, WrapCmdTSMsg } from "../../cmd-evento.js";
import { dbCommonArgs, resolveUserSlug } from "./shared.js";

export const ReqDbSubscribe = type({
  type: "'vibes-diy.cli.db.subscribe'",
  apiUrl: "string",
  appSlug: "string",
  userSlug: "string",
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
    if (ectx.vibesDiyApiFactory === undefined) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const api = ectx.vibesDiyApiFactory(ctx.validated.apiUrl);
    const rUser = await resolveUserSlug(api, ctx.validated.userSlug);
    if (rUser.isErr()) return Result.Err(rUser.Err());
    const adapter = new FireflyApiAdapter(api, ctx.validated.appSlug, { userSlug: rUser.Ok() });

    // Trigger server-side subscription
    const rSub = await adapter.subscribeDocs(ctx.validated.dbName);
    if (rSub.isErr()) return Result.Err(rSub.Err());

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
    description: "Tail real-time doc-changed events for a database",
    args: {
      ...cmdTsDefaultArgs(ctx),
      ...dbCommonArgs(ctx),
    },
    handler: ctx.cliStream.enqueue((args) => ({
      type: "vibes-diy.cli.db.subscribe",
      apiUrl: args.apiUrl,
      appSlug: args.appSlug,
      userSlug: args.userSlug,
      dbName: args.dbName,
    })),
  });
}
