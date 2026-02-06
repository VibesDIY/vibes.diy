// import { auth } from "./better-auth.js";
import { LoggerImpl, Result, param, AppContext, TriggerResult, EventoSendProvider } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { ResultSet } from "@libsql/client";
// import { VerifiedClaimsResult } from "@fireproof/core-types-protocols-dashboard";
import { deviceIdCAFromEnv, getCloudPubkeyFromEnv, tokenApi } from "@fireproof/core-protocols-dashboard";
import { CfCacheIf, createVibesFPApiSQLCtx, VibesApiSQLCtx, VibesFPApiParameters } from "./api.js";
import { ensureStorage } from "./intern/ensure-storage.js";
import type { D1Result } from "@cloudflare/workers-types";
import { defaultFetchPkgVersion } from "./npm-package-version.js";
import { vibesReqResEvento } from "./vibes-req-res-evento.js";
import { HTTPSendProvider } from "./svc-http-send-provider.js";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { defaultLLMRequest } from "./default-llm-request.js";
import { WSSendProvider } from "./svc-ws-send-provider.js";

// export interface VerifyApiToken {
//   verify(token: string): Promise<Result<VerifiedClaimsResult>>;
// }

export type VibesSqlite = BaseSQLiteDatabase<"async", ResultSet | D1Result, Record<string, never>>;
export type BindPromise<T> = (promise: Promise<T>) => Promise<T>;

export interface CreateHandlerParams<T extends VibesSqlite> {
  db: T;
  cache: CfCacheIf;
  env: Record<string, string>; // | Env;
  connections: Set<WSSendProvider>;
  fetchPkgVersion?(pkg: string): Promise<string | undefined>;
  llmRequest?(prompt: LLMRequest): Promise<Response>;
  // waitUntil?<T>(promise: Promise<T>): void;
}

export interface SVCParam {
  readonly bindPromise?: BindPromise<Result<TriggerResult<unknown, unknown, unknown>>>;
  readonly send: EventoSendProvider<Request, unknown, unknown>;
}

