import {
  MsgBase,
  OptionalAuth,
  ResEnsureAppSlug,
  ResultVibesDiy,
  VibesDiyError,
  MsgBox,
  W3CWebSocketEvent,
  msgBase,
  isResError,
  mkResError,
} from "@vibes.diy/api-types";
import {
  Evento,
  EventoSendProvider,
  Future,
  JSONEnDecoderSingleton,
  Result,
  Option,
  TriggerCtx,
  HandleTriggerCtx,
  EventoResult,
  ValidateTriggerCtx,
} from "@adviser/cement";
import { W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { type } from "arktype";
import { DashAuthType } from "@fireproof/core-types-protocols-dashboard";
import { VibeDiyApiConnection } from "./api-connection.js";
import { VibesDiyApiConfig, WithAuth } from "./vibes-diy-api-types.js";

interface VibesDiyApiTransportContext {
  readonly cfg: Pick<VibesDiyApiConfig, "apiUrl" | "me" | "getToken" | "timeoutMs" | "sthis">;
  getReadyConnection(): Promise<VibeDiyApiConnection>;
}

interface VibesDiyApiRequestContext extends VibesDiyApiTransportContext {
  send<T extends { auth?: DashAuthType }>(
    req: T,
    msgParam: Partial<Omit<MsgBase, "tid">> & { tid: string }
  ): Promise<Result<MsgBox<WithAuth<T>>, VibesDiyError>>;
}

export async function sendApiMessage<T extends { auth?: DashAuthType }>(
  ctx: VibesDiyApiTransportContext,
  req: T,
  msgParam: Partial<Omit<MsgBase, "tid">> & { tid: string }
): Promise<Result<MsgBox<WithAuth<T>>, VibesDiyError>> {
  // getToken() can block on the browser's Clerk SDK loading; getReadyConnection()
  // can block on the WS open. Run them in parallel — the WS handshake itself
  // sends no auth, and auth is attached per-message below.
  const tokenPromise = req.auth ? Promise.resolve(undefined) : ctx.cfg.getToken();
  const connPromise = ctx.getReadyConnection();
  let auth = req.auth;
  if (!req.auth) {
    const rDashAuth = await tokenPromise;
    if (rDashAuth?.isOk()) {
      auth = rDashAuth.Ok();
    }
    // if getToken fails, proceed unauthenticated
  }
  const msgBox: MsgBase = {
    src: ctx.cfg.apiUrl,
    dst: ctx.cfg.me,
    ttl: 6,
    ...msgParam,
    payload: {
      ...req,
      ...(auth ? { auth } : {}),
    },
  };
  // console.log("Prepared message box:", msgBox);
  const conn = await connPromise;
  // console.log("Got ready connection, sending message with tid:", msgParam.tid);
  const ende = JSONEnDecoderSingleton();
  const uint8ify = ende.uint8ify(msgBox);
  // console.log("Encoded message to Uint8Array:", msgParam.tid, uint8ify.length, conn.send.toString());
  const rSend = conn.send(uint8ify);
  if (rSend.isErr()) {
    return Result.Err<MsgBox<WithAuth<T>>, VibesDiyError>(
      mkResError(`Reconnecting, please retry (${String(rSend.Err())})`, "websocket-send-failed")
    );
  }
  return Result.Ok(msgBox as MsgBox<WithAuth<T>>);
}

export async function requestApiResponse<Q extends OptionalAuth, S>(
  ctx: VibesDiyApiRequestContext,
  req: Q,
  msgParam: {
    tid?: string;
    resMatch: (res: unknown) => boolean;
  }
): Promise<ResultVibesDiy<S>> {
  const tid = msgParam?.tid ?? ctx.cfg.sthis.nextId(12).str;
  const idleMs = ctx.cfg.timeoutMs;
  const conn = await ctx.getReadyConnection();
  const evento = new Evento(new W3CWebSocketEventEventoEnDecoder());
  const waitForResponse = new Future<Result<S, VibesDiyError>>();
  evento.push({
    hash: tid,
    validate: async (trigger: ValidateTriggerCtx<W3CWebSocketEvent, MsgBase, ResEnsureAppSlug>) => {
      const msg = msgBase(trigger.enRequest);
      if (msg instanceof type.errors) {
        return Result.Ok(Option.None());
      }
      const tidMatch = msg.tid === tid;
      if (!tidMatch) {
        return Result.Ok(Option.None());
      }
      const resMatch = msgParam.resMatch(msg.payload);
      const isErr = isResError(msg.payload);
      if (resMatch || isErr) {
        return Result.Ok(Option.Some(trigger.enRequest));
      }
      // Fail fast: tid matched but the response shape failed validation.
      // A schema miss on our own response type should never silently time out.
      if (!resMatch && !isErr) {
        const payloadType = (msg.payload as Record<string, unknown>)?.type;
        if (
          typeof payloadType === "string" &&
          payloadType.startsWith("vibes.diy.res-") &&
          payloadType !== "vibes.diy.res-progress"
        ) {
          waitForResponse.resolve(
            Result.Err<S, VibesDiyError>(mkResError(`Response schema mismatch for ${payloadType}`, "response-schema-error"))
          );
          return Result.Ok(Option.None());
        }
      }
      return Result.Ok(Option.None());
    },
    handle: async (trigger: HandleTriggerCtx<W3CWebSocketEvent, MsgBase, ResEnsureAppSlug>) => {
      if (isResError(trigger.validated.payload)) {
        const e = trigger.validated.payload;
        waitForResponse.resolve(Result.Err<S, VibesDiyError>(mkResError(e.error.message, e.error.code)));
      } else {
        waitForResponse.resolve(Result.Ok<S, VibesDiyError>(trigger.validated.payload as S));
      }
      return Result.Ok(EventoResult.Stop);
    },
  });

  // Idle timeout — resets on every incoming message, so a long-running
  // request that streams progress events keeps the request alive. The
  // idle window is `cfg.timeoutMs` (default 30s); silence longer than
  // that is what trips the timeout, not absolute wall time.
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;
  const resetIdleTimer = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      waitForResponse.resolve(
        Result.Err<S, VibesDiyError>(mkResError(`Request idle for ${idleMs}ms (no progress)`, "request-timeout"))
      );
    }, idleMs);
  };
  resetIdleTimer();

  const unreg = conn.onMessage((event) => {
    // Any incoming message — matching or not — keeps the request alive.
    resetIdleTimer();
    const triggerPromise = evento.trigger({
      request: event,
      send: (async (_ctx: TriggerCtx<W3CWebSocketEvent, unknown, unknown>, data: unknown) => {
        const res = await ctx.send(data as Parameters<VibesDiyApiRequestContext["send"]>[0], { tid });
        return res;
      }) as unknown as EventoSendProvider<W3CWebSocketEvent, unknown, unknown>,
    });
    Promise.resolve(triggerPromise).catch((err: unknown) => {
      console.error("[request:onMessage] evento.trigger threw:", err);
    });
  });
  const unregClose = conn.onClose(() => {
    waitForResponse.resolve(
      Result.Err<S, VibesDiyError>(mkResError("WebSocket closed before response (server disconnected)", "websocket-closed"))
    );
  });
  const unregError = conn.onError(() => {
    waitForResponse.resolve(
      Result.Err<S, VibesDiyError>(mkResError("WebSocket error before response received", "websocket-error"))
    );
  });

  const cleanup = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    unreg();
    unregClose();
    unregError();
  };

  const rReq = await ctx.send(req, { tid });
  if (rReq.isErr()) {
    cleanup();
    return Result.Err<S, VibesDiyError>(rReq.Err());
  }

  const result = await waitForResponse.asPromise();
  cleanup();
  return result;
}
