import { Evento, EventoResult, EventoType, Lazy, Result } from "@adviser/cement";
import { evtNewFsIdEvento } from "./handlers/evt-new-fs-id.js";
import { evtAppSettingEvento } from "./handlers/evt-app-setting.js";
import { evtGenerateTitleEvento } from "./handlers/evt-generate-title.js";
import { evtInviteGrantEvento } from "./handlers/evt-invite-grant.js";
import { evtRequestGrantEvento } from "./handlers/evt-request-grant.js";
import { MsgBaseEventoEnDecoder } from "@vibes.diy/api-pkg";

export const vibesQueueEvento = Lazy(() => {
  const evento = new Evento(new MsgBaseEventoEnDecoder());
  evento.push(
    evtNewFsIdEvento,
    evtAppSettingEvento,
    evtGenerateTitleEvento,
    evtInviteGrantEvento,
    evtRequestGrantEvento,
    // {
    //   type: EventoType.WildCard,
    //   hash: "not-queue-implemented-handler",
    //   handle: async (ctx) => {
    //     console.error("vibesQueueEvento: unhandled queue message", ctx.enRequest);
    //     return Result.Ok(EventoResult.Continue);
    //   },
    // },
    {
      type: EventoType.Error,
      hash: "queue-error-handler",
      handle: async (ctx) => {
        console.error("vibesQueueEvento error-handler", ctx.error, (ctx.error as { cause?: unknown })?.cause);
        return Result.Ok(EventoResult.Continue);
      },
    }
  );
  return evento;
});
