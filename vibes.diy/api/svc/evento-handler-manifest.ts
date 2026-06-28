import { EventoHandler } from "@adviser/cement";
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

/**
 * ShardKind — the Durable Object shard a connection is opened against. This is
 * the ONLY thing that distinguishes the former chat / vibe / shared "APIs": one
 * handler surface, opened against a different shard key (#2714). Stop reasoning
 * about "which API is which" and reason about "what shard kind is correct."
 *
 *   - "stream": per-stream UUID shard (ChatSessions). A heavy codegen stream
 *     gets its own worker — you can't co-tenant many live streams.
 *   - "vibe":   `ownerHandle--appSlug` shard (AppSessions). All viewers of one
 *     vibe rendezvous on one DO → cross-user live broadcast + local QuickJS
 *     access-fn eval.
 *   - "shared": singleton / userId shard (SharedSessions). One always-warm DO
 *     for stateless user/identity reads — no cold-start wait, no topology.
 */
export type ShardKind = "stream" | "vibe" | "shared";

/**
 * A handler tagged with the shard kinds allowed to serve it. The `allowed` set
 * is the SINGLE SOURCE OF TRUTH for placement: the per-plane evento composition
 * (this file) and the parity tests both read it, so there is nothing to keep in
 * sync. Re-homing a capability between planes is now a one-line `allowed` edit,
 * not a handler-array shuffle (the recurring cost in #2265, #2517, #2710).
 */
export interface HandlerManifestEntry {
  readonly allowed: readonly ShardKind[];
  readonly handler: EventoHandler;
}

// Allowed-set presets. Named so the manifest reads as a contract.
const ALL_SHARDS: readonly ShardKind[] = ["stream", "vibe", "shared"];
const VIBE_ONLY: readonly ShardKind[] = ["vibe"];
const STREAM_ONLY: readonly ShardKind[] = ["stream"];
// open-chat / prompt-chat-section run on the stream plane (their canonical home)
// AND the vibe plane: img-gen rides vibeApi → AppSessions, so `req-open-chat
// {mode:img}` must resolve there too. Declaring it here folds away the old
// `imgGenAppSessionStopgapHandlers` array (#2350) — the capability is just
// allowed on two shard kinds, no separate stopgap to track.
// TODO(#2350): once img streaming moves to the heavy/chat session, revert the
// open-chat / prompt entries below to STREAM_ONLY (drop them from the vibe
// shard). See docs/superpowers/specs/2026-06-16-heavy-light-session-design.md.
const STREAM_AND_VIBE: readonly ShardKind[] = ["stream", "vibe"];

function entry(allowed: readonly ShardKind[], handler: EventoHandler): HandlerManifestEntry {
  return { allowed, handler };
}

/**
 * The handler manifest — one list, each handler declaring the shard kinds that
 * may serve it. Ordering is preserved per shard by `handlersForShard`, so the
 * composed eventos match the historical (shared → vibe → stream) push order.
 *
 * Two reasons a handler is shard-bound (#2714):
 *   (a) code/capability presence — dissolved by loading the capability on the
 *       allowed planes; not a security boundary.
 *   (b) stateful rendezvous / topology — irreducible. A doc write does LOCAL
 *       broadcast on the vibe shard; `subscribeDocs` / `subscribeViewerGrants`
 *       fan out to co-tenant sockets that only exist there; chat streaming has
 *       per-shard backpressure. These stay `VIBE_ONLY` / `STREAM_*` and (next
 *       step, see agents/do-session-split.md) keep a fail-loud runtime identity
 *       gate at dispatch. Types enforce *kind*; runtime enforces *identity*.
 */
