import { Lazy, Evento, EventoResult, EventoType, Result } from "@adviser/cement";
import { W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { ResError } from "@vibes.diy/api-types";
import { ensureAppSlugItemEvento } from "./public/ensure-app-slug-item.js";
import { openChat } from "./public/open-chat.js";
import { promptChatSection } from "./public/prompt-chat-section.js";

export const vibesMsgEvento = Lazy(() => {
  const evento = new Evento(new W3CWebSocketEventEventoEnDecoder());
  evento.push(
    ensureAppSlugItemEvento,
    openChat,
    promptChatSection,
    {
      type: EventoType.WildCard,
      hash: "not-msg-implemented-handler",
      handle: async (ctx) => {
        await ctx.send.send(ctx, {
          type: "vibes.diy.error",
          message: `Not Implemented: ${JSON.stringify(ctx.enRequest)}`,
          // input: ctx.enRequest,
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      },
    },
    {
      type: EventoType.Error,
      hash: "error-handler",
      handle: async (ctx) => {
        console.error("vibesMsgEvento error-handler", ctx.error);
        await ctx.send.send(ctx, {
          type: "vibes.diy.error",
          message: `Error: ${ctx.error?.message?.toString() || "Internal Server Error"}`,
          // input: ctx.enRequest,
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      },
    }
  );
  return evento;
});
