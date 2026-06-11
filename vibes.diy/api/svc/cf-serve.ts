import {
  Request as CFRequest,
  Response as CFResponse,
  ExecutionContext,
  WebSocket as CFWebSocket,
  CfProperties,
} from "@cloudflare/workers-types";
import { createAppContext, processRequest } from "./create-handler.js";

import { WSSendProvider } from "./svc-ws-send-provider.js";
import { vibesMsgEvento } from "./vibes-msg-evento.js";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { AppContext, exception2Result, Lazy, LoggerImpl, Result, URI } from "@adviser/cement";
import { ensureSuperThis, hashObjectSync } from "@fireproof/core-runtime";
import { CfCacheIf, type VibesApiSQLCtx } from "./types.js";
import {
  type AccessDescriptor,
  type UserContext,
  type EvtViewerGrantsChanged,
  CFEnv,
  type EvtRequestGrant,
  MsgBase,
} from "@vibes.diy/api-types";
import { SuperThis } from "@fireproof/core-types-base";
import { cfDrizzle, createVibesApiTables, toDBFlavour, VibesSqlite } from "@vibes.diy/api-sql";
import { R2ToS3Api } from "./peers/r2-to-s3api.js";
import { getQuickJSWASMModule, type QuickJSWASMModule } from "@cf-wasm/quickjs";

// declare global {
//   class WebSocketPair {
//     0: WebSocket;
//     1: WebSocket;
//   }
// }

// function cfWebSocketPair(): { client: CFWebSocket; server: CFWebSocket } {
//   console.log("cfWebSocketPair called-1", WebSocketPair);
//   const webSocketPair = new WebSocketPair();
//   console.log("cfWebSocketPair called-2", WebSocketPair);
//   const [client, server] = Object.values(webSocketPair) as [CFWebSocket, CFWebSocket];
//   return { client, server };
// }

export interface CFInjectMutable {
  sthis?: SuperThis;
  appCtx: AppContext;
  cache: CfCacheIf;
  webSocket?: {
    connections: Set<WSSendProvider>;
    webSocketPair: () => { client: WebSocket; server: WebSocket };
  };
  drizzle: VibesSqlite;
  wsResponse?: Response;
  llmRequest?: (prompt: LLMRequest, opts?: { readonly signal?: AbortSignal }) => Promise<Response>;
}
export type CFInject = Readonly<CFInjectMutable>;

function netHashFn({
  colo,
  country,
  continent,
  city,
  postalCode,
  latitude,
  longitude,
  timezone,
  region,
  regionCode,
  metroCode,
  /* clientTcpRtt segmented */
}: CfProperties): string {
  return hashObjectSync({
    colo,
    country,
    continent,
    city,
    postalCode,
    latitude,
    longitude,
    timezone,
    region,
    regionCode,
    metroCode,
  });
}

const HOT_VIBE_CONN_WARN_THRESHOLD = 200;

