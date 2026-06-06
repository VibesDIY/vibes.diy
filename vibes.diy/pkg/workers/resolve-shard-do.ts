import { DurableObjectNamespace } from "@cloudflare/workers-types";
import { CFEnv } from "@vibes.diy/api-types";

const SHARD_PREFIX_BINDINGS: Record<string, keyof Pick<CFEnv, "APP_SESSIONS">> = {
  app: "APP_SESSIONS",
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
  return { ns: env.CHAT_SESSIONS, name: shardId };
}
