import {
  Lazy,
  Evento,
  EventoResult,
  EventoType,
  HandleTriggerCtx,
  ValidateTriggerCtx,
  Result,
  Option,
  EventoResultType,
} from "@adviser/cement";
import { ReqResEventoEnDecoder } from "@vibes.diy/api-pkg";
import { HttpResponseJsonType } from "@vibes.diy/api-types";
import { servEntryPoint } from "./public/serv-entry-point.js";

export const vibesReqResEvento = Lazy(() => {
  const evento = new Evento(new ReqResEventoEnDecoder());
  evento.push(
    {
      hash: "cors-preflight",
      validate: (ctx: ValidateTriggerCtx<Request, unknown, unknown>) => {
        const { request: req } = ctx;
        if (req && req.method === "OPTIONS") {
          return Promise.resolve(Result.Ok(Option.Some("Send CORS preflight response")));
        }
        return Promise.resolve(Result.Ok(Option.None()));
      },
      handle: async (ctx: HandleTriggerCtx<Request, string, unknown>): Promise<Result<EventoResultType>> => {
        await ctx.send.send(ctx, {
          type: "http.Response.JSON",
          status: 200,
          json: { type: "ok", message: "CORS preflight" },
        } satisfies HttpResponseJsonType);
        return Result.Ok(EventoResult.Stop);
      },
    },
    servEntryPoint,
    {
      type: EventoType.WildCard,
      hash: "not-implemented-handler",
      handle: async (ctx) => {
        await ctx.send.send(ctx, {
          type: "http.Response.JSON",
          status: 501,
          json: {
            type: "error",
            message: "vibesReqResEvento: Not Implemented",
            req: ctx.enRequest,
          },
        } satisfies HttpResponseJsonType);
        return Result.Ok(EventoResult.Continue);
      },
    },
    {
      type: EventoType.Error,
      hash: "error-handler",
      handle: async (ctx) => {
        await ctx.send.send(ctx, {
          type: "http.Response.JSON",
          status: 500,
          json: {
            type: "error",
            message: "Internal Server Error",
            error: ctx.error?.toString(),
          },
        } satisfies HttpResponseJsonType);
        return Result.Ok(EventoResult.Continue);
      },
    }
  );
  return evento;
});