export function localBroadcastCallbacks(connections: Set<WSSendProvider>, env: CFEnv) {
  const shouldLog = env.ENVIRONMENT !== "prod";

  return {
    notifyDocChanged: async (
      evt: { ownerHandle: string; appSlug: string; dbName: string; docId: string; channel?: string },
      senderConnId: string
    ): Promise<void> => {
      // Fan-out keys are db-scoped. The bare db key owner/app/<dbName> identifies
      // the db; a channel key nests UNDER it as owner/app/<dbName>/<channel>. The
      // payload keeps the REAL dbName so the client's `data.dbName === this.name`
      // filter passes (see #2301). callers normalize channels so "" never reaches
      // here.
      //
      // Scoping channels under their db keeps db and channel names in separate
      // path segments so they can never collide in the flat key set: a db literally
      // named like another db's channel (owner/app/beta) is a 3-segment key that
      // cannot equal a 4-segment channel key owner/app/alpha/beta (#2340).
      const dbKey = `${evt.ownerHandle}/${evt.appSlug}/${evt.dbName}`;
      const channelKey = evt.channel ? `${dbKey}/${evt.channel}` : dbKey;
      // The match below also wakes connections holding the bare db key. A client
      // that subscribed before any doc materialized the channel only holds the bare
      // owner/app/<dbName> key, so channel-routed writes would otherwise never reach
      // it — the "join before grant" gap (#2337). Over-delivery is access-safe:
      // evt-doc-changed carries no document content and the client re-queries
      // through the channel/grant-gated read path, so a connection that can't read
      // the channel simply sees nothing new. Channel-key subscribers stay narrow
      // (they match only their own db's channel), so a private-channel write still
      // doesn't fan out to unrelated channel subscriptions.
      if (shouldLog) {
        console.info("[AppSessions] notifyDocChanged key:", channelKey, "conn:", senderConnId.slice(0, 8));
        console.info("[AppSessions] docChanged fanout", "key=", channelKey, "conns=", connections.size);
      }
      if (connections.size >= HOT_VIBE_CONN_WARN_THRESHOLD) {
        console.warn(
          "[AppSessions] hot-vibe fanout",
          "key=",
          channelKey,
          "conns=",
          connections.size,
          "threshold=",
          HOT_VIBE_CONN_WARN_THRESHOLD
        );
      }
      const fullEvt = { type: "vibes.diy.evt-doc-changed", ...evt };
      for (const conn of connections) {
        if (!conn.subscribedDocKeys.has(channelKey) && !conn.subscribedDocKeys.has(dbKey)) continue;
        if (conn.connId === senderConnId) continue;
        exception2Result(() =>
          conn.ws.send(
            conn.ende.uint8ify({
              tid: crypto.randomUUID(),
              src: "vibes.diy.api",
              dst: "vibes.diy.client",
              ttl: 10,
              payload: fullEvt,
            })
          )
        );
      }
    },
    registerDocSubscription: async (_subscriptionKey: string): Promise<void> => {
      // no-op: no external coordinator needed for local broadcast
    },
    deregisterDocSubscription: async (_subscriptionKey: string): Promise<void> => {
      // no-op
    },
    notifyRequestGrantChanged: async (evt: EvtRequestGrant, senderConnId: string): Promise<void> => {
      const key = `${evt.grant.ownerHandle}/${evt.grant.appSlug}`;
      if (shouldLog) {
        console.info("[AppSessions] notifyRequestGrantChanged key:", key, "conn:", senderConnId.slice(0, 8));
      }
      for (const conn of connections) {
        if (!conn.subscribedRequestGrantKeys.has(key)) continue;
        if (conn.connId === senderConnId) continue;
        exception2Result(() =>
          conn.ws.send(
            conn.ende.uint8ify({
              tid: crypto.randomUUID(),
              src: "vibes.diy.api",
              dst: "vibes.diy.client",
              ttl: 10,
              payload: evt,
            })
          )
        );
      }
    },
    registerRequestGrantSubscription: async (_subscriptionKey: string): Promise<void> => {
      // no-op
    },
    deregisterRequestGrantSubscription: async (_subscriptionKey: string): Promise<void> => {
      // no-op
    },
    notifyViewerGrantsChanged: async (evt: EvtViewerGrantsChanged, _senderConnId: string): Promise<void> => {
      const key = `${evt.ownerHandle}/${evt.appSlug}`;
      if (shouldLog) {
        console.info("[AppSessions] notifyViewerGrantsChanged key:", key);
        console.info("[AppSessions] viewerGrants fanout", "key=", key, "conns=", connections.size);
      }
      if (connections.size >= HOT_VIBE_CONN_WARN_THRESHOLD) {
        console.warn(
          "[AppSessions] hot-vibe fanout",
          "key=",
          key,
          "conns=",
          connections.size,
          "threshold=",
          HOT_VIBE_CONN_WARN_THRESHOLD
        );
      }
      // DON'T skip sender — iframe needs grant refresh
      for (const conn of connections) {
        if (!conn.subscribedViewerGrantKeys.has(key)) continue;
        exception2Result(() =>
          conn.ws.send(
            conn.ende.uint8ify({
              tid: crypto.randomUUID(),
              src: "vibes.diy.api",
              dst: "vibes.diy.client",
              ttl: 10,
              payload: evt,
            })
          )
        );
      }
    },
    registerViewerGrantsSubscription: async (_subscriptionKey: string): Promise<void> => {
      // no-op
    },
    deregisterViewerGrantsSubscription: async (_subscriptionKey: string): Promise<void> => {
      // no-op
    },
  };
}

