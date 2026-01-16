import { drizzle } from "drizzle-orm/d1";
import { D1Database, Fetcher, Request as CFRequest, Response as CFResponse, ExecutionContext } from "@cloudflare/workers-types";
import { createHandler } from "./create-handler.js";
import { CfCacheIf } from "./api.js";
// import { resWellKnownJwks } from "./well-known-jwks.js";

export interface Env {
  DB: D1Database;
  // CLERK_SECRET_KEY: string;
  ASSETS: Fetcher;

  MAX_TENANTS?: number;
  MAX_ADMIN_USERS?: number;
  MAX_MEMBER_USERS?: number;
  MAX_INVITES?: number;
  MAX_LEDGERS?: number;
  MAX_APPID_BINDINGS?: number;

  CLERK_PUBLISHABLE_KEY: string;
  CLOUD_SESSION_TOKEN_PUBLIC: string;
}

// export default {
export async function cfServe(
  request: CFRequest,
  ienv: unknown,
  ctx: ExecutionContext & { cache: CfCacheIf }
): Promise<CFResponse> {
  const env = ienv as Env;
  return createHandler({
    db: drizzle(env.DB),
    cache: ctx.cache,
    env: env as unknown as Record<string, string>,
    waitUntil: (p) => ctx.waitUntil(p),
  }).then(
    (fn) =>
      fn(request as unknown as Request, (p) => {
        ctx.waitUntil(p);
        return p;
      }) as unknown as Promise<CFResponse>
  );
}
// };
