import { DurableObjectNamespace } from "@cloudflare/workers-types";
import { CFEnv } from "@vibes.diy/api-types";

// #2714 Spec B — the session planes collapsed into one class "Sessions",
// addressed via two handles: SESSIONS (vibe + shared) and CODEGEN_SESSIONS
// (codegen). UserNotify fan-out resolves a registered shardId back to the DO
// that registered it, so the prefix→binding map mirrors app.ts's routing:
// `app:`/`shared:` registrations live on SESSIONS, bare ids on CODEGEN_SESSIONS.
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
      return { ns: env[binding], name: shardId.slice(colonIdx + 1) };
    }
  }
  return { ns: env.CODEGEN_SESSIONS, name: shardId };
}