export async function localInvokeAccessFn(
  cachedModuleRef: { module: QuickJSWASMModule | null },
  params: {
    cid: string;
    doc: unknown;
    oldDoc: unknown | null;
    user: UserContext | null;
    source?: string;
    grantState?: {
      members: Record<string, string[]>;
      roleGrants: Record<string, string[]>;
      userGrants: Record<string, string[]>;
    };
    adminMode?: boolean;
  }
): Promise<AccessDescriptor | { forbidden: string }> {
  if (!params.source) {
    return { forbidden: "access function source not provided" };
  }

  const source = params.source;
  const grantState = params.grantState ?? { members: {}, roleGrants: {}, userGrants: {} };

  function resolveChannels(userHandle: string): Set<string> {
    const channels = new Set<string>();
    const direct = grantState.userGrants[userHandle];
    if (direct) for (const ch of direct) channels.add(ch);
    for (const [role, members] of Object.entries(grantState.members)) {
      if ((members as string[]).includes(userHandle)) {
        const roleChannels = grantState.roleGrants[role];
        if (roleChannels) for (const ch of roleChannels) channels.add(ch);
      }
    }
    return channels;
  }

  const QuickJS = cachedModuleRef.module ?? (await getQuickJSWASMModule());
  cachedModuleRef.module = QuickJS;
  const vm = QuickJS.newContext();

  try {
    for (const stmt of [
      `const doc = ${JSON.stringify(params.doc)};`,
      `const oldDoc = ${JSON.stringify(params.oldDoc)};`,
      `const user = ${JSON.stringify(params.user)};`,
    ]) {
      const r = vm.evalCode(stmt);
      if (r.error) {
        const errVal = vm.dump(r.error);
        r.error.dispose();
        return { forbidden: `access function setup error: ${String(errVal)}` };
      } else {
        r.value.dispose();
      }
    }

    const ctxObj = vm.newObject();

    const requireAccessFn = vm.newFunction("requireAccess", (channelIdHandle: Parameters<typeof vm.dump>[0]) => {
      if (params.adminMode === true) {
        return undefined;
      }
      const channelId = vm.dump(channelIdHandle) as string;
      if (!params.user) {
        return { error: vm.newError("authentication required") };
      }
      const channels = resolveChannels(params.user.userHandle);
      if (!channels.has(channelId)) {
        return { error: vm.newError(`not in channel: ${channelId}`) };
      }
      return undefined;
    });

    const requireRoleFn = vm.newFunction("requireRole", (roleNameHandle: Parameters<typeof vm.dump>[0]) => {
      if (params.adminMode === true) {
        return undefined;
      }
      const roleName = vm.dump(roleNameHandle) as string;
      if (!params.user) {
        return { error: vm.newError("authentication required") };
      }
      const roleMembers = grantState.members[roleName] as string[] | undefined;
      if (!roleMembers?.includes(params.user.userHandle)) {
        return { error: vm.newError(`not in role: ${roleName}`) };
      }
      return undefined;
    });

    vm.setProp(ctxObj, "requireAccess", requireAccessFn);
    vm.setProp(ctxObj, "requireRole", requireRoleFn);
    vm.setProp(vm.global, "ctx", ctxObj);
    requireAccessFn.dispose();
    requireRoleFn.dispose();
    ctxObj.dispose();

    const cleanSource = source.replace(/export\s+/g, "").replace(/^default\s+/, "");
    const fnNameMatch = cleanSource.match(/^function\s+(\w+)\s*\(/);
    const isAnonymousFnOrArrow = /^function\s*\(/.test(cleanSource) || /^\(/.test(cleanSource) || /^\w+\s*=>/.test(cleanSource);
    const evalSource = fnNameMatch
      ? `${cleanSource}\n;${fnNameMatch[1]}(doc, oldDoc, user, ctx)`
      : isAnonymousFnOrArrow
        ? `const __accessFn = ${cleanSource}\n;__accessFn(doc, oldDoc, user, ctx)`
        : `(function() { ${cleanSource} })()`;
    const fnResult = vm.evalCode(evalSource);

    if (fnResult.error) {
      const errVal = vm.dump(fnResult.error);
      fnResult.error.dispose();
      const reason =
        typeof errVal === "object" && errVal !== null && "forbidden" in errVal
          ? String((errVal as Record<string, unknown>).forbidden)
          : typeof errVal === "string"
            ? errVal
            : `access function error: ${JSON.stringify(errVal)}`;
      return { forbidden: reason };
    }

    const accessResult = vm.dump(fnResult.value);
    fnResult.value.dispose();
    return accessResult as AccessDescriptor;
  } finally {
    vm.dispose();
  }
}

export async function cfServeAppCtx(
  request: CFRequest,
  env: CFEnv,
  ctx: ExecutionContext & Omit<CFInject, "appCtx">,
  callbackOverrides?: Record<string, unknown>
) {
  const netHash = Lazy(() => netHashFn(request.cf as CfProperties));
  const sthis =
    ctx.sthis ??
    ensureSuperThis({
      logger: new LoggerImpl(),
    });
  // console.log("Creating app context with netHash:", netHash(), env.DB_FLAVOUR);
  const drizzleDB = cfDrizzle(env, env.DB, ctx.drizzle).db;

  const s3Api = env.FS_IDS_BUCKET ? new R2ToS3Api(env.FS_IDS_BUCKET, sthis) : undefined;

  return createAppContext({
    sthis,
    db: drizzleDB,
    connections: ctx.webSocket?.connections ?? new Set() /* need no connections if not WS */,
    cache: ctx.cache,

    storageSystems: {
      sql: {
        flavour: toDBFlavour(env.DB_FLAVOUR),
        db: drizzleDB,
        assets: createVibesApiTables(toDBFlavour(env.DB_FLAVOUR)).assets,
      },
      ...(s3Api ? { s3: s3Api } : {}),
    },

    postQueue: async (msg: MsgBase) => {
      // console.log("Posting message to queue:", msg);
      await env.VIBES_SERVICE.send(JSON.stringify(msg));
    },
    fetchAsset: async (iurl: string) => {
      // console.log("Fetching asset from URL:", url);
      // const vibePkgUri = URI.from(url);
      // if (vibePkgUri.protocol !== 'file:') {
      //   if (vibePkgUri.pathname.startsWith("/vibe-pkg/")) {
      //     url = vibePkgUri.build().pathname(vibePkgUri.pathname.replace("/vibe-pkg/", "/_vibe-pkg/")).toString();
      //   }
      //   console.log("Patched asset URL for fetchAsset:", url);
      // }
      // const uri = URI.from(url);
      // const assetUrl = uri.build().pathname(uri.pathname.replace(/^\//, "/_")).toString();
      // const assetUrl = uri.toString();
      // console.log("Fetching asset from URL:", url, "assetUrl:", assetUrl);

      const iuri = URI.from(iurl);
      const urls = [iuri.toString()];
      if (iuri.pathname.startsWith("/vibe-pkg/")) {
        urls.push(iuri.build().pathname(iuri.pathname.replace("/vibe-pkg/", "/_vibe-pkg/")).toString());
      }
      let res!: CFResponse;
      let url!: string;
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < urls.length; i++) {
        url = urls[i];
        res = await env.ASSETS.fetch(url);
        if (res.ok) {
          break;
        }
      }
      // console.log("Received response for asset fetch:", res);
      if (!res.ok) {
        return Result.Err(`Failed to fetch asset from ${url}: ${res.status} ${res.statusText}`);
      }
      if (!res.body) {
        return Result.Err(`No body in response when fetching asset from ${url}`);
      }
      // const text = await res.text();
      // console.log("Fetching asset from URL:", assetUrl, '->', text);
      return Result.Ok(res.body as unknown as ReadableStream<Uint8Array>);
    },
    // this help to provide enough uniqueness
    // to find clients which try to steal tokens
    netHash,
    llmRequest: ctx.llmRequest,
    env: env as unknown as Record<string, string>,
    invokeAccessFn: async (params: {
      cid: string;
      doc: unknown;
      oldDoc: unknown | null;
      user: UserContext | null;
      source?: string;
      grantState?: {
        members: Record<string, string[]>;
        roleGrants: Record<string, string[]>;
        userGrants: Record<string, string[]>;
      };
      adminMode?: boolean;
    }): Promise<AccessDescriptor | { forbidden: string }> => {
      // Source is resolved upstream by app-documents.ts via vctx.storage.fetch(assetURI).
      // If it's undefined here, the DO handles the missing-source case by returning forbidden.
      const id = env.ACCESS_FN_DO.idFromName(params.cid);
      const stub = env.ACCESS_FN_DO.get(id);
      const res = await stub.fetch(
        new Request("https://internal/invoke", {
          method: "POST",
          body: JSON.stringify({
            doc: params.doc,
            oldDoc: params.oldDoc,
            user: params.user,
            source: params.source,
            grantState: params.grantState,
            adminMode: params.adminMode,
          }),
          headers: { "Content-Type": "application/json" },
        }) as unknown as CFRequest
      );
      return res.json() as Promise<AccessDescriptor | { forbidden: string }>;
    },
    ...(callbackOverrides ?? {}),
  });
}

const INTERNAL_REFERER_SUFFIXES = [".vibesdiy.net", ".workers.dev"];
const INTERNAL_REFERER_EXACT = new Set(["vibes.diy"]);
export function isInternalReferer(hostname: string): boolean {
  return INTERNAL_REFERER_EXACT.has(hostname) || INTERNAL_REFERER_SUFFIXES.some((s) => hostname.endsWith(s));
}

function shouldLogVerbose(ctx: CFInject): boolean {
  const rEnvironment = exception2Result(() => ctx.appCtx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx").sthis.env.get("ENVIRONMENT"));
  if (rEnvironment.isErr()) {
    return true;
  }
  return rEnvironment.Ok() !== "prod";
}

export async function cfServe(
  request: CFRequest,
  ctx: CFInject,
  eventoFactory?: () => ReturnType<typeof vibesMsgEvento>
): Promise<CFResponse> {
  const appCtx = ctx.appCtx;
  const shouldLog = shouldLogVerbose(ctx);
  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader !== "websocket") {
    const referer = request.headers.get("Referer");
    if (referer) {
      const rRefUri = URI.fromResult(referer);
      const rReqUri = URI.fromResult(request.url);
      if (rRefUri.isErr() || rReqUri.isErr()) {
        if (shouldLog) {
          console.info("[referer] malformed", referer, request.method, request.url);
        }
      } else {
        // cement URI.fromResult() returns Ok for non-standard protocols (e.g. android-app:,
        // fbrpc:) but .hostname then throws because those protocols are not in
        // hasHostPartProtocols. Use exception2Result so cement stays authoritative.
        const refUri = rRefUri.Ok();
        const reqUri = rReqUri.Ok();
        const rHostnames = exception2Result(() => ({ ref: refUri.hostname, req: reqUri.hostname }));
        if (rHostnames.isOk()) {
          const { ref: refHostname, req: reqHostname } = rHostnames.Ok();
          if (!isInternalReferer(refHostname) && refHostname !== reqHostname && !/\.[a-z]{1,4}$/i.test(reqUri.pathname)) {
            if (shouldLog) {
              console.info("[referer]", refUri.toString(), request.method, reqUri.pathname);
            }
          }
        }
      }
    }
    return processRequest(appCtx, request as unknown as Request) as unknown as Promise<CFResponse>;
  }
  if (!ctx.webSocket) {
    throw new Error("WebSocket upgrade requested but no webSocketPair function provided in context");
  }
  const ws = ctx.webSocket;
  const { client, server } = ctx.webSocket.webSocketPair(); // ? ctx.webSocketPair() : cfWebSocketPair();
  (server as unknown as CFWebSocket).accept();

  const wsSendProvider = new WSSendProvider(server as unknown as WebSocket);
  ws.connections.add(wsSendProvider);
  if (shouldLog) {
    console.info("New WebSocket connection accepted", ws.connections.size);
  }

  const wsEvento = eventoFactory ? eventoFactory() : vibesMsgEvento();

  server.addEventListener("message", (event) => {
    wsEvento.trigger({ ctx: appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider }).catch((err: unknown) => {
      console.error("[ws-message] unhandled trigger rejection:", err);
      // Try to send a targeted res-error (preserving the tid) so only the one
      // failing request gets an immediate error rather than killing the connection.
      // If we can't parse the tid, just log and leave the connection open — the
      // one request times out at 30s while all other in-flight requests continue.
      try {
        const raw = (event as MessageEvent).data;
        const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw as Uint8Array);
        const msg = JSON.parse(text) as { tid?: string; src?: string; dst?: string };
        if (msg.tid) {
          wsSendProvider.ws.send(
            wsSendProvider.ende.uint8ify({
              tid: msg.tid,
              src: msg.dst ?? "vibes.diy.server",
              dst: msg.src ?? "vibes.diy.client",
              ttl: 1,
              payload: {
                type: "vibes.diy.res-error",
                error: { message: `Internal error: ${err instanceof Error ? err.message : String(err)}`, code: "internal-error" },
              },
            })
          );
        }
      } catch (parseErr) {
        console.error("[ws-message] failed to parse message for error response:", parseErr);
      }
    });
  });

  // No deregister-on-close: with UUID sharding each DO has 1 connection, so the old WS onclose
  // races with the new WS subscribeDocs and clobbers the fresh registration. Instead, stale
  // subscriptions self-clean when a later per-vibe fan-out fails to send to a closed connection.
  server.addEventListener("close", (event) => {
    if (shouldLog) {
      console.info("WebSocket connection closed", ws.connections.size - 1);
    }
    wsEvento.trigger({ ctx: appCtx, request: { type: "CloseEvent", event }, send: wsSendProvider });
    ws.connections.delete(wsSendProvider);
  });

  server.addEventListener("error", (event: Event) => {
    console.error("WebSocket error", event);
    wsEvento.trigger({ ctx: appCtx, request: { type: "ErrorEvent", event: event as ErrorEvent }, send: wsSendProvider });
    ws.connections.delete(wsSendProvider);
  });
  // cast wiredness don't ask me --- ask Cloudflare
  return (ctx.wsResponse ??
    new globalThis.Response(null, {
      status: 101,
      webSocket: client,
    } as unknown as ResponseInit)) as unknown as CFResponse;
}
