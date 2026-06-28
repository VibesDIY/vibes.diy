import { DurableObjectNamespace } from "@cloudflare/workers-types";
import { CFEnv } from "@vibes.diy/api-types";

// #2714 Spec B — the session planes collapsed into one class "Sessions",
// addressed via two handles: SESSIONS (vibe + shared) and CODEGEN_SESSIONS
// (codegen). On non-cli envs both bind the same class → the same DO namespace,
// so the PHYSICAL DO name must be plane-prefixed (`app:`/`shared:`/`chat:`) or a
// codegen shard could collide with a vibe key / the shared singleton and
// co-tenant one instance across planes. app.ts opens those exact prefixed names;
// this resolver (used by UserNotify fan-out) must address the SAME physical
// instance for a registered shardId, so it maps the registration prefix to its
// physical name 1:1: `app:`/`shared:` registrations keep their full name on
// SESSIONS; a bare codegen registration becomes `chat:<id>` on CODEGEN_SESSIONS.
const SHARD_PREFIX_BINDINGS: Record<string, keyof Pick<CFEnv, "SESSIONS">> = {
  app: "SESSIONS",
  shared: "SESSIONS",
};

export function resolveShardDO(shardId: string, env: CFEnv): { ns: DurableObjectNamespace; name: string } {
  const colonIdx = shardId.indexOf(":");
  if (colonIdx >= 0) {
    const prefix = shardId.slice(0, colonIdx);
    const binding = SHARD_PREFIX_BINDINGS[prefix];
    if (binding !== undefined) {
      // Keep the full prefixed id as the physical name (matches app.ts's
      // `app:<vibe>` / `shared:<shard>`).
      return { ns: env[binding], name: shardId };
    }
  }
  // Bare id = a codegen registration; app.ts opens it as `chat:<shard>`.
  return { ns: env.CODEGEN_SESSIONS, name: `chat:${shardId}` };
}
