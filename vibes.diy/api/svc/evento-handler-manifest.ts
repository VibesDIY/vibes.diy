import { ensureAppSlugItemEvento } from "./public/ensure-app-slug-item.js";
import { openChat } from "./public/open-chat.js";
import { promptChatSection } from "./public/prompt-chat-section.js";
import { listUserSlugAppSlugEvento } from "./public/list-user-slug-app-slug.js";
import { listRecentVibesEvento } from "./public/list-recent-vibes.js";
import { pinRecentVibeEvento } from "./public/pin-recent-vibe.js";
import { getChatDetailsEvento } from "./public/get-chat-details.js";
import { getAppByFsIdEvento } from "./public/get-app-by-fsid.js";
import { ensureUserSettingsEvento } from "./public/ensure-user-settings.js";
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
  listModelsEvento,
  // Grants, invites, membership — stateless D1 queries called from parent app
  // on chatApi (chat connection). Registered on both DOs until client routing
  // is fully split (#2263).
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
  subscribeUserNotificationsEvento,
] as const;

export const appHandlers = [
  // Doc ops use notification callbacks (local broadcast on AppSessions,
  // guarded no-op on ChatSessions). Registered on both DOs until client
  // routing is fully split (#2263).
  putDocEvento,
  getDocEvento,
  queryDocsEvento,
  deleteDocEvento,
  subscribeDocsEvento,
  subscribeViewerGrantsEvento,
  listDbNamesEvento,
  listDmThreadsEvento,
  markDmReadEvento,
  assetUploadGrantEvento,
] as const;

export const chatHandlers = [
  ensureAppSlugItemEvento,
  openChat,
  promptChatSection,
  getChatDetailsEvento,
  listApplicationChats,
  forkAppEvento,
  setModeFsIdEvento,
  getCertFromCsrEvento,
  listHandleBindingsEvento,
  createHandleBindingEvento,
  deleteHandleBindingEvento,
  reportGrowthMembershipsEvento,
  reportGrowthVibesWithDataEvento,
  reportActiveMembersEvento,
  reportTopVibesByMembersEvento,
  reportAttributionReferrersEvento,
  reportCampaignHealthEvento,
  reportCampaignAdPreviewsEvento,
] as const;
