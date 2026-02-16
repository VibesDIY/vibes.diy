import {
  DurableObject,
  WebSocketPair as WebSocketPairType,
  WebSocket as CFWebSocket,
  ExecutionContext,
  Request as CFRequest,
  Response as CFResponse,
  CacheStorage,
  DurableObjectState,
} from "@cloudflare/workers-types";
import { CfCacheIf, cfServe } from "@vibes.diy/api-svc";
import { Env } from "./env.js";
import { WSSendProvider } from "@vibes.diy/api-svc/svc-ws-send-provider.js";
import { CFInjectMutable } from "@vibes.diy/api-svc/cf-serve.js";
import { withWorkerBoundaryContext, workerInternalErrorResponse } from "./boundary.js";

declare const caches: CacheStorage;
// declare const DurableObject: typeof DurableObject;
declare const WebSocketPair: typeof WebSocketPairType;

function cfWebSocketPair(): { client: WebSocket; server: WebSocket } {
  // console.log("cfWebSocketPair called-1", WebSocketPair);
  const webSocketPair = new WebSocketPair();
  // console.log("cfWebSocketPair called-2", WebSocketPair);
  const [client, server] = Object.values(webSocketPair) as [CFWebSocket, CFWebSocket];
  return { client: client as unknown as WebSocket, server: server as unknown as WebSocket };
}

export class ChatSessions implements DurableObject {
  private connections: Set<WSSendProvider> = new Set<WSSendProvider>();
  // private state: DurableObjectState;
  private env: Env;

  constructor(_state: DurableObjectState, env: Env) {
    // this.state = state;
    this.env = env;
  }

  async fetch(request: CFRequest): Promise<CFResponse> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const cctx = {} as unknown as ExecutionContext & CFInjectMutable;
    // cctx.cache = new NoCache() as unknown as CfCacheIf; // Disable caching for now - can implement custom caching logic in the future if needed
    cctx.cache = caches.default as unknown as CfCacheIf; // Use Cloudflare's default cache
    cctx.webSocket = {
      connections: this.connections,
      webSocketPair: cfWebSocketPair,
    };
    return withWorkerBoundaryContext({
      request,
      env: this.env,
      cctx,
      onError: workerInternalErrorResponse,
      onContext: async () => cfServe(request, cctx),
    });
  }
}
