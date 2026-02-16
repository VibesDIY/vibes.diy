import { AppContext } from "@adviser/cement";
import { CFInjectMutable, cfServeAppCtx } from "@vibes.diy/api-svc/cf-serve.js";
import type { VibesApiSQLCtx } from "@vibes.diy/api-svc/types.js";
import type { ExecutionContext, Request as CFRequest, Response as CFResponse } from "@cloudflare/workers-types";
import { Env } from "./env.js";

declare const Response: typeof CFResponse;

interface WorkerBoundaryContext {
  appCtx: AppContext;
  vibesCtx: VibesApiSQLCtx;
}

export function workerInternalErrorResponse(error: Error): CFResponse {
  return new Response(
    JSON.stringify({
      type: "vibes.diy.error",
      message: `Internal Server Error: ${error.message}`,
    }),
    {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }
  );
}

function isCfResponse(response: Response | CFResponse): response is CFResponse {
  return "getAll" in response.headers;
}

// Prefer pass-through for worker-native responses; only fallback-convert for non-worker responses.
export async function cloneWebResponseAsCfResponse(webResponse: Response | CFResponse): Promise<CFResponse> {
  if (isCfResponse(webResponse)) {
    return webResponse;
  }
  const body = webResponse.body === null ? null : await webResponse.arrayBuffer();
  return new Response(body, {
    status: webResponse.status,
    statusText: webResponse.statusText,
    headers: [...webResponse.headers],
  });
}

export async function withWorkerBoundaryContext<T extends CFResponse>({
  request,
  env,
  cctx,
  onContext,
  onError,
}: {
  request: CFRequest;
  env: Env;
  cctx: ExecutionContext & CFInjectMutable;
  onContext(ctx: WorkerBoundaryContext): Promise<T>;
  onError(error: Error): T | Promise<T>;
}): Promise<T> {
  const rCfCtx = await cfServeAppCtx(request, env, cctx);
  if (rCfCtx.isErr()) {
    return onError(rCfCtx.Err());
  }
  const cfCtx = rCfCtx.Ok();
  cctx.appCtx = cfCtx.appCtx;
  return onContext(cfCtx);
}
