import { canonicalModelUsage } from "./chat.js";

/**
 * ShardKind — the Durable Object shard a connection is opened against. The kind
 * names the *workload that needs isolation*, not the transport (streaming is not
 * exclusive to "codegen": the vibe shard streams too, for img-gen). See #2714.
 */
export type ShardKind = "codegen" | "vibe" | "shared";

/** A concrete opened shard: its kind plus the branded id used to address it. */
export interface ShardIdentity {
  readonly kind: ShardKind;
  readonly shardId: string;
}

export type VibeShard = string & { readonly __brand: "vibe" };
export type SharedShard = string & { readonly __brand: "shared" };
export type CodegenShard = string & { readonly __brand: "codegen" };

// Constructors mint the branded keys. Keep them total (no throw): callers
// already hold validated inputs at the open-site. `openVibe` builds the key
// from owner/slug parts; `openShared`/`openCodegen` brand a caller-supplied
// shard id (defaulting to "global" for the shared shard).
export function openVibe(ownerHandle: string, appSlug: string): VibeShard {
  return `${ownerHandle}--${appSlug}` as VibeShard;
}
export function openShared(shard = "global"): SharedShard {
  return shard as SharedShard;
}
export function openCodegen(streamId: string): CodegenShard {
  return streamId as CodegenShard;
}

// open-chat / prompt encode their workload in `req.mode`, not the request type.
// codegen → codegen shard only; img → codegen + vibe (img-gen rides AppSessions);
// runtime → codegen.
export function chatShardsForMode(mode: string | undefined): readonly ShardKind[] {
  switch (canonicalModelUsage(mode ?? "codegen")) {
    case "img":
      return ["codegen", "vibe"];
    case "codegen":
    case "runtime":
    default:
      return ["codegen"];
  }
}

// Every chat `mode` a request can carry — probed to take the UNION placement at
// composition time. Only modes here, not ShardKinds: `chatShardsForMode` branches
// img vs the codegen/runtime default, so this set covers every distinct outcome.
export const PROBE_MODES: readonly string[] = ["codegen", "img", "runtime"];

type PolicyEntry = readonly ShardKind[] | ((req: { mode?: string }) => readonly ShardKind[]);

// Allowed-set presets, named so the policy reads as a contract. Mirrors the
// pre-#2714 manifest semantics: ALL = stateless reads/grants safe on every
// shard; VIBE_ONLY = channel-scoped doc ops (local broadcast + access-fn eval
// rendezvous on the vibe shard); CODEGEN_ONLY = the create/fork/mode write ops.
// `as const` (not an explicit `readonly ShardKind[]` annotation) so each preset
// keeps its literal tuple type — `Conn<K>` (vibes-diy-api.ts) reads these tuples
// out of `SHARD_POLICY` to derive per-shard method availability, which only works
// if the element literals survive. Runtime values are unchanged; the `satisfies`
// on SHARD_POLICY still enforces every entry is a valid PolicyEntry.
const ALL_SHARDS = ["codegen", "vibe", "shared"] as const;
const VIBE_ONLY = ["vibe"] as const;
const CODEGEN_ONLY = ["codegen"] as const;

/**
 * The single source of truth for handler placement (#2714), keyed by the request
 * `type` discriminant. Both the browser and the worker read this one map. Each
 * value is either a static shard set or — for the chat ops whose workload lives
 * in `req.mode` (open-chat / prompt) — a predicate refining placement per
 * request. The worker manifest derives its `allowed` sets from here, so this
 * enumeration must stay 1:1 with the handler manifest (asserted by the parity
 * test).
 */
