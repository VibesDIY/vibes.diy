import { Lazy, Evento, EventoResult, EventoType, Result } from "@adviser/cement";
import { W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { ResError } from "@vibes.diy/api-types";
import { handlersForShard } from "./evento-handler-manifest.js";

// ChatSessions is the "stream" shard: chat streaming + the stateless shared
// queries the parent app still calls on chatApi. Vibe-scoped doc ops are
// `VIBE_ONLY` in the manifest, so `handlersForShard("stream")` excludes them —
// keeping doc writes off the chat plane is what let AccessFnDO be retired
// (#2265). Exported so a parity test can assert what the stream shard serves.
export const chatPlaneHandlers = handlersForShard("stream");

export const chatMsgEvento = Lazy(() => {
  const evento = new Evento(new W3CWebSocketEventEventoEnDecoder());
  evento.push(
    ...chatPlaneHandlers,
    {
      type: EventoType.WildCard,
      hash: "chat-not-msg-implemented-handler",
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
      hash: "chat-error-handler",
      handle: async (ctx) => {
        console.error("chatMsgEvento error-handler", ctx.error, (ctx.error as { cause?: unknown })?.cause);
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
