import { EventoHandler } from "@adviser/cement";
import { PROBE_MODES, shardsForReq, type ReqType, type ShardKind } from "@vibes.diy/api-types";
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

// Re-export ShardKind from @vibes.diy/api-types so existing importers of this
// module (the per-plane evento composition, the parity tests) keep working
// after the type moved to the browser-safe leaf package (#2714).
export type { ShardKind };

/**
 * A handler mapped to its request `type` discriminant. Placement is no longer
 * inlined here: the allowed shard kinds derive from `SHARD_POLICY` in
 * `@vibes.diy/api-types` (the SINGLE SOURCE OF TRUTH that the browser and worker
 * both read), keyed by `reqType`. Re-homing a capability between planes is now a
 * one-line edit in that policy, not a handler-array shuffle (#2265, #2517, #2710).
 */
export interface HandlerManifestEntry {
  readonly reqType: ReqType;
  readonly handler: EventoHandler;
}

function entry(reqType: ReqType, handler: EventoHandler): HandlerManifestEntry {
  return { reqType, handler };
}

/**
 * The handler manifest — one list, each handler mapped to its request `type`.
 * Ordering is preserved per shard by `handlersForShard`, so the composed eventos
 * match the historical (shared → vibe → codegen) push order.
 *
 * Two reasons a handler is shard-bound (#2714), both expressed in `SHARD_POLICY`:
 *   (a) code/capability presence — dissolved by loading the capability on the
 *       allowed planes; not a security boundary.
 *   (b) stateful rendezvous / topology — irreducible. A doc write does LOCAL
 *       broadcast on the vibe shard; `subscribeDocs` / `subscribeViewerGrants`
 *       fan out to co-tenant sockets that only exist there; chat streaming has
 *       per-shard backpressure. These stay vibe-only / codegen-only and keep a
 *       fail-loud runtime identity gate at dispatch. Types enforce *kind*;
 *       runtime enforces *identity*.
 */
