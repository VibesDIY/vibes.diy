// import { auth } from "./better-auth.js";
import { LoggerImpl, Result, param, AppContext, TriggerResult, EventoSendProvider, Logger } from "@adviser/cement";
import { ensureLogger, ensureSuperThis } from "@fireproof/core-runtime";
import { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { ResultSet } from "@libsql/client";
// import { VerifiedClaimsResult } from "@fireproof/core-types-protocols-dashboard";
import { deviceIdCAFromEnv, getCloudPubkeyFromEnv, tokenApi } from "@fireproof/core-protocols-dashboard";
import { ensureStorage } from "./intern/ensure-storage.js";
import type { D1Result } from "@cloudflare/workers-types";
import { defaultFetchPkgVersion } from "./npm-package-version.js";
import { vibesReqResEvento } from "./vibes-req-res-evento.js";
import { HTTPSendProvider } from "./svc-http-send-provider.js";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { defaultLLMRequest } from "./default-llm-request.js";
import { WSSendProvider } from "./svc-ws-send-provider.js";
import { CfCacheIf, VibesApiSQLCtx } from "./types.js";
import { LLMDefault, LLMEnforced, LLMHeaders, VibesFPApiParameters } from "@vibes.diy/api-types";

export type VibesSqlite = BaseSQLiteDatabase<"async", ResultSet | D1Result, Record<string, never>>;
export type BindPromise<T> = (promise: Promise<T>) => Promise<T>;

export interface CreateHandlerParams<T extends VibesSqlite> {
  db: T;
  logger?: Logger;
  cache: CfCacheIf;
  env: Record<string, string>; // | Env;
  connections: Set<WSSendProvider>;
  netHash(): string;
  fetchPkgVersion?(pkg: string): Promise<string | undefined>;
  llmRequest?(prompt: LLMRequest & { headers: LLMHeaders }): Promise<Response>;
  // waitUntil?<T>(promise: Promise<T>): void;
}

export interface SVCParam {
  readonly bindPromise?: BindPromise<Result<TriggerResult<unknown, unknown, unknown>>>;
  readonly send: EventoSendProvider<Request, unknown, unknown>;
}

// BaseSQLiteDatabase<'async', ResultSet, TSchema>
export async function createAppContext<T extends VibesSqlite>(
  params: CreateHandlerParams<T>
): Promise<{ appCtx: AppContext; vibesCtx: VibesApiSQLCtx }> {
  // const stream = new utils.ConsoleWriterStream();
  const sthis = ensureSuperThis({
    logger: new LoggerImpl(),
  });
  // console.log("createAppContext called with params:", params.env);
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

    WORKSPACE_NPM_URL: param.OPTIONAL,
    PUBLIC_NPM_URL: param.OPTIONAL,
    VIBES_DIY_STYLES_URL: param.OPTIONAL,

    VIBES_DIY_API_URL: param.OPTIONAL,
    DEV_SERVER_HOST: param.OPTIONAL,
    DEV_SERVER_PORT: param.OPTIONAL,
    DEV: param.OPTIONAL,

    FPCLOUD_URL: param.REQUIRED,
    DASHBOARD_URL: param.REQUIRED,

    VIBES_SVC_HOSTNAME_BASE: param.OPTIONAL,
    VIBES_SVC_PROTOCOL: "https",

    GTM_CONTAINER_ID: param.OPTIONAL,
    POSTHOG_KEY: param.OPTIONAL,
    POSTHOG_HOST: param.OPTIONAL,
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

  // const myUrl = globalThis.window ? URI.from(globalThis.window.location.origin) : URI.from("http://no-window");
  // const public_npm_url = this.env().get("PUBLIC_NPM_URL") ?? "https://esm.sh";

  // const workspace_npm_url = this.env().get("PRIVATE_NPM_URL") ??
  //     myUrl.protocol.startsWith("https") ? public_npm_url : myUrl.build().pathname("/dev-npm").toString();

  // const vibesDiyApiUrl = this.env().get("VIBES_DIY_API_URL") ?? myUrl.build().pathname("/api").toString();

  if (!envVals.PUBLIC_NPM_URL) {
    envVals.PUBLIC_NPM_URL = "https://esm.sh";
  }

  if (envVals.DEV) {
    if (!envVals.DEV_SERVER_HOST || !envVals.DEV_SERVER_PORT) {
      throw new Error("DEV_SERVER_HOST and DEV_SERVER_PORT are required in development if VIBES_DIY_STYLES_URL is not set");
    }
    if (!envVals.VIBES_DIY_STYLES_URL) {
      envVals.VIBES_DIY_STYLES_URL = `http://${envVals.DEV_SERVER_HOST}:${envVals.DEV_SERVER_PORT}/`;
    }
    if (!envVals.WORKSPACE_NPM_URL) {
      envVals.WORKSPACE_NPM_URL = `http://${envVals.DEV_SERVER_HOST}:${envVals.DEV_SERVER_PORT}/dev-npm/`;
    }
    if (!envVals.VIBES_DIY_API_URL) {
      envVals.VIBES_DIY_API_URL = `http://${envVals.DEV_SERVER_HOST}:${envVals.DEV_SERVER_PORT}/api/`;
    }
    if (!envVals.VIBES_SVC_HOSTNAME_BASE) {
      envVals.VIBES_SVC_HOSTNAME_BASE = `localhost.vibesdiy.net`;
    }
    if (!envVals.VIBES_SVC_PROTOCOL) {
      envVals.VIBES_SVC_PROTOCOL = "http";
    }
  } else {
    if (!envVals.WORKSPACE_NPM_URL) {
      envVals.WORKSPACE_NPM_URL = envVals.PUBLIC_NPM_URL;
    }
    if (!envVals.VIBES_SVC_HOSTNAME_BASE) {
      throw new Error("VIBES_SVC_HOSTNAME_BASE is required in production");
    }
    if (!envVals.VIBES_SVC_PROTOCOL) {
      envVals.VIBES_SVC_PROTOCOL = "https";
    }
  }

  const svcParams: VibesFPApiParameters = {
    cloudPublicKeys: rCloudPublicKey.Ok().keys,
    clerkPublishableKey: envVals.CLERK_PUBLISHABLE_KEY,
    maxAppSlugPerUserId: parseInt(envVals.MAX_APP_SLUG_PER_USER_ID, 10),
    maxUserSlugPerUserId: parseInt(envVals.MAX_USER_SLUG_PER_USER_ID, 10),
    maxAppsPerUserId: parseInt(envVals.MAX_APPS_PER_USER_ID, 10),
    wrapperBaseUrl: envVals.WRAPPER_BASE_URL,
    pkgRepos: {
      workspace: envVals.WORKSPACE_NPM_URL,
      public: envVals.PUBLIC_NPM_URL,
    },
    vibes: {
      svc: {
        hostnameBase: envVals.VIBES_SVC_HOSTNAME_BASE,
        protocol: envVals.VIBES_SVC_PROTOCOL as "https" | "http",
      },
      env: {
        FPCLOUD_URL: envVals.FPCLOUD_URL,
        DASHBOARD_URL: envVals.DASHBOARD_URL,
        VIBES_DIY_STYLES_URL: envVals.VIBES_DIY_STYLES_URL,
        VIBES_DIY_API_URL: envVals.VIBES_DIY_API_URL,
        DEV_SERVER_HOST: envVals.DEV_SERVER_HOST,
        DEV_SERVER_PORT: envVals.DEV_SERVER_PORT,

        GTM_CONTAINER_ID: envVals.GTM_CONTAINER_ID,
        POSTHOG_KEY: envVals.POSTHOG_KEY,
        POSTHOG_HOST: envVals.POSTHOG_HOST,
        // CLERK_PUBLISHABLE_KEY: envVals.CLERK_PUBLISHABLE_KEY,
        // CALLAI_API_KEY: "CALLAI_API_KEY",
        // CALLAI_CHAT_URL: "CALLAI_CHAT_URL",
        // CALLAI_IMG_URL: "CALLAI_IMG_URL",
      },
    },
    llm: {
      default: LLMDefault({
        ...(envVals.LLM_BACKEND_MODEL ? { model: envVals.LLM_BACKEND_MODEL } : {}),
      }) as LLMDefault,
      enforced: LLMEnforced({}) as LLMEnforced,
      headers: LLMHeaders({}) as LLMHeaders,
    },
    assetCacheUrl: "https://asset-cache.vibes.app/{assetId}",
    // importMapProps: {
    //   versions: {
    //     FP: envVals.FP_VERSION,
    //   },
    // },
  };

  const vibesCtx = {
    sthis,
    logger: params.logger ?? ensureLogger(sthis, "VibesApiSQLCtx"),
    db: params.db,
    netHash: params.netHash,
    cache: params.cache,
    connections: params.connections,
    fetchPkgVersion: defaultFetchPkgVersion({
      fn: params.fetchPkgVersion,
      cache: params.cache,
    }),
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
  } satisfies VibesApiSQLCtx;

  return {
    appCtx: new AppContext().set("vibesApiCtx", vibesCtx),
    vibesCtx,
  };
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
