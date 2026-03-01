import {
  EventoHandler,
  ValidateTriggerCtx,
  Result,
  HandleTriggerCtx,
  EventoResultType,
  Option,
  EventoResult,
  URI,
} from "@adviser/cement";
import { HttpResponseBodyType, HttpResponseJsonType } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";

export const cidAsset: EventoHandler<Request, { url: string; mime: string }, unknown> = {
  hash: "cid-asset",
  validate: (ctx: ValidateTriggerCtx<Request, { url: string; mime: string }, unknown>) => {
    const { request: req } = ctx;
    if (req) {
      const url = URI.from(req.url);
      if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/assets/cid") && url.getParam("url")) {
        console.log("Validating request for cid-asset with URL:", url.toString());
        return Promise.resolve(
          Result.Ok(
            Option.Some({
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              url: url.getParam("url")!,
              mime: url.getParam("mime") || "application/octet-stream",
            })
          )
        );
      }
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<Request, { url: string; mime: string }, unknown>): Promise<Result<EventoResultType>> => {
    const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
    console.log("asset/cid triggered with URL:", ctx.validated.url);
    const rAsset = await vctx.storage.fetch(ctx.validated.url);
    if (rAsset.isErr()) {
      ctx.send.send(ctx, {
        type: "http.Response.JSON",
        status: 404,
        json: {
          type: "error",
          message: `Asset not found for URL ${ctx.validated.url}: ${rAsset.Err().message}`,
        },
      } satisfies HttpResponseJsonType);
    }
    ctx.send.send(ctx, {
      type: "http.Response.Body",
      status: 200,
      headers: { "Content-Type": ctx.validated.mime },
      body: rAsset.Ok(),
    } satisfies HttpResponseBodyType);
    return Result.Ok(EventoResult.Stop);
  },
};
