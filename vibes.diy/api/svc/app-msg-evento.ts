import { Lazy, Evento, EventoResult, EventoType, Result } from "@adviser/cement";
import { W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { ResError } from "@vibes.diy/api-types";
import { listUserSlugAppSlugEvento } from "./public/list-user-slug-app-slug.js";
import { listRecentVibesEvento } from "./public/list-recent-vibes.js";
import { pinRecentVibeEvento } from "./public/pin-recent-vibe.js";
import { getAppByFsIdEvento } from "./public/get-app-by-fsid.js";
import { ensureUserSettingsEvento } from "./public/ensure-user-settings.js";
import { ensureAppSettingsEvento } from "./public/ensure-app-settings.js";
import {
  createInviteEvento,
  revokeInviteEvento,
  redeemInviteEvento,
  hasAccessInviteEvento,
  inviteSetRoleEvento,
  listInviteGrantsEvento,
} from "./public/invite-flow.js";
import {
  listRequestGrantsEvento,
  subscribeRequestGrantsEvento,
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
  subscribeViewerGrantsEvento,
  listDbNamesEvento,
  listDmThreadsEvento,
  markDmReadEvento,
} from "./public/app-documents.js";
import { listMembersEvento } from "./public/list-members.js";
import { listMembershipsEvento } from "./public/list-memberships.js";
import { whoAmIEvento } from "./public/who-am-i.js";
import { assetUploadGrantEvento } from "./public/asset-upload-grant.js";
import { subscribeUserNotificationsEvento } from "./public/subscribe-user-notifications.js";

export const appMsgEvento = Lazy(() => {
  const evento = new Evento(new W3CWebSocketEventEventoEnDecoder());
  evento.push(
    // Shared stateless (both DOs)
    listUserSlugAppSlugEvento,
    listRecentVibesEvento,
    pinRecentVibeEvento,
    getAppByFsIdEvento,
    ensureAppSettingsEvento,
    ensureUserSettingsEvento,
    listModelsEvento,
    // Data operations: vibe-scoped
    putDocEvento,
    getDocEvento,
    queryDocsEvento,
    deleteDocEvento,
    subscribeDocsEvento,
    subscribeViewerGrantsEvento,
    listDbNamesEvento,
    listDmThreadsEvento,
    markDmReadEvento,
    // Access control invites: vibe-scoped
    createInviteEvento,
    revokeInviteEvento,
    redeemInviteEvento,
    hasAccessInviteEvento,
    inviteSetRoleEvento,
    listInviteGrantsEvento,
    // Access control requests: vibe-scoped
    requestAccessEvento,
    hasAccessRequestEvento,
    approveRequestEvento,
    requestSetRoleEvento,
    revokeRequestEvento,
    listRequestGrantsEvento,
    subscribeRequestGrantsEvento,
    // Membership: vibe-scoped
    listMembersEvento,
    listMembershipsEvento,
    whoAmIEvento,
    // Assets: vibe-scoped
    assetUploadGrantEvento,
    // User notifications: vibe-scoped
    subscribeUserNotificationsEvento,
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