export const SHARD_POLICY = {
  // --- Stateless user/identity/D1 reads + grant/invite/request/membership ops.
  "vibes.diy.req-list-user-slug-app-slug": ALL_SHARDS,
  "vibes.diy.req-list-recent-vibes": ALL_SHARDS,
  "vibes.diy.req-pin-recent-vibe": ALL_SHARDS,
  "vibes.diy.req-set-unpublish": ALL_SHARDS,
  "vibes.diy.req-get-app-by-fsid": ALL_SHARDS,
  "vibes.diy.req-list-versions": ALL_SHARDS,
  "vibes.diy.req-ensure-app-settings": ALL_SHARDS,
  "vibes.diy.req-ensure-user-settings": ALL_SHARDS,
  "vibes.diy.req-ensure-handle-avatar": ALL_SHARDS,
  "vibes.diy.req-list-models": ALL_SHARDS,
  "vibes.diy.req-create-invite": ALL_SHARDS,
  "vibes.diy.req-revoke-invite": ALL_SHARDS,
  "vibes.diy.req-redeem-invite": ALL_SHARDS,
  "vibes.diy.req-has-access-invite": ALL_SHARDS,
  "vibes.diy.req-invite-set-role": ALL_SHARDS,
  "vibes.diy.req-list-invite-grants": ALL_SHARDS,
  "vibes.diy.req-request-access": ALL_SHARDS,
  "vibes.diy.req-has-access-request": ALL_SHARDS,
  "vibes.diy.req-approve-request": ALL_SHARDS,
  "vibes.diy.req-request-set-role": ALL_SHARDS,
  "vibes.diy.req-revoke-request": ALL_SHARDS,
  "vibes.diy.req-list-request-grants": ALL_SHARDS,
  "vibes.diy.req-subscribe-request-grants": ALL_SHARDS,
  "vibes.diy.req-list-members": ALL_SHARDS,
  "vibes.diy.req-list-memberships": ALL_SHARDS,
  "vibe.req.whoAmI": ALL_SHARDS,
  "vibe.req.accessFnSource": ALL_SHARDS,
  "vibes.diy.req-subscribe-user-notifications": ALL_SHARDS,
  "vibes.diy.req-list-dm-threads": ALL_SHARDS,
  "vibes.diy.req-asset-upload-grant": ALL_SHARDS,
  "vibes.diy.req-list-user-slug-bindings": ALL_SHARDS,
  "vibes.diy.req-create-user-slug-binding": ALL_SHARDS,
  "vibes.diy.req-delete-user-slug-binding": ALL_SHARDS,
  reqCertFromCsr: ALL_SHARDS,
  "vibes.diy.req-report-growth-memberships": ALL_SHARDS,
  "vibes.diy.req-report-growth-vibes-with-data": ALL_SHARDS,
  "vibes.diy.req-report-active-members": ALL_SHARDS,
  "vibes.diy.req-report-top-vibes-by-members": ALL_SHARDS,
  "vibes.diy.req-report-attribution-referrers": ALL_SHARDS,
  "vibes.diy.req-report-campaign-health": ALL_SHARDS,
  "vibes.diy.req-report-campaign-ad-previews": ALL_SHARDS,
  // Chat-history READS are plain D1 queries, not streams — every shard serves them.
  "vibes.diy.req-get-chat-details": ALL_SHARDS,
  "vibes.diy.req-get-chat-response": ALL_SHARDS,
  "vibes.diy.req-list-application-chats": ALL_SHARDS,
  "vibes.diy.req-list-codegen-chats": ALL_SHARDS,
  "vibes.diy.req-get-application-chat": ALL_SHARDS,

  // --- Vibe: channel-scoped doc ops (local broadcast + access-fn rendezvous).
  "vibes.diy.req-put-doc": VIBE_ONLY,
  "vibes.diy.req-get-doc": VIBE_ONLY,
  "vibes.diy.req-query-docs": VIBE_ONLY,
  "vibes.diy.req-delete-doc": VIBE_ONLY,
  "vibes.diy.req-subscribe-docs": VIBE_ONLY,
  "vibes.diy.req-subscribe-viewer-grants": VIBE_ONLY,
  "vibes.diy.req-list-db-names": VIBE_ONLY,
  "vibes.diy.req-mark-dm-read": VIBE_ONLY,

  // --- Codegen: chat streaming + the create/fork/mode write ops. open-chat /
  // prompt refine placement by `req.mode` (img-gen also rides the vibe shard).
  "vibes.diy.req-ensure-app-slug": CODEGEN_ONLY,
  "vibes.diy.req-open-chat": (req) => chatShardsForMode(req.mode),
  "vibes.diy.req-prompt-chat-section": (req) => chatShardsForMode(req.mode),
  "vibes.diy.req-fork-app": CODEGEN_ONLY,
  "vibes.diy.req-publish-app": CODEGEN_ONLY,
  "vibes.diy.req-set-mode-fs": CODEGEN_ONLY,
} as const satisfies Record<string, PolicyEntry>;

export type ReqType = keyof typeof SHARD_POLICY;

/** The shard kinds that may serve `reqType` for the given request. */
export function shardsForReq(reqType: string, req: { mode?: string }): readonly ShardKind[] {
  // widen to index by an arbitrary (possibly unknown) reqType; unknown → undefined → no placement (fail-closed)
  const entry = (SHARD_POLICY as Record<string, PolicyEntry | undefined>)[reqType];
  if (entry === undefined) return [];
  return typeof entry === "function" ? entry(req) : entry;
}