export const handlerManifest: readonly HandlerManifestEntry[] = [
  // --- Shared: stateless user/identity/D1 reads + grant ops. Served on every
  // shard kind — no broadcast, no per-shard state, safe everywhere.
  entry("vibes.diy.req-list-user-slug-app-slug", listUserSlugAppSlugEvento),
  entry("vibes.diy.req-list-recent-vibes", listRecentVibesEvento),
  entry("vibes.diy.req-pin-recent-vibe", pinRecentVibeEvento),
  entry("vibes.diy.req-get-app-by-fsid", getAppByFsIdEvento),
  entry("vibes.diy.req-ensure-app-settings", ensureAppSettingsEvento),
  entry("vibes.diy.req-ensure-user-settings", ensureUserSettingsEvento),
  entry("vibes.diy.req-ensure-handle-avatar", ensureHandleAvatarEvento),
  entry("vibes.diy.req-list-models", listModelsEvento),
  // Grants, invites, membership — stateless D1 queries called from the parent app.
  entry("vibes.diy.req-create-invite", createInviteEvento),
  entry("vibes.diy.req-revoke-invite", revokeInviteEvento),
  entry("vibes.diy.req-redeem-invite", redeemInviteEvento),
  entry("vibes.diy.req-has-access-invite", hasAccessInviteEvento),
  entry("vibes.diy.req-invite-set-role", inviteSetRoleEvento),
  entry("vibes.diy.req-list-invite-grants", listInviteGrantsEvento),
  entry("vibes.diy.req-request-access", requestAccessEvento),
  entry("vibes.diy.req-has-access-request", hasAccessRequestEvento),
  entry("vibes.diy.req-approve-request", approveRequestEvento),
  entry("vibes.diy.req-request-set-role", requestSetRoleEvento),
  entry("vibes.diy.req-revoke-request", revokeRequestEvento),
  entry("vibes.diy.req-list-request-grants", listRequestGrantsEvento),
  entry("vibes.diy.req-subscribe-request-grants", subscribeRequestGrantsEvento),
  entry("vibes.diy.req-list-members", listMembersEvento),
  entry("vibes.diy.req-list-memberships", listMembershipsEvento),
  entry("vibe.req.whoAmI", whoAmIEvento),
  entry("vibe.req.accessFnSource", accessFnSourceEvento),
  entry("vibes.diy.req-subscribe-user-notifications", subscribeUserNotificationsEvento),
  // User/identity-scoped reads + grant ops NOT tied to any vibe shard:
  //   - listDmThreads: the DM inbox read (DmInbox, vibe-route badge).
  //   - assetUploadGrant: issues an R2 upload grant for handle-avatar uploads
  //     (HandleAvatarEditor) and srv-sandbox putAsset — no broadcast/access-fn.
  entry("vibes.diy.req-list-dm-threads", listDmThreadsEvento),
  entry("vibes.diy.req-asset-upload-grant", assetUploadGrantEvento),
  // Identity/settings/analytics D1 ops called from non-chat pages (settings,
  // messages, reporting dashboard).
  entry("vibes.diy.req-list-user-slug-bindings", listHandleBindingsEvento),
  entry("vibes.diy.req-create-user-slug-binding", createHandleBindingEvento),
  entry("vibes.diy.req-delete-user-slug-binding", deleteHandleBindingEvento),
  entry("reqCertFromCsr", getCertFromCsrEvento),
  entry("vibes.diy.req-report-growth-memberships", reportGrowthMembershipsEvento),
  entry("vibes.diy.req-report-growth-vibes-with-data", reportGrowthVibesWithDataEvento),
  entry("vibes.diy.req-report-active-members", reportActiveMembersEvento),
  entry("vibes.diy.req-report-top-vibes-by-members", reportTopVibesByMembersEvento),
  entry("vibes.diy.req-report-attribution-referrers", reportAttributionReferrersEvento),
  entry("vibes.diy.req-report-campaign-health", reportCampaignHealthEvento),
  entry("vibes.diy.req-report-campaign-ad-previews", reportCampaignAdPreviewsEvento),
  // Chat-history READS are plain D1 queries, not streams — every shard can serve
  // them, so the /vibe route reads a vibe's latest suggestion chips without
  // opening the heavy codegen socket. Only the long-lived streaming ops below
  // actually need the codegen shard.
  entry("vibes.diy.req-get-chat-details", getChatDetailsEvento),
  entry("vibes.diy.req-get-chat-response", getChatResponseEvento),
  entry("vibes.diy.req-list-application-chats", listApplicationChats),

  // --- Vibe: channel-scoped doc ops. Category (b) — local broadcast + local
  // QuickJS access-fn eval rendezvous on the vibe shard, so these must land
  // there and nowhere else. DM message docs reach them via the channel-keyed
  // dmApi (`<channelUserSlug>--dm`).
  entry("vibes.diy.req-put-doc", putDocEvento),
  entry("vibes.diy.req-get-doc", getDocEvento),
  entry("vibes.diy.req-query-docs", queryDocsEvento),
  entry("vibes.diy.req-delete-doc", deleteDocEvento),
  entry("vibes.diy.req-subscribe-docs", subscribeDocsEvento),
  entry("vibes.diy.req-subscribe-viewer-grants", subscribeViewerGrantsEvento),
  entry("vibes.diy.req-list-db-names", listDbNamesEvento),
  entry("vibes.diy.req-mark-dm-read", markDmReadEvento),

  // --- Codegen: chat streaming + the create/fork/mode write ops. Streaming is
  // category (b) — you can't co-tenant many long streams in one worker. open-chat
  // / prompt also resolve on the vibe shard for img-gen (refined by `req.mode`).
  entry("vibes.diy.req-ensure-app-slug", ensureAppSlugItemEvento),
  entry("vibes.diy.req-open-chat", openChat),
  entry("vibes.diy.req-prompt-chat-section", promptChatSection),
  entry("vibes.diy.req-fork-app", forkAppEvento),
  entry("vibes.diy.req-set-mode-fs", setModeFsIdEvento),
];

// Canonical: the shard kinds in their iteration/dispatch order. Distinct from
// the policy's `ALL_SHARDS` preset (which is a *value* meaning "every shard");
// `KINDS` is the *order* we probe and filter by.
const KINDS: readonly ShardKind[] = ["codegen", "vibe", "shared"];

/**
 * The shard kinds that may serve `reqType`, taken as the UNION across every
 * possible request `mode` (`PROBE_MODES`) so a mode-refined op (open-chat /
 * prompt) registers on every shard it can ever serve. This reproduces the
 * pre-#2714 static `allowed` set per handler: composition-time membership is the
 * union; the per-request `mode` predicate then refines placement at dispatch
 * time. Exported so the parity test consumes this production derivation rather
 * than re-implementing it.
 */
export function allowedKinds(reqType: ReqType): readonly ShardKind[] {
  return KINDS.filter((k) => PROBE_MODES.some((mode) => shardsForReq(reqType, { mode }).includes(k)));
}

/**
 * The handlers a DO opened against `kind` must serve, in manifest order. This is
 * how each plane's evento is composed — there is no per-plane handler array to
 * maintain anymore; the plane is just a filter over the manifest by shard kind,
 * with the allowed set derived from `SHARD_POLICY`.
 */
export function handlersForShard(kind: ShardKind): EventoHandler[] {
  return handlerManifest.filter((e) => allowedKinds(e.reqType).includes(kind)).map((e) => e.handler);
}
