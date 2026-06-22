import { Lazy, Evento, EventoResult, EventoType, Result } from "@adviser/cement";
import { W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { ResError } from "@vibes.diy/api-types";
import { sharedHandlers } from "./evento-handler-manifest.js";

// SharedSessions is the non-vibe-plane DO: stateless user/identity reads only
// (sharedHandlers). No doc ops, no chat streaming, no local QuickJS. (#2265 Track B)
export const sharedMsgEvento = Lazy(() => {
  const evento = new Evento(new W3CWebSocketEventEventoEnDecoder());
  evento.push(
    ...sharedHandlers,
    {
      type: EventoType.WildCard,
      hash: "shared-not-msg-implemented-handler",
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
      hash: "shared-error-handler",
      handle: async (ctx) => {
        console.error("sharedMsgEvento error-handler", ctx.error, (ctx.error as { cause?: unknown })?.cause);
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
