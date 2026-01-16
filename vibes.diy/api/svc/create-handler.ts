// import { auth } from "./better-auth.js";
import {
  CoercedHeadersInit,
  HttpHeader,
  Lazy,
  LoggerImpl,
  Result,
  param,
  Option,
  Evento,
  EventoEnDecoder,
  EventoType,
  AppContext,
  ValidateTriggerCtx,
  HandleTriggerCtx,
  EventoResultType,
  EventoResult,
  EventoSendProvider,
} from "@adviser/cement";
// import type { Env } from "./cf-serve.js";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { ResultSet } from "@libsql/client";
// import { getCloudPubkeyFromEnv } from "./get-cloud-pubkey-from-env.js";
// import { ClerkVerifiedAuth, FPApiSQLCtx, FPApiToken, VerifiedClaimsResult } from "./types.js";
// import { VerifyWithCertificateOptions } from "@fireproof/core-types-device-id";
// import { FPApiParameters } from "@fireproof/core-types-protocols-dashboard";
import { ensureAppSlugItem } from "./public/ensure-app-slug-item.js";
import { VerifiedClaimsResult } from "@fireproof/core-types-protocols-dashboard";
import { deviceIdCAFromEnv, getCloudPubkeyFromEnv, tokenApi } from "@fireproof/core-protocols-dashboard";
import { CfCacheIf, createVibesFPApiSQLCtx, VibesApiSQLCtx, VibesFPApiParameters } from "./api.js";
import { msgBase, MsgBase } from "vibes-diy-api-pkg";
import { type } from "arktype";
import { ensureStorage } from "./intern/ensure-storage.js";
import { isResponseType, ResponseType } from "@vibes.diy/api-types";
import { servEntryPoint } from "./public/serv-entry-point.js";
import { D1Result } from "@cloudflare/workers-types";

const defaultHttpHeaders = Lazy(() =>
  HttpHeader.from({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PUT,DELETE",
    "Access-Control-Allow-Headers": "Origin, Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
  })
);

export function DefaultHttpHeaders(...h: CoercedHeadersInit[]): HeadersInit {
  return defaultHttpHeaders()
    .Merge(...h)
    .AsHeaderInit();
}

export interface VerifyApiToken {
  verify(token: string): Promise<Result<VerifiedClaimsResult>>;
}

export type VibesSqlite = BaseSQLiteDatabase<"async", ResultSet | D1Result, Record<string, never>>;

export type BindPromise<T> = (promise: Promise<T>) => Promise<T>;

class ReqResEventoEnDecoder implements EventoEnDecoder<Request, string> {
  async encode(args: Request): Promise<Result<unknown>> {
    if (args.method === "POST" || args.method === "PUT") {
      const body = (await args.json()) as unknown;
      return Result.Ok(body);
    }
    return Result.Ok(null);
  }
  decode(data: unknown): Promise<Result<string>> {
    return Promise.resolve(Result.Ok(JSON.stringify(data)));
  }
}

