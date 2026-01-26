// import { auth } from "./better-auth.js";
import {
  Lazy,
  LoggerImpl,
  Result,
  param,
  Option,
  Evento,
  EventoType,
  AppContext,
  ValidateTriggerCtx,
  HandleTriggerCtx,
  EventoResultType,
  EventoResult,
  TriggerResult,
  EventoSendProvider,
} from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { ResultSet } from "@libsql/client";
import { ensureAppSlugItem } from "./public/ensure-app-slug-item.js";
import { ensureChatContext } from "./public/ensure-chat-context.js";
import { appendChatSection } from "./public/append-chat-section.js";
import { claimUserSlug } from "./public/claim-user-slug.js";
import { listUserSlugs } from "./public/list-user-slugs.js";
import { VerifiedClaimsResult } from "@fireproof/core-types-protocols-dashboard";
import { deviceIdCAFromEnv, getCloudPubkeyFromEnv, tokenApi } from "@fireproof/core-protocols-dashboard";
import { CfCacheIf, createVibesFPApiSQLCtx, VibesApiSQLCtx, VibesFPApiParameters } from "./api.js";
import { ensureStorage } from "./intern/ensure-storage.js";
import { HttpResponseJsonType, W3CWebSocketEvent } from "@vibes.diy/api-types";
import { servEntryPoint } from "./public/serv-entry-point.js";
import { D1Result } from "@cloudflare/workers-types";
import { CombinedEventoEnDecoder, ReqResEventoEnDecoder, W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";

export interface VerifyApiToken {
  verify(token: string): Promise<Result<VerifiedClaimsResult>>;
}

export type VibesSqlite = BaseSQLiteDatabase<"async", ResultSet | D1Result, Record<string, never>>;

export type BindPromise<T> = (promise: Promise<T>) => Promise<T>;

export const vibesApiEvento = Lazy(() => {
  const evento = new Evento(new CombinedEventoEnDecoder(new ReqResEventoEnDecoder(), new W3CWebSocketEventEventoEnDecoder()));
  evento.push(
    {
      hash: "cors-preflight",
      validate: (ctx: ValidateTriggerCtx<Request, unknown, unknown>) => {
        const { request: req } = ctx;
        if (req && req.method === "OPTIONS") {
          return Promise.resolve(Result.Ok(Option.Some("Send CORS preflight response")));
        }
        return Promise.resolve(Result.Ok(Option.None()));
      },
      handle: async (ctx: HandleTriggerCtx<Request, string, unknown>): Promise<Result<EventoResultType>> => {
        await ctx.send.send(ctx, {
          type: "http.Response.JSON",
          status: 200,
          json: { type: "ok", message: "CORS preflight" },
        } satisfies HttpResponseJsonType);
        return Result.Ok(EventoResult.Stop);
      },
    },
    servEntryPoint,
    // {
    //   hash: "log-request ",
    //   validate: async (_ctx: ValidateTriggerCtx<Request, unknown, unknown>): Promise<Result<Option<unknown>>> => {
    //     return Promise.resolve(Result.Ok(Option.Some("Log request")));
    //   },
    //   handle: async (ctx: HandleTriggerCtx<Request, unknown, unknown>): Promise<Result<EventoResultType>> => {
    //     const { request: req } = ctx;
    //     if (!["POST", "PUT"].includes(req.method)) {
    //       await ctx.send.send(ctx, {
    //         type: "http.Response.JSON",
    //           status: 503,
    //           json: {
    //             type: "error",
    //             message: "Only POST and PUT methods are supported",
    //             req: ctx.enRequest,
    //           },
    //       } satisfies HttpResponseJsonType);
    //       return Result.Ok(EventoResult.Stop);
    //     }
    //     ctx.ctx
    //       .getOrThrow<VibesApiSQLCtx>("vibesApiCtx")
    //       .sthis.logger.Debug()
    //       .TimerStart(`api-request-${ctx.id}`)
    //       .Any({
    //         method: req.method,
    //         url: req.url,
    //         headers: HttpHeader.from(req.headers).AsRecordStringString(),
    //         body: ctx.enRequest,
    //       })
    //       .Msg("API Request started");
    //     return Result.Ok(EventoResult.Continue);
    //   },
    //   post: async (ctx: HandleTriggerCtx<Request, unknown, unknown>): Promise<void> => {
    //     // ctx.send.tranfer(ctx);
    //     ctx.ctx
    //       .getOrThrow<VibesApiSQLCtx>("vibesApiCtx")
    //       .sthis.logger.Debug()
    //       .TimerEnd(`api-request-${ctx.id}`)
    //       .Any({ stats: ctx.stats })
    //       .Msg("API Request ended");
    //   },
    // },
    ensureAppSlugItem,
    ensureChatContext,
    appendChatSection,
    claimUserSlug,
    listUserSlugs,
    {
      type: EventoType.WildCard,
      hash: "not-implemented-handler",
      handle: async (ctx) => {
        await ctx.send.send(ctx, {
          type: "http.Response.JSON",
          status: 501,
          json: {
            type: "error",
            message: "Not Implemented",
            req: ctx.enRequest,
          },
        } satisfies HttpResponseJsonType);
        return Result.Ok(EventoResult.Continue);
      },
    },
    {
      type: EventoType.Error,
      hash: "error-handler",
      handle: async (ctx) => {
        await ctx.send.send(ctx, {
          type: "http.Response.JSON",
          status: 500,
          json: {
            type: "error",
            message: "Internal Server Error",
            error: ctx.error?.toString(),
          },
        } satisfies HttpResponseJsonType);
        return Result.Ok(EventoResult.Continue);
      },
    }
  );
  return evento;
});

function defaultFetchPkgVersion(
  fn?: (pkg: string) => Promise<string | undefined>,
  url = "https://registry.npmjs.org"
): (pkg: string) => Promise<string | undefined> {
  if (fn) {
    return fn;
  }
  return (pkg: string) =>
    fetch(`${url}/${pkg}/latest`)
      .then((res) => {
        if (!res.ok) {
          return undefined;
        }
        return res.json().then((data) => data.version);
      })
      .catch(() => undefined);
}

export interface CreateHandlerParams<T extends VibesSqlite> {
  db: T;
  cache: CfCacheIf;
  env: Record<string, string>; // | Env;
  fetchPkgVersion?(pkg: string): Promise<string | undefined>;
  waitUntil?<T>(promise: Promise<T>): void;
}

export interface SVCParam {
  readonly bindPromise?: BindPromise<Result<TriggerResult<unknown, unknown, unknown>>>;
  readonly send: EventoSendProvider<Request, unknown, unknown>;
}

// BaseSQLiteDatabase<'async', ResultSet, TSchema>
export async function createHandler<T extends VibesSqlite>(params: CreateHandlerParams<T>) {
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

    // VIBES_SVC_HOSTNAME_BASE: "localhost.vibes.app",
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
  };

  const vibesApiCtx = new AppContext().set(
    "vibesApiCtx",
    createVibesFPApiSQLCtx({
      sthis,
      db: params.db,
      cache: params.cache,
      fetchPkgVersion: defaultFetchPkgVersion(params.fetchPkgVersion),
      waitUntil: params.waitUntil ?? ((p) => p),

      tokenApi: await tokenApi(sthis, {
        clockTolerance: 60,
        deviceIdCA: rDeviceIdCA.Ok(),
      }),
      ensureStorage: ensureStorage(params.db),
      deviceCA: rDeviceIdCA.Ok(),
      params: svcParams,
    })
  );
  const evento = vibesApiEvento();
  return async (
    req: Request | W3CWebSocketEvent,
    iopts: SVCParam
  ): Promise<Result<TriggerResult<unknown, unknown, unknown>, Error>> => {
    const { bindPromise, send } = {
      ...iopts,
      bindPromise: iopts.bindPromise ?? (<T>(p: T) => p),
    };
    console.log("createHandler.req", req, bindPromise.toString());
    const triggerCtx = {
      ctx: vibesApiCtx,
      send,
      request: req,
    };
    const rTrigger = await bindPromise(evento.trigger(triggerCtx));
    if (rTrigger.isErr()) {
      vibesApiCtx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx").logger.Error().Err(rTrigger).Msg("createhandler-Error");
    }
    return rTrigger;
  };
}
