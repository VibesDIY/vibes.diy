import {
  DurableObject,
  DurableObjectState,
  ExecutionContext,
  Request as CFRequest,
  Response as CFResponse,
} from "@cloudflare/workers-types";
import { CFEnv } from "@vibes.diy/api-types";
import { CfCacheIf } from "@vibes.diy/api-svc";
import { CFInjectMutable, cfServeAppCtx } from "@vibes.diy/api-svc/cf-serve.js";
import { type VibesApiSQLCtx } from "@vibes.diy/api-svc/types.js";
import { attemptBackendFetch } from "@vibes.diy/api-svc/intern/attempt-backend-fetch.js";

declare const Response: typeof CFResponse;

// app.ts stamps the resolved vibe target on the forwarded request, so the DO never
// re-parses the (host-or-path-dependent) URL. These are internal headers.
export const BACKEND_OWNER_HEADER = "x-vibe-owner";
export const BACKEND_SLUG_HEADER = "x-vibe-slug";

/**
 * Per-vibe backend Durable Object (#2856, slice B3). The durable compute unit a
 * vibe's `backend.js` runs in. In B3 it's a thin shell over the stateless
 * `attemptBackendFetch` serve core; B4 adds `alarm()` (`scheduled`) and B5
 * `invokeOnChange()` to this same class, with no routing rework.
 *
 * Addressed per `(ownerHandle, appSlug)` via `backendDoName` (collision-safe), so
 * one instance owns one vibe — the boundary that pairs with the per-vibe isolate
 * id inside the executor.
 *
 * Builds its `VibesApiSQLCtx` from `env` the same way the session DOs do
 * (`cfServeAppCtx`), so it can resolve the selected release + read source from
 * storage. No WebSocket / broadcast / access-fn overrides — B3 only reads.
 */
export class BackendDO implements DurableObject {
  private readonly env: CFEnv;

  constructor(_state: DurableObjectState, env: CFEnv) {
    this.env = env;
  }

  async fetch(request: CFRequest): Promise<CFResponse> {
    const ownerHandle = request.headers.get(BACKEND_OWNER_HEADER);
    const appSlug = request.headers.get(BACKEND_SLUG_HEADER);
    if (!ownerHandle || !appSlug) {
      // Only app.ts addresses this DO, and always with both target headers; a
      // missing one is an internal routing bug, not a user-facing condition.
      return new Response("backend: missing vibe target", { status: 400 });
    }

    const cctx = {} as unknown as ExecutionContext & CFInjectMutable;
    (cctx as CFInjectMutable).cache = (caches as unknown as { default: unknown }).default as unknown as CfCacheIf;
    const appCtx = (await cfServeAppCtx(request, this.env, cctx)).appCtx;
    const vctx = appCtx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

    const userHandle = await resolveBackendUserHandle();

    const outcome = await attemptBackendFetch(vctx, {
      ownerHandle,
      appSlug,
      request: request as unknown as Request,
      userHandle,
      backendJs: this.env.BACKEND_JS,
      loader: this.env.LOADER,
      policyVersion: this.env.BACKEND_POLICY_VERSION,
    });

    if (outcome.reason === "ok") {
      return outcome.response as unknown as CFResponse;
    }
    // Every fallback reason → 404 (attemptVibeSsr discipline): a broken / absent /
    // dark backend is "not found", never a 500.
    return new Response("backend.js _api: not found", { status: 404, headers: { "content-type": "text/plain" } });
  }
}

/**
 * Resolve the acting identity for a backend trigger (#2856 B3 → consumed by B6).
 *
 * Webhooks are unauthenticated by definition, so `null` is the first-class,
 * supported case (per Charlie). Authenticated `_api` calls get explicit token
 * extraction/verification when its real consumer lands: B6 hangs write-identity
 * off `ctx.userInfo`, and nothing reads it before then (the path is dark behind
 * `BACKEND_JS` regardless). Kept as a one-function seam so B6 is a focused change
 * rather than a cross-cutting one.
 */
async function resolveBackendUserHandle(): Promise<string | null> {
  return null;
}
