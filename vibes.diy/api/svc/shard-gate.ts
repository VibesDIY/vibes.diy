import { EventoHandler, EventoResult, HandleTriggerCtx, Option, Result } from "@adviser/cement";
import { openVibe, shardsForReq, type ResError, type ShardIdentity } from "@vibes.diy/api-types";

// The runtime shard gate (#2714). Types enforce *kind* at composition time;
// this gate enforces *identity* at dispatch time, fail-loud. It wraps each
// manifest handler so a wrong-shard request sends a coded `ResError` and never
// reaches the handler — no D1 write, no broadcast.

/**
 * The vibe-key identity assertion: a vibe-keyed doc op must address the shard it
 * landed on. Returns `Some(ResError)` when `openVibe(ownerHandle, appSlug)` does
 * not equal the connection's `shardId`, else `None`. The split-brain defense
 * (#2714): a request routed to the wrong vibe DO must be rejected BEFORE any
 * write or broadcast, since those would mutate / fan out on the wrong shard.
 */
export function shardIdentityError(id: ShardIdentity, ownerHandle: string, appSlug: string): Option<ResError> {
  // openVibe is the single source of truth for the vibe-key format; compare as
  // strings (the constructor returns a branded VibeShard).
  const expected: string = openVibe(ownerHandle, appSlug);
  if (expected === id.shardId) return Option.None();
  return Option.Some({
    type: "vibes.diy.res-error",
    error: {
      message: `request for ${expected} arrived on shard ${id.shardId}`,
      code: "wrong-shard",
    },
  } satisfies ResError);
}

// A doc-op request carries the vibe key parts inline. Narrowed structurally
// (not by reqType) so the identity gate can run on any vibe-shard op that
// addresses an explicit (ownerHandle, appSlug).
interface VibeKeyedReq {
  readonly ownerHandle: string;
  readonly appSlug: string;
}

function vibeKeyedReq(req: unknown): VibeKeyedReq | undefined {
  if (typeof req !== "object" || req === null) return undefined;
  const r = req as Record<string, unknown>;
  if (typeof r.ownerHandle === "string" && typeof r.appSlug === "string") {
    return { ownerHandle: r.ownerHandle, appSlug: r.appSlug };
  }
  return undefined;
}

/**
 * Wrap `handler` so its `handle` is preceded by the kind+mode gate (and, for the
 * vibe shard, the inline-key identity gate). All other handler fields (`hash`,
 * `validate`, `type`, `post`) are preserved unchanged so composition order and
 * the parity tests keep working.
 *
 * Behavior-preserving for legitimate traffic: when no `shardIdentity` is set in
 * the AppContext (non-DO / test paths that drive the monolith evento), the gate
 * is skipped entirely and the handler runs as before.
 */
export function gated(reqType: string, handler: EventoHandler): EventoHandler {
  return {
    ...handler,
    handle: async (ctx) => {
      const id = ctx.ctx.get<ShardIdentity>("shardIdentity");
      if (id === undefined) {
        // No identity injected (non-DO / test monolith path) — keep prior behavior.
        return handler.handle(ctx);
      }
      const validated = ctx.validated as { payload?: unknown } | undefined;
      const req = (validated?.payload as { mode?: string } | undefined) ?? {};
      const allowed = shardsForReq(reqType, req);
      if (!allowed.includes(id.kind)) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: {
            message: `${reqType} not allowed on shard kind ${id.kind}`,
            code: "wrong-shard-kind",
          },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }
      // Identity gate for vibe-keyed doc ops: the canonical target is carried
      // inline (ownerHandle/appSlug), so assert it BEFORE any write/broadcast.
      // Chat ops (open-chat / prompt) resolve their canonical target only after
      // the lookup, so they run the same check post-resolution in their handler.
      //
      // Only vibe-SCOPED ops (those a shared shard can't serve) get the identity
      // gate. Shared-safe ops (ALL_SHARDS: grants, D1 reads, membership) are
      // stateless — they write no vibe-shard doc state and may legitimately
      // address a DIFFERENT vibe key than the shard they were multiplexed onto.
      // The canonical case: requesting an avatar-upload grant for `<handle>--_profile`
      // over a vibe page's connection, which is pinned to that page's vibe shard
      // (`sharedApi === vibeApi`). Gating those by identity would reject a valid
      // cross-key grant (#2714 was too broad; the split-brain defense only needs
      // the doc ops). `allowed` includes "shared" exactly for the ALL_SHARDS ops.
      if (id.kind === "vibe" && !allowed.includes("shared")) {
        const keyed = vibeKeyedReq(req);
        if (keyed !== undefined) {
          const oErr = shardIdentityError(id, keyed.ownerHandle, keyed.appSlug);
          if (oErr.IsSome()) {
            await ctx.send.send(ctx, oErr.unwrap());
            return Result.Ok(EventoResult.Continue);
          }
        }
      }
      return handler.handle(ctx);
    },
  };
}

/**
 * Post-resolution chat-identity gate (#2714), shared by the chat ops whose
 * canonical target is only known after a lookup (open-chat, prompt-chat-section).
 * Returns `Some(ResError)` only on the vibe shard when the resolved
 * (ownerHandle, appSlug) does not address THIS shard; `None` otherwise (no
 * identity, non-vibe kind, or a match). Callers send the Option and stop:
 *   const oErr = assertChatShardIdentity(ctx, ownerHandle, appSlug);
 *   if (oErr.IsSome()) { await ctx.send.send(ctx, oErr.unwrap()); return Result.Ok(EventoResult.Continue); }
 */
export function assertChatShardIdentity<INREQ, REQ, RES>(
  ctx: HandleTriggerCtx<INREQ, REQ, RES>,
  ownerHandle: string,
  appSlug: string
): Option<ResError> {
  const id = ctx.ctx.get<ShardIdentity>("shardIdentity");
  if (id === undefined || id.kind !== "vibe") return Option.None();
  return shardIdentityError(id, ownerHandle, appSlug);
}