export const vibesApiEvento = Lazy(() => {
  const evento = new Evento(new ReqResEventoEnDecoder());
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
          type: "Response",
          payload: {
            status: 200,
            headers: DefaultHttpHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ type: "ok", message: "CORS preflight" }),
          },
        } satisfies ResponseType);
        return Result.Ok(EventoResult.Stop);
      },
    },
    servEntryPoint,
    {
      hash: "log-request ",
      validate: async (_ctx: ValidateTriggerCtx<Request, unknown, unknown>): Promise<Result<Option<unknown>>> => {
        return Promise.resolve(Result.Ok(Option.Some("Log request")));
      },
      handle: async (ctx: HandleTriggerCtx<Request, unknown, unknown>): Promise<Result<EventoResultType>> => {
        const { request: req } = ctx;
        if (!["POST", "PUT"].includes(req.method)) {
          await ctx.send.send(ctx, {
            type: "Response",
            payload: {
              status: 503,
              headers: DefaultHttpHeaders({
                "Content-Type": "application/json",
              }),
              body: JSON.stringify({
                type: "error",
                message: "Only POST and PUT methods are supported",
                req: ctx.enRequest,
              }),
            },
          } satisfies ResponseType);
          return Result.Ok(EventoResult.Stop);
        }
        ctx.ctx
          .getOrThrow<VibesApiSQLCtx>("vibesApiCtx")
          .sthis.logger.Debug()
          .TimerStart(`api-request-${ctx.id}`)
          .Any({
            method: req.method,
            url: req.url,
            headers: HttpHeader.from(req.headers).AsRecordStringString(),
            body: ctx.enRequest,
          })
          .Msg("API Request started");
        return Result.Ok(EventoResult.Continue);
      },
      post: async (ctx: HandleTriggerCtx<Request, unknown, unknown>): Promise<void> => {
        // ctx.send.tranfer(ctx);
        ctx.ctx
          .getOrThrow<VibesApiSQLCtx>("vibesApiCtx")
          .sthis.logger.Debug()
          .TimerEnd(`api-request-${ctx.id}`)
          .Any({ stats: ctx.stats })
          .Msg("API Request ended");
      },
    },
    ensureAppSlugItem,
    {
      type: EventoType.WildCard,
      hash: "not-found-handler",
      handle: async (ctx) => {
        await ctx.send.send(ctx, {
          type: "Response",
          payload: {
            status: 501,
            headers: DefaultHttpHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({
              type: "error",
              message: "Not Found",
              req: ctx.enRequest,
            }),
          },
        } satisfies ResponseType);
        return Result.Ok(EventoResult.Continue);
      },
    },
    {
      type: EventoType.Error,
      hash: "error-handler",
      handle: async (ctx) => {
        await ctx.send.send(ctx, {
          type: "Response",
          payload: {
            status: 500,
            headers: DefaultHttpHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({
              type: "error",
              message: "Internal Server Error",
              error: ctx.error?.toString(),
            }),
          },
        } satisfies ResponseType);
        return Result.Ok(EventoResult.Continue);
      },
    }
  );
  return evento;
});

class SendResponseProvider implements EventoSendProvider<Request, unknown, unknown> {
  response?: Response;
  getResponse(): Response {
    if (!this.response) {
      this.response = new Response(JSON.stringify({ type: "error", message: "Response not set" }), {
        status: 500,
        headers: DefaultHttpHeaders({ "Content-Type": "application/json" }),
      });
    }
    const res = this.response;
    this.response = undefined;
    return res;
  }
  async send<T>(ctx: HandleTriggerCtx<Request, unknown, unknown>, res: unknown): Promise<Result<T>> {
    // noop, handled in createHandler
    if (this.response) {
      return Result.Err("response could only be set once");
    }
    if (isResponseType(res)) {
      this.response = new Response(res.payload.body, {
        status: res.payload.status,
        headers: res.payload.headers,
      });
      return Result.Ok();
    }
    const msg = msgBase(ctx.enRequest);
    if (msg instanceof type.errors) {
      this.response = new Response(JSON.stringify({ type: "error", message: "Invalid message base" }), {
        status: 400,
        headers: DefaultHttpHeaders({ "Content-Type": "application/json" }),
      });
      return Result.Err("invalid message base");
    }
    // need to set src / transactionId ... the optionals to real
    const defaultRes: MsgBase = {
      tid: msg.tid,
      src: msg.dst,
      dst: msg.src,
      ttl: 10,
      payload: res,
    };
    return ctx.encoder.decode(defaultRes).then((rStr) => {
      if (rStr.isErr()) {
        const x = {
          type: "error",
          message: "Failed to decode response",
          error: rStr.Err(),
        };
        this.response = new Response(JSON.stringify(x), {
          status: 500,
          headers: DefaultHttpHeaders({ "Content-Type": "application/json" }),
        });
        return Result.Err(rStr.Err());
      }
      this.response = new Response(rStr.Ok() as string, {
        status: 200,
        headers: DefaultHttpHeaders({
          "Content-Type": "application/json",
          "Server-Timing": `total;dur=${(ctx.stats.request.doneTime.getTime() - ctx.stats.request.startTime.getTime()).toFixed(2)}`,
        }),
      });
      return Result.Ok(defaultRes as T);
    });
  }
}

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
  const send = new SendResponseProvider();
  return async (req: Request, bindPromise: BindPromise<Result<unknown>> = (p) => p): Promise<Response> => {
    const rTrigger = await bindPromise(
      evento.trigger({
        ctx: vibesApiCtx,
        send,
        request: req,
      })
    );
    if (rTrigger.isErr()) {
      vibesApiCtx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx").logger.Error().Err(rTrigger).Msg("createhandler-Error");
      return new Response(
        JSON.stringify({
          type: "error",
          message: rTrigger.Err().message,
        }),
        {
          status: 500,
          headers: DefaultHttpHeaders({
            "Content-Type": "application/json",
          }),
        }
      );
    }
    return send.getResponse();
  };
}
