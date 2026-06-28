import { Lazy, Evento, EventoResult, EventoType, Result } from "@adviser/cement";
import { W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { ResError } from "@vibes.diy/api-types";
import { handlersForShard } from "./evento-handler-manifest.js";

export const appMsgEvento = Lazy(() => {
  const evento = new Evento(new W3CWebSocketEventEventoEnDecoder());
  evento.push(
    // AppSessions is the "vibe" shard: shared reads + vibe-scoped doc ops, plus
    // open-chat / prompt (allowed on stream+vibe in the manifest) so img-gen's
    // `req-open-chat {mode:img}` on vibeApi resolves here (#2350).
    ...handlersForShard("vibe"),
    {
      type: EventoType.WildCard,
      hash: "app-not-msg-implemented-handler",
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
      hash: "app-error-handler",
      handle: async (ctx) => {
        console.error("appMsgEvento error-handler", ctx.error, (ctx.error as { cause?: unknown })?.cause);
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
