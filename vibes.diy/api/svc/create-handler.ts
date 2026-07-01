// import { auth } from "./better-auth.js";
import { Result, param, AppContext, TriggerResult, EventoSendProvider, Logger } from "@adviser/cement";
import { ensureLogger, SuperThis } from "@vibes.diy/identity";
// import { VerifiedClaimsResult } from "@vibes.diy/identity";
import { deviceIdCAFromEnv, getCloudPubkeyFromEnv, tokenApi } from "@vibes.diy/identity/server";
import { defaultFetchPkgVersion, ResolveFunction } from "./npm-package-version.js";
import { vibesReqResEvento } from "./vibes-req-res-evento.js";
import { HTTPSendProvider } from "./svc-http-send-provider.js";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { defaultLLMRequest } from "./default-llm-request.js";
import { WSSendProvider } from "./svc-ws-send-provider.js";
import { CfCacheIf, VibesApiSQLCtx } from "./types.js";
import {
  type AccessDescriptor,
  type UserContext,
  type EvtViewerGrantsChanged,
  type EvtRequestGrant,
  type EvtUserNotification,
  LLMEnforced,
  LLMHeaders,
  MsgBase,
  S3Api,
  VibesFPApiParameters,
  type WorkerLoaderBinding,
} from "@vibes.diy/api-types";
import { createSQLPeer, CreateSQLPeerParams, createVibesApiTables, DBFlavour, toDBFlavour, VibesSqlite } from "@vibes.diy/api-sql";
import { ensureStorage } from "@vibes.diy/api-pkg";
import { createS3Peer } from "./peers/s3.js";
import { createAssetGrantSigner } from "./asset-grant.js";
import { createAssetSessionSigner } from "./asset-session.js";

export type BindPromise<T> = (promise: Promise<T>) => Promise<T>;

export interface CreateHandlerParams<T extends VibesSqlite> {
  db: T;
  sthis: SuperThis;
  logger?: Logger;
  cache: CfCacheIf;
  env: Record<string, string>; // | Env;
  // The Cloudflare Worker Loader (`env.LOADER`) binding for vibe SSR's isolate
  // executor (#2802 slice 4, plumbed in #2845). A binding object, not a string,
  // so it rides its own param field rather than the string `env` map; populated
  // from the Cloudflare bindings object at the CF worker bootstrap (cf-serve.ts)
  // and left undefined elsewhere (node serve / tests), where SSR degrades to
  // client-only. Flows into `params.vibes.loader` → `attemptVibeSsr`.
  loader?: WorkerLoaderBinding;
  connections: Set<WSSendProvider>;
  storageSystems: {
    sql: CreateSQLPeerParams;
    s3?: S3Api;
    peerTimeout?: number;
  };
  postQueue: (msg: MsgBase) => Promise<void>;
  netHash(): string;
  fetchAsset(url: string): Promise<Result<ReadableStream<Uint8Array>>>;
  fetchPkgVersion?: ResolveFunction;
  llmRequest?(prompt: LLMRequest & { headers: LLMHeaders }, opts?: { readonly signal?: AbortSignal }): Promise<Response>;
  // Injectable fetch seam for non-LLM inference (Prodia) and call-ai's network.
  // Defaults to the platform `fetch` when omitted (see #2481).
  inferenceFetch?: typeof fetch;
  notifyDocChanged?(
    evt: { ownerHandle: string; appSlug: string; dbName: string; docId: string; channel?: string },
    senderConnId: string
  ): Promise<void>;
  registerDocSubscription?(subscriptionKey: string): Promise<void>;
  deregisterDocSubscription?(subscriptionKey: string): Promise<void>;
  notifyDocEphemeral?(
    evt: {
      ownerHandle: string;
      appSlug: string;
      dbName: string;
      docId: string;
      doc: Record<string, unknown>;
      channel?: string;
    },
    senderConnId: string
  ): Promise<void>;
  notifyDocEphemeralDrop?(originPeer: string): Promise<void>;
  notifyRequestGrantChanged?(evt: EvtRequestGrant, senderConnId: string): Promise<void>;
  registerRequestGrantSubscription?(subscriptionKey: string): Promise<void>;
  deregisterRequestGrantSubscription?(subscriptionKey: string): Promise<void>;
  notifyViewerGrantsChanged?(evt: EvtViewerGrantsChanged, senderConnId: string): Promise<void>;
  registerViewerGrantsSubscription?(subscriptionKey: string): Promise<void>;
  deregisterViewerGrantsSubscription?(subscriptionKey: string): Promise<void>;
  notifyUser?(userId: string, evt: EvtUserNotification, senderConnId: string): Promise<void>;
  registerUserSubscription?(userId: string): Promise<void>;
  deregisterUserSubscription?(userId: string): Promise<void>;
  invokeAccessFn?(params: {
    cid: string;
    doc: unknown;
    oldDoc: unknown | null;
    user: UserContext | null;
    source?: string;
    adminMode?: boolean;
    ownerHandle?: string;
  }): Promise<AccessDescriptor | { forbidden: string }>;
  // Per-DO cache of access.js source bytes keyed by CID. See VibesApiSQLCtx.
  accessFnSourceCache?: Map<string, string>;
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
  const { sthis } = params;