// BaseSQLiteDatabase<'async', ResultSet, TSchema>
export async function createAppContext<T extends VibesSqlite>(params: CreateHandlerParams<T>) {
  // const stream = new utils.ConsoleWriterStream();
  const sthis = ensureSuperThis({
    logger: new LoggerImpl(),
  });
  sthis.env.sets(params.env as unknown as Record<string, string>);
  const rEnvVals = sthis.env.gets({
    CLOUD_SESSION_TOKEN_PUBLIC: param.REQUIRED,
    CLERK_PUBLISHABLE_KEY: param.REQUIRED,
    DEVICE_ID_CA_PRIV_KEY: param.REQUIRED,
    DEVICE_ID_CA_CERT: param.REQUIRED,
    WRAPPER_BASE_URL: param.REQUIRED,
    // ENTRY_POINT_TEMPLATE_URL: param.REQUIRED,

    MAX_APP_SLUG_PER_USER_ID: "10",
    MAX_USER_SLUG_PER_USER_ID: "10",
    MAX_APPS_PER_USER_ID: "50",

    FP_VERSION: param.REQUIRED,

    LLM_BACKEND_URL: param.REQUIRED,
    LLM_BACKEND_API_KEY: param.REQUIRED,
    LLM_BACKEND_MODEL: "anthropic/claude-sonnet-4",

    // URL for fetching prompt catalog documentation (used for server-side prompt building)
    PROMPT_FALLBACK_URL: "https://esm.sh/use-vibes@latest/prompt-catalog/llms",

    VIBES_SVC_HOSTNAME_BASE: param.REQUIRED,
    VIBES_SVC_PROTOCOL: "https",
  });
  if (rEnvVals.isErr()) {
    throw rEnvVals.Err();
  }
  const envVals = rEnvVals.Ok();

  const rCloudPublicKey = await getCloudPubkeyFromEnv(envVals.CLOUD_SESSION_TOKEN_PUBLIC, sthis);
  if (rCloudPublicKey.isErr()) {
    throw rCloudPublicKey.Err();
  }

  // Create DeviceIdCA from environment variables
  const rDeviceIdCA = await deviceIdCAFromEnv(sthis);
  if (rDeviceIdCA.isErr()) {
    throw rDeviceIdCA.Err();
  }

  const svcParams: VibesFPApiParameters = {
    cloudPublicKeys: rCloudPublicKey.Ok().keys,
    clerkPublishableKey: envVals.CLERK_PUBLISHABLE_KEY,
    maxAppSlugPerUserId: parseInt(envVals.MAX_APP_SLUG_PER_USER_ID, 10),
    maxUserSlugPerUserId: parseInt(envVals.MAX_USER_SLUG_PER_USER_ID, 10),
    maxAppsPerUserId: parseInt(envVals.MAX_APPS_PER_USER_ID, 10),
    wrapperBaseUrl: envVals.WRAPPER_BASE_URL,
    vibes: {
      svc: {
        hostnameBase: envVals.VIBES_SVC_HOSTNAME_BASE,
        protocol: envVals.VIBES_SVC_PROTOCOL as "https" | "http",
      },
      env: {
        FPCLOUD_URL: "FPCLOUD_URL",
        DASHBOARD_URL: "DASHBOARD_URL",
        CLERK_PUBLISHABLE_KEY: envVals.CLERK_PUBLISHABLE_KEY,
        CALLAI_API_KEY: "CALLAI_API_KEY",
        CALLAI_CHAT_URL: "CALLAI_CHAT_URL",
        CALLAI_IMG_URL: "CALLAI_IMG_URL",
      },
    },
    assetCacheUrl: "https://asset-cache.vibes.app/{assetId}",
    importMapProps: {
      versions: {
        FP: envVals.FP_VERSION,
      },
    },
    llm: {
      default: {
        model: envVals.LLM_BACKEND_MODEL,
      },
      enforced: {
        debug: false,
        transforms: ["middle-out"],
      },
      headers: {
        "HTTP-Referer": "https://vibes.diy",
        "X-Title": "Vibes DIY",
      },
    },
    promptFallbackUrl: envVals.PROMPT_FALLBACK_URL,
  };

  return new AppContext().set(
    "vibesApiCtx",
    createVibesFPApiSQLCtx({
      sthis,
      db: params.db,
      cache: params.cache,
      connections: params.connections,
      fetchPkgVersion: defaultFetchPkgVersion(params.fetchPkgVersion),
      tokenApi: await tokenApi(sthis, {
        clockTolerance: 60,
        deviceIdCA: rDeviceIdCA.Ok(),
      }),
      ensureStorage: ensureStorage(params.db),
      llmRequest: defaultLLMRequest(params.llmRequest, {
        url: envVals.LLM_BACKEND_URL,
        apiKey: envVals.LLM_BACKEND_API_KEY,
      }),
      deviceCA: rDeviceIdCA.Ok(),
      params: svcParams,
    })
  );
}

export async function processRequest(ctx: AppContext, req: Request): Promise<Response> {
  const webEvento = vibesReqResEvento();
  const httpSend = new HTTPSendProvider();
  const res = await webEvento.trigger({
    ctx, //: vibesApiCtx,
    send: httpSend,
    request: req,
  });
  if (res.isErr()) {
    ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx").logger.Error().Err(res).Msg("processRequest-Error");
    return new Response(
      JSON.stringify({
        type: "vibes.diy.error",
        message: `Internal Server Error: ${res.Err().toString()}`,
      }),
      { status: 500 }
    );
  }
  return httpSend.getResponse();
}

// return async (
//   req: Request | W3CWebSocketEvent,
//   iopts: SVCParam
// ): Promise<Result<TriggerResult<unknown, unknown, unknown>, Error>> => {
//   const { bindPromise, send } = {
//     ...iopts,
//     bindPromise: iopts.bindPromise ?? (<T>(p: T) => p),
//   };
//   console.log("createHandler.req", req, bindPromise.toString());
//   const triggerCtx = {
//     ctx: vibesApiCtx,
//     send,
//     request: req,
//   };
//   const rTrigger = await bindPromise(evento.trigger(triggerCtx));
//   if (rTrigger.isErr()) {
//     vibesApiCtx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx").logger.Error().Err(rTrigger).Msg("createhandler-Error");
//   }
//   return rTrigger;
// };
