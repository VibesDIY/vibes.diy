import { ensureAppSlugItemEvento } from "./public/ensure-app-slug-item.js";
import { openChat } from "./public/open-chat.js";
import { promptChatSection } from "./public/prompt-chat-section.js";
import { listUserSlugAppSlugEvento } from "./public/list-user-slug-app-slug.js";
import { listRecentVibesEvento } from "./public/list-recent-vibes.js";
import { pinRecentVibeEvento } from "./public/pin-recent-vibe.js";
import { getChatDetailsEvento } from "./public/get-chat-details.js";
import { getChatResponseEvento } from "./public/get-chat-response.js";
import { getAppByFsIdEvento } from "./public/get-app-by-fsid.js";
import { ensureUserSettingsEvento } from "./public/ensure-user-settings.js";
import { ensureHandleAvatarEvento } from "./public/ensure-handle-avatar.js";
import { listApplicationChats } from "./public/list-application-chats.js";
import { ensureAppSettingsEvento } from "./public/ensure-app-settings.js";
import { setModeFsIdEvento } from "./public/set-mode-fsid.js";
import { forkAppEvento } from "./public/fork-app.js";
import { getCertFromCsrEvento } from "./public/get-cert-from-csr.js";
import {
  createInviteEvento,
  revokeInviteEvento,
  redeemInviteEvento,
  hasAccessInviteEvento,
  inviteSetRoleEvento,
  listInviteGrantsEvento,
} from "./public/invite-flow.js";
import { listHandleBindingsEvento, createHandleBindingEvento, deleteHandleBindingEvento } from "./public/user-slug-bindings.js";
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
import { accessFnSourceEvento } from "./public/access-fn-source.js";
import { assetUploadGrantEvento } from "./public/asset-upload-grant.js";
import { subscribeUserNotificationsEvento } from "./public/subscribe-user-notifications.js";
import { reportGrowthMembershipsEvento } from "./public/report-growth-memberships.js";
import { reportGrowthVibesWithDataEvento } from "./public/report-growth-vibes-with-data.js";
import { reportActiveMembersEvento } from "./public/report-active-members.js";
import { reportTopVibesByMembersEvento } from "./public/report-top-vibes-by-members.js";
import { reportAttributionReferrersEvento } from "./public/report-attribution-referrers.js";
import { reportCampaignHealthEvento } from "./public/report-campaign-health.js";
import { reportCampaignAdPreviewsEvento } from "./public/report-campaign-ad-previews.js";

export const sharedHandlers = [
  listUserSlugAppSlugEvento,
  listRecentVibesEvento,
  pinRecentVibeEvento,
  getAppByFsIdEvento,
  ensureAppSettingsEvento,
  ensureUserSettingsEvento,
  ensureHandleAvatarEvento,
  listModelsEvento,
  // Grants, invites, membership — stateless D1 queries called from the parent
  // app on chatApi. They ride sharedHandlers (served on both the chat plane and
  // AppSessions) until SharedSessions lands them on their own singleton DO
  // (#2265 §2 Track B).
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
  subscribeRequestGrantsEvento,
  listMembersEvento,
  listMembershipsEvento,
  whoAmIEvento,
  accessFnSourceEvento,
  subscribeUserNotificationsEvento,
  // User/identity-scoped reads + grant ops that are NOT tied to any vibe shard
  // and are called from the parent app (and srv-sandbox) on chatApi. They belong
  // with the other stateless user-scoped handlers here, not in appHandlers —
  // that's what lets the chat plane drop appHandlers while these keep working:
  //   - listDmThreads: the DM inbox read (DmInbox, vibe-route badge).
  //   - assetUploadGrant: issues an R2 upload grant for handle-avatar uploads
  //     (HandleAvatarEditor) and srv-sandbox putAsset — no broadcast/access-fn.
  // (#2265 A2; these land on SharedSessions in Track B.)
  listDmThreadsEvento,
  assetUploadGrantEvento,
  // Re-homed from chatHandlers (#2265 Track B): stateless identity/settings/
  // analytics D1 ops called from non-chat pages (settings, messages, reporting
  // dashboard). Moving them here lets chatApi go lazy without stranding callers.
  listHandleBindingsEvento,
  createHandleBindingEvento,
  deleteHandleBindingEvento,
  getCertFromCsrEvento,
  reportGrowthMembershipsEvento,
  reportGrowthVibesWithDataEvento,
  reportActiveMembersEvento,
  reportTopVibesByMembersEvento,
  reportAttributionReferrersEvento,
  reportCampaignHealthEvento,
  reportCampaignAdPreviewsEvento,
] as const;

export const appHandlers = [
  // Vibe/channel-scoped doc ops. These ride AppSessions (vibeApi) only —
  // local broadcast + local QuickJS access-fn eval — and are NO LONGER served
  // by the chat plane (#2265 A2: chatMsgEvento dropped appHandlers). DM message
  // docs reach these via the channel-keyed dmApi (`<channelUserSlug>--dm`).
  putDocEvento,
  getDocEvento,
  queryDocsEvento,
  deleteDocEvento,
  subscribeDocsEvento,
  subscribeViewerGrantsEvento,
  listDbNamesEvento,
  markDmReadEvento,
] as const;

export const chatHandlers = [
  ensureAppSlugItemEvento,
  openChat,
  promptChatSection,
  getChatDetailsEvento,
  getChatResponseEvento,
  listApplicationChats,
  forkAppEvento,
  setModeFsIdEvento,
] as const;

// Stopgap (#2350): img-gen rides vibeApi → AppSessions, so the AppSessions
// evento must serve open-chat + prompt or `req-open-chat {mode:img}` falls
// through to the WildCard "Not Implemented". These stay in chatHandlers (their
// canonical home); this array re-exposes only the two streaming ops the img
// path needs on the app session, without polluting appHandlers (which the
// parity test pins to doc/notification ops only). Remove once img streaming
// moves to the heavy/chat session per
// docs/superpowers/specs/2026-06-16-heavy-light-session-design.md.
export const imgGenAppSessionStopgapHandlers = [openChat, promptChatSection] as const;
