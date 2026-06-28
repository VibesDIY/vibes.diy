import { Lazy, Evento, EventoResult, EventoType, Result } from "@adviser/cement";
import { W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { ResError } from "@vibes.diy/api-types";
import { handlerManifest } from "./evento-handler-manifest.js";

// The monolith evento: every handler, regardless of shard kind. Used by cfServe
// as the default when a DO doesn't pin a narrower shard plane.
export const vibesMsgEvento = Lazy(() => {
  const evento = new Evento(new W3CWebSocketEventEventoEnDecoder());
  evento.push(
    ...handlerManifest.map((e) => e.handler),
    {
      type: EventoType.WildCard,
      hash: "not-msg-implemented-handler",
      handle: async (ctx) => {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: `Not Implemented: ${JSON.stringify(ctx.enRequest)}` },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      },
    },
    {
      type: EventoType.Error,
      hash: "error-handler",
      handle: async (ctx) => {
        console.error("vibesMsgEvento error-handler", ctx.error, (ctx.error as { cause?: unknown })?.cause);
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: `Error: ${ctx.error?.message?.toString() || "Internal Server Error"}` },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      },
    }
  );
  return evento;
});
