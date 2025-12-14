import type { DurableDatabase } from "../../pkg/src/durable-database.js";

declare module "cloudflare:test" {
  // ProvidedEnv controls what env and SELF expose
  interface ProvidedEnv extends Env {
    KV: KVNamespace;
    BURST_LIMITER: RateLimiter;
    DURABLE_DATABASE: DurableObjectNamespace<DurableDatabase>;
  }
}