export const handlerManifest: readonly HandlerManifestEntry[] = [
  // --- Shared: stateless user/identity/D1 reads + grant ops. Served on every
  // shard kind — no broadcast, no per-shard state, safe everywhere.
  entry(ALL_SHARDS, listUserSlugAppSlugEvento),
  entry(ALL_SHARDS, listRecentVibesEvento),
  entry(ALL_SHARDS, pinRecentVibeEvento),
  entry(ALL_SHARDS, getAppByFsIdEvento),
  entry(ALL_SHARDS, ensureAppSettingsEvento),
  entry(ALL_SHARDS, ensureUserSettingsEvento),
  entry(ALL_SHARDS, ensureHandleAvatarEvento),
  entry(ALL_SHARDS, listModelsEvento),
  // Grants, invites, membership — stateless D1 queries called from the parent app.
  entry(ALL_SHARDS, createInviteEvento),
  entry(ALL_SHARDS, revokeInviteEvento),
  entry(ALL_SHARDS, redeemInviteEvento),
  entry(ALL_SHARDS, hasAccessInviteEvento),
  entry(ALL_SHARDS, inviteSetRoleEvento),
  entry(ALL_SHARDS, listInviteGrantsEvento),
  entry(ALL_SHARDS, requestAccessEvento),
  entry(ALL_SHARDS, hasAccessRequestEvento),
  entry(ALL_SHARDS, approveRequestEvento),
  entry(ALL_SHARDS, requestSetRoleEvento),
  entry(ALL_SHARDS, revokeRequestEvento),
  entry(ALL_SHARDS, listRequestGrantsEvento),
  entry(ALL_SHARDS, subscribeRequestGrantsEvento),
  entry(ALL_SHARDS, listMembersEvento),
  entry(ALL_SHARDS, listMembershipsEvento),
  entry(ALL_SHARDS, whoAmIEvento),
  entry(ALL_SHARDS, accessFnSourceEvento),
  entry(ALL_SHARDS, subscribeUserNotificationsEvento),
  // User/identity-scoped reads + grant ops NOT tied to any vibe shard:
  //   - listDmThreads: the DM inbox read (DmInbox, vibe-route badge).
  //   - assetUploadGrant: issues an R2 upload grant for handle-avatar uploads
  //     (HandleAvatarEditor) and srv-sandbox putAsset — no broadcast/access-fn.
  entry(ALL_SHARDS, listDmThreadsEvento),
  entry(ALL_SHARDS, assetUploadGrantEvento),
  // Identity/settings/analytics D1 ops called from non-chat pages (settings,
  // messages, reporting dashboard).
  entry(ALL_SHARDS, listHandleBindingsEvento),
  entry(ALL_SHARDS, createHandleBindingEvento),
  entry(ALL_SHARDS, deleteHandleBindingEvento),
  entry(ALL_SHARDS, getCertFromCsrEvento),
  entry(ALL_SHARDS, reportGrowthMembershipsEvento),
  entry(ALL_SHARDS, reportGrowthVibesWithDataEvento),
  entry(ALL_SHARDS, reportActiveMembersEvento),
  entry(ALL_SHARDS, reportTopVibesByMembersEvento),
  entry(ALL_SHARDS, reportAttributionReferrersEvento),
  entry(ALL_SHARDS, reportCampaignHealthEvento),
  entry(ALL_SHARDS, reportCampaignAdPreviewsEvento),
  // Chat-history READS are plain D1 queries, not streams — every shard can serve
  // them, so the /vibe route reads a vibe's latest suggestion chips without
  // opening the heavy stream socket. Only the long-lived streaming ops below
  // actually need the stream shard.
  entry(ALL_SHARDS, getChatDetailsEvento),
  entry(ALL_SHARDS, getChatResponseEvento),
  entry(ALL_SHARDS, listApplicationChats),

  // --- Vibe: channel-scoped doc ops. Category (b) — local broadcast + local
  // QuickJS access-fn eval rendezvous on the vibe shard, so these must land
  // there and nowhere else. DM message docs reach them via the channel-keyed
  // dmApi (`<channelUserSlug>--dm`).
  entry(VIBE_ONLY, putDocEvento),
  entry(VIBE_ONLY, getDocEvento),
  entry(VIBE_ONLY, queryDocsEvento),
  entry(VIBE_ONLY, deleteDocEvento),
  entry(VIBE_ONLY, subscribeDocsEvento),
  entry(VIBE_ONLY, subscribeViewerGrantsEvento),
  entry(VIBE_ONLY, listDbNamesEvento),
  entry(VIBE_ONLY, markDmReadEvento),

  // --- Stream: chat streaming + the create/fork/mode write ops. Streaming is
  // category (b) — you can't co-tenant many long streams in one worker.
  entry(STREAM_ONLY, ensureAppSlugItemEvento),
  entry(STREAM_AND_VIBE, openChat),
  entry(STREAM_AND_VIBE, promptChatSection),
  entry(STREAM_ONLY, forkAppEvento),
  entry(STREAM_ONLY, setModeFsIdEvento),
];

/**
 * The handlers a DO opened against `kind` must serve, in manifest order. This is
 * how each plane's evento is composed — there is no per-plane handler array to
 * maintain anymore; the plane is just a filter over the manifest by shard kind.
 */
export function handlersForShard(kind: ShardKind): EventoHandler[] {
  return handlerManifest.filter((e) => e.allowed.includes(kind)).map((e) => e.handler);
}