  // console.log("createAppContext called with params:", params.env);
  sthis.env.sets(params.env as unknown as Record<string, string>);
  const rEnvVals = sthis.env.gets({
    CLERK_PUBLISHABLE_KEY: param.REQUIRED,
    DEVICE_ID_CA_PRIV_KEY: param.REQUIRED,
    DEVICE_ID_CA_CERT: param.REQUIRED,

    MAX_APP_SLUG_PER_USER_ID: "10",
    MAX_USER_SLUG_PER_USER_ID: "10",
    MAX_APPS_PER_USER_ID: "50",

    FP_VERSION: param.REQUIRED,

    DB_FLAVOUR: "sqlite",

    LLM_BACKEND_URL: param.REQUIRED,
    LLM_BACKEND_API_KEY: param.REQUIRED,
    LLM_BACKEND_MODEL: "anthropic/claude-sonnet-4.6",

    WORKSPACE_NPM_URL: param.OPTIONAL,
    PUBLIC_NPM_URL: param.OPTIONAL,

    VIBES_DIY_API_URL: param.OPTIONAL,
    DEV_SERVER_HOST: param.OPTIONAL,
    DEV_SERVER_PORT: param.OPTIONAL,
    DEV: param.OPTIONAL,

    VIBES_SVC_HOSTNAME_BASE: param.OPTIONAL,
    VIBES_SVC_PROTOCOL: "https",
    VIBES_SVC_PORT: param.OPTIONAL,

    // Vibe SSR mode (#2802 slice 4): off (default) | node | loader. Unrecognized
    // ⇒ off. render-vibe.ts only honors `loader` on the live route.
    VIBES_SSR: param.OPTIONAL,
    // Cached-suggestion read lane (#2801): "on" in [env.preview] to validate
    // there; off everywhere else.
    VIBES_CACHED_SUGGESTIONS: param.OPTIONAL,
    // Per-app backend.js mode (#2856): "loader" | "off" (default). Gates the B5
    // onChange emit on the write path so writes enqueue nothing while dark.
    BACKEND_JS: param.OPTIONAL,

    RESEND_API_KEY: param.REQUIRED,
    VIBES_DIY_PUBLIC_BASE_URL: param.REQUIRED,

    VIBES_DIY_FROM_EMAIL: "no-reply@vibes.diy",

    PRODIA_TOKEN: param.OPTIONAL,
    META_ACCESS_TOKEN: param.OPTIONAL,
    META_AD_ACCOUNT_ID: param.OPTIONAL,
    META_PIXEL_ID: param.OPTIONAL,

    GTM_CONTAINER_ID: param.OPTIONAL,
    POSTHOG_KEY: param.OPTIONAL,
    POSTHOG_HOST: param.OPTIONAL,

    CLOUD_SESSION_TOKEN_PUBLIC: param.REQUIRED,
    CLOUD_SESSION_TOKEN_SECRET: param.REQUIRED,
    CLOUD_SESSION_TOKEN_ISSUER: param.REQUIRED,
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
      throw new Error("DEV_SERVER_HOST and DEV_SERVER_PORT are required in development");
    }
    if (!envVals.WORKSPACE_NPM_URL) {
      envVals.WORKSPACE_NPM_URL = `https://${envVals.DEV_SERVER_HOST}:${envVals.DEV_SERVER_PORT}/vibe-pkg/`;
    }
    if (!envVals.VIBES_DIY_API_URL) {
      envVals.VIBES_DIY_API_URL = `https://${envVals.DEV_SERVER_HOST}:${envVals.DEV_SERVER_PORT}/api/`;
    }
    if (!envVals.VIBES_SVC_HOSTNAME_BASE) {
      envVals.VIBES_SVC_HOSTNAME_BASE = `localhost.vibesdiy.net`;
    }
    if (!envVals.VIBES_SVC_PROTOCOL) {
      envVals.VIBES_SVC_PROTOCOL = "https";
    }
    if (!envVals.VIBES_SVC_PORT && envVals.DEV_SERVER_PORT) {
      envVals.VIBES_SVC_PORT = envVals.DEV_SERVER_PORT;
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
    pkgRepos: {
      workspace: envVals.WORKSPACE_NPM_URL,
      public: envVals.PUBLIC_NPM_URL,
    },
    vibes: {
      svc: {
        hostnameBase: envVals.VIBES_SVC_HOSTNAME_BASE,
        protocol: envVals.VIBES_SVC_PROTOCOL as "https" | "http",
        port: envVals.VIBES_SVC_PORT,
      },
      // The Worker Loader (env.LOADER) binding for the `loader` SSR executor
      // (#2845). Threaded from the Cloudflare bindings object at the CF worker
      // bootstrap (cf-serve.ts) via `params.loader`; undefined on the node-serve
      // path and in tests that pass no binding, where VIBES_SSR=loader degrades
      // to client-only (select_error). render-vibe.ts reads this slot and passes
      // it to attemptVibeSsr. The binding is open beta and absent until GA, so in
      // practice this stays undefined in prod until the env flips to `loader`.
      loader: params.loader,
      env: {
        CLERK_PUBLISHABLE_KEY: envVals.CLERK_PUBLISHABLE_KEY,
        VIBES_DIY_API_URL: envVals.VIBES_DIY_API_URL,
        VIBES_SSR: envVals.VIBES_SSR,
        VIBES_CACHED_SUGGESTIONS: envVals.VIBES_CACHED_SUGGESTIONS,
        BACKEND_JS: envVals.BACKEND_JS,

        GTM_CONTAINER_ID: envVals.GTM_CONTAINER_ID,
        POSTHOG_KEY: envVals.POSTHOG_KEY,
        POSTHOG_HOST: envVals.POSTHOG_HOST,

        VIBES_DIY_PUBLIC_BASE_URL: envVals.VIBES_DIY_PUBLIC_BASE_URL,

        // CLERK_PUBLISHABLE_KEY: envVals.CLERK_PUBLISHABLE_KEY,
        // CALLAI_API_KEY: "CALLAI_API_KEY",
        // CALLAI_CHAT_URL: "CALLAI_CHAT_URL",
        // CALLAI_IMG_URL: "CALLAI_IMG_URL",
      },
    },
    llm: {
      // default: LLMDefault({
      //   ...(envVals.LLM_BACKEND_MODEL ? { model: envVals.LLM_BACKEND_MODEL } : {}),
      // }) as LLMDefault,
      enforced: LLMEnforced({}) as LLMEnforced,
      headers: LLMHeaders({}) as LLMHeaders,
      url: envVals.LLM_BACKEND_URL,
      apiKey: envVals.LLM_BACKEND_API_KEY,
    },
    assetCacheUrl: "https://asset-cache.vibes.app/{assetId}",
    // importMapProps: {
    //   versions: {
    //     FP: envVals.FP_VERSION,
    //   },
    // },
  };

  const tables = createVibesApiTables(envVals.DB_FLAVOUR as DBFlavour);

  const rAssetGrantSigner = await createAssetGrantSigner({ sthis, secret: envVals.CLOUD_SESSION_TOKEN_SECRET });
  if (rAssetGrantSigner.isErr()) {
    throw rAssetGrantSigner.Err();
  }

  const rAssetSessionSigner = await createAssetSessionSigner({ sthis, secret: envVals.CLOUD_SESSION_TOKEN_SECRET });
  if (rAssetSessionSigner.isErr()) {
    throw rAssetSessionSigner.Err();
  }

  const vibesCtx = {
    sthis,
    logger: params.logger ?? ensureLogger(sthis, "VibesApiSQLCtx"),
    sql: { db: params.db, tables, flavour: toDBFlavour(envVals.DB_FLAVOUR) },
    netHash: params.netHash,
    cache: params.cache,
    connections: params.connections,
    fetchPkgVersion: defaultFetchPkgVersion({
      presetFn: params.fetchPkgVersion,
      defaults: {
        cache: params.cache,
      },
    }),
    postQueue: params.postQueue,
    fetchAsset: params.fetchAsset,
    tokenApi: await tokenApi(sthis, {
      clockTolerance: 60,
      deviceIdCA: rDeviceIdCA.Ok(),
    }),
    storage: params.storageSystems.s3
      ? ensureStorage(
          { peerTimeout: params.storageSystems.peerTimeout },
          createSQLPeer(params.storageSystems.sql),
          createS3Peer({ s3: params.storageSystems.s3 })
        )
      : ensureStorage({ peerTimeout: params.storageSystems.peerTimeout }, createSQLPeer(params.storageSystems.sql)),
    assetGrantSigner: rAssetGrantSigner.Ok(),
    assetSessionSigner: rAssetSessionSigner.Ok(),

    llmRequest: defaultLLMRequest(params.llmRequest, {
      url: envVals.LLM_BACKEND_URL,
      apiKey: envVals.LLM_BACKEND_API_KEY,
    }),
    // Default to the platform `fetch`. Wrapped in an arrow (rather than passing
    // `globalThis.fetch` directly) so the bound receiver is correct across
    // runtimes (undici throws "Illegal invocation" on an unbound fetch).
    inferenceFetch: params.inferenceFetch ?? ((input, init) => fetch(input, init)),
    prodiaToken: envVals.PRODIA_TOKEN,
    metaAccessToken: envVals.META_ACCESS_TOKEN,
    metaAdAccountId: envVals.META_AD_ACCOUNT_ID,
    metaPixelId: envVals.META_PIXEL_ID,
    deviceCA: rDeviceIdCA.Ok(),
    params: svcParams,
    notifyDocChanged: params.notifyDocChanged,
    registerDocSubscription: params.registerDocSubscription,
    deregisterDocSubscription: params.deregisterDocSubscription,
    notifyDocEphemeral: params.notifyDocEphemeral,
    notifyDocEphemeralDrop: params.notifyDocEphemeralDrop,
    notifyRequestGrantChanged: params.notifyRequestGrantChanged,
    registerRequestGrantSubscription: params.registerRequestGrantSubscription,
    deregisterRequestGrantSubscription: params.deregisterRequestGrantSubscription,
    notifyViewerGrantsChanged: params.notifyViewerGrantsChanged,
    registerViewerGrantsSubscription: params.registerViewerGrantsSubscription,
    deregisterViewerGrantsSubscription: params.deregisterViewerGrantsSubscription,
    notifyUser: params.notifyUser,
    registerUserSubscription: params.registerUserSubscription,
    deregisterUserSubscription: params.deregisterUserSubscription,
    invokeAccessFn: params.invokeAccessFn,
    accessFnSourceCache: params.accessFnSourceCache,
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
        type: "vibes.diy.res-error",
        error: { message: `Internal Server Error: ${res.Err().toString()}` },
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
