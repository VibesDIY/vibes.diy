import { EventoHandler, EventoResult, Option, Result } from "@adviser/cement";
import { shardsForReq, type ResError, type ShardIdentity } from "@vibes.diy/api-types";

// The runtime shard gate (#2714). Types enforce *kind* at composition time;
// this gate enforces *identity* at dispatch time, fail-loud. It wraps each
// manifest handler so a wrong-shard request sends a coded `ResError` and never
// reaches the handler — no D1 write, no broadcast.

/**
 * The vibe-key identity assertion: a vibe-keyed doc op must address the shard it
 * landed on. Returns `Some(ResError)` when `${ownerHandle}--${appSlug}` does not
 * equal the connection's `shardId`, else `None`. The split-brain defense (#2714):
 * a request routed to the wrong vibe DO must be rejected BEFORE any write or
 * broadcast, since those would mutate / fan out on the wrong shard.
 */
export function shardIdentityError(id: ShardIdentity, ownerHandle: string, appSlug: string): Option<ResError> {
  const expected = `${ownerHandle}--${appSlug}`;
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
      if (id.kind === "vibe") {
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
