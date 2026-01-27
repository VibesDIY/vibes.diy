import { Lazy, Evento, EventoResult, EventoType, Result } from "@adviser/cement";
import { W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { ResError } from "@vibes.diy/api-types";
import { appendChatSection } from "./public/append-chat-section.js";
import { ensureAppSlugItem } from "./public/ensure-app-slug-item.js";
import { ensureChatContext } from "./public/ensure-chat-context.js";

export const vibesMsgEvento = Lazy(() => {
  const evento = new Evento(new W3CWebSocketEventEventoEnDecoder());
  evento.push(
    ensureAppSlugItem,
    ensureChatContext,
    appendChatSection,
    {
      type: EventoType.WildCard,
      hash: "not-msg-implemented-handler",
      handle: async (ctx) => {
        await ctx.send.send(ctx, {
          type: "vibes.diy.error",
          message: "Not Implemented",
          // input: ctx.enRequest,
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      },
    },
    {
      type: EventoType.Error,
      hash: "error-handler",
      handle: async (ctx) => {
        await ctx.send.send(ctx, {
          type: "vibes.diy.error",
          message: ctx.error?.toString() || "Internal Server Error",
          // input: ctx.enRequest,
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      },
    }
  );
  return evento;
});
