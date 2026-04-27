import { Lazy, Evento, EventoResult, EventoType, Result } from "@adviser/cement";
import { W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { ResError } from "@vibes.diy/api-types";
import { ensureAppSlugItemEvento } from "./public/ensure-app-slug-item.js";
import { openChat } from "./public/open-chat.js";
import { promptChatSection } from "./public/prompt-chat-section.js";
// import { getByUserSlugAppSlugItemEvento } from "./public/get-user-slug-app-slug-item.js";
import { listUserSlugAppSlugEvento } from "./public/list-user-slug-app-slug.js";
import { getChatDetailsEvento } from "./public/get-chat-details.js";
import { getAppByFsIdEvento } from "./public/get-app-by-fsid.js";
import { ensureUserSettingsEvento } from "./public/ensure-user-settings.js";
import { listApplicationChats } from "./public/list-application-chats.js";
import { ensureAppSettingsEvento } from "./public/ensure-app-settings.js";
import { setModeFsIdEvento } from "./public/set-mode-fsid.js";
import { forkAppEvento } from "./public/fork-app.js";
import { getCertFromCsrEvento } from "./public/get-cert-from-csr.js";
import { getFPCloudTokenEvento } from "./public/get-fp-cloud-token.js";
// import { listKeyGrantsEvento, upsertKeyGrantEvento, deleteKeyGrantEvento } from "./public/key-grant.js";
import {
  createInviteEvento,
  revokeInviteEvento,
  redeemInviteEvento,
  hasAccessInviteEvento,
  inviteSetRoleEvento,
  listInviteGrantsEvento,
} from "./public/invite-flow.js";
import {
  listUserSlugBindingsEvento,
  createUserSlugBindingEvento,
  deleteUserSlugBindingEvento,
} from "./public/user-slug-bindings.js";
import {
  listRequestGrantsEvento,
  requestAccessEvento,
  approveRequestEvento,
  requestSetRoleEvento,
  revokeRequestEvento,
  hasAccessRequestEvento,
} from "./public/request-flow.js";
import { listModelsEvento } from "./public/list-models.js";
import {
  putDocEvento,
  getDocEvento,
  queryDocsEvento,
  deleteDocEvento,
  subscribeDocsEvento,
  listDbNamesEvento,
} from "./public/app-documents.js";

export const vibesMsgEvento = Lazy(() => {
  const evento = new Evento(new W3CWebSocketEventEventoEnDecoder());
  evento.push(
    ensureAppSlugItemEvento,
    // getByUserSlugAppSlugItemEvento,
    getFPCloudTokenEvento,
    listUserSlugAppSlugEvento,
    getChatDetailsEvento,
    getAppByFsIdEvento,
    openChat,
    promptChatSection,
    createInviteEvento,
    revokeInviteEvento,
    redeemInviteEvento,
    hasAccessInviteEvento,
    inviteSetRoleEvento,
    listInviteGrantsEvento,
    requestAccessEvento,
    hasAccessRequestEvento,
    approveRequestEvento,
    requestSetRoleEvento,
    revokeRequestEvento,
    listRequestGrantsEvento,
    getCertFromCsrEvento,
    listModelsEvento,
    ensureAppSettingsEvento,
    setModeFsIdEvento,
    forkAppEvento,
    ensureUserSettingsEvento,
    listApplicationChats,
    listUserSlugBindingsEvento,
    createUserSlugBindingEvento,
    deleteUserSlugBindingEvento,
    putDocEvento,
    getDocEvento,
    queryDocsEvento,
    deleteDocEvento,
    subscribeDocsEvento,
    listDbNamesEvento,
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
        console.error("vibesMsgEvento error-handler", ctx.error, (ctx.error as { cause?: unknown })?.cause);
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
