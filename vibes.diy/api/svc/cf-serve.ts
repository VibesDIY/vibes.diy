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
import { AppContext, Lazy, LoggerImpl, Result, URI } from "@adviser/cement";
import { ensureSuperThis, hashObjectSync } from "@fireproof/core-runtime";
import { CfCacheIf } from "./types.js";
import { CFEnv, MsgBase } from "@vibes.diy/api-types";
import { SuperThis } from "@fireproof/core-types-base";
import { cfDrizzle, createVibesApiTables, toDBFlavour, VibesSqlite } from "@vibes.diy/api-sql";
import { R2ToS3Api } from "./peers/r2-to-s3api.js";

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

export interface DocNotifyCtx {
  readonly shardId: string;
  readonly env: CFEnv;
}

export interface CFInjectMutable {
  sthis?: SuperThis;
  appCtx: AppContext;
  cache: CfCacheIf;
  webSocket?: {
    connections: Set<WSSendProvider>;
    webSocketPair: () => { client: WebSocket; server: WebSocket };
  };
  drizzle: VibesSqlite;
  // assetBucket: R2Bucket;
  wsResponse?: Response;
  llmRequest?: (prompt: LLMRequest, opts?: { readonly signal?: AbortSignal }) => Promise<Response>;
  docNotify?: DocNotifyCtx;
  // readonly db?: D1Database;
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

function docNotifyCallbacks(dn: DocNotifyCtx) {
  function fetchDocNotify(key: string, body: Record<string, unknown>): Promise<CFResponse> {
    const id = dn.env.DOC_NOTIFY.idFromName(key);
    const stub = dn.env.DOC_NOTIFY.get(id);
    return stub.fetch(
      new Request("https://internal/doc-notify", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }) as unknown as CFRequest
    );
  }

  return {
    notifyDocChanged: async (evt: { userSlug: string; appSlug: string; dbName: string; docId: string }, senderConnId: string) => {
      const key = `${evt.userSlug}/${evt.appSlug}/${evt.dbName}`;
      console.log("[docNotify] notifyDocChanged key:", key, "shard:", dn.shardId.slice(0, 8), "conn:", senderConnId.slice(0, 8));
      await fetchDocNotify(key, {
        action: "notify",
        senderShardId: dn.shardId,
        senderConnId,
        evt: { type: "vibes.diy.evt-doc-changed", ...evt },
      });
    },
    registerDocSubscription: async (subscriptionKey: string) => {
      console.log("[docNotify] register key:", subscriptionKey, "shard:", dn.shardId.slice(0, 8));
      await fetchDocNotify(subscriptionKey, { action: "register", shardId: dn.shardId });
    },
    deregisterDocSubscription: async (subscriptionKey: string) => {
      console.log("[docNotify] deregister key:", subscriptionKey, "shard:", dn.shardId.slice(0, 8));
      await fetchDocNotify(subscriptionKey, { action: "deregister", shardId: dn.shardId });
    },
  };
}

export async function cfServeAppCtx(request: CFRequest, env: CFEnv, ctx: ExecutionContext & Omit<CFInject, "appCtx">) {
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
    ...(ctx.docNotify ? docNotifyCallbacks(ctx.docNotify) : {}),
  });
}

export async function cfServe(request: CFRequest, ctx: CFInject): Promise<CFResponse> {
  const appCtx = ctx.appCtx;
  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader !== "websocket") {
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
  console.log("New WebSocket connection accepted", ws.connections.size);

  const wsEvento = vibesMsgEvento();

  server.addEventListener("message", (event) => {
    wsEvento.trigger({ ctx: appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  });

  // No deregister-on-close: with UUID sharding each DO has 1 connection, so the old WS onclose
  // races with the new WS subscribeDocs and clobbers the fresh registration. Instead, stale shards
  // self-clean via failed fan-out in DocNotify (which removes them from persistent storage).
  server.addEventListener("close", (event) => {
    console.log("WebSocket connection closed", ws.connections.size - 1);
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
