/**
 * ShardKind — the Durable Object shard a connection is opened against. The kind
 * names the *workload that needs isolation*, not the transport (streaming is not
 * exclusive to "codegen": the vibe shard streams too, for img-gen). See #2714.
 */
export type ShardKind = "codegen" | "vibe" | "shared";

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
