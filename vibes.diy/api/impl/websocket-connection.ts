import { BuildURI, exception2Result, Future, KeyedResolvOnce, OnFunc, Result, runtimeFn, URI } from "@adviser/cement";
import { VibeDiyApiConnection } from "./api-connection.js";
import { W3CWebSocketErrorEvent, W3CWebSocketMessageEvent, W3CWebSocketCloseEvent } from "@vibes.diy/api-types";

const vibesDiyApiPerConnection = new KeyedResolvOnce<VibeDiyApiConnection>();

async function createWebSocket(url: string, ca?: string[]): Promise<WebSocket> {
  if (!runtimeFn().isBrowser) {
    // node env — pass https.globalAgent explicitly so ws uses its CA bundle
    // (ws does not inherit https.globalAgent automatically)
    const ws = await import("ws");
    // console.log(`ws-node:${url}`, ca ?? 'no-ca')
    return new ws.WebSocket(url, { ca }) as unknown as WebSocket;
  }
  return new WebSocket(url);
}

export function getVibesDiyWebSocketConnection(url: string, presetWs?: WebSocket, ca?: string[]): Promise<VibeDiyApiConnection> {
  const wsSocketUrl = BuildURI.from(url)
    .protocol(["https", "wss"].find((i) => URI.from(url).protocol.startsWith(i)) ? "wss:" : "ws:")
    .toString();
  return vibesDiyApiPerConnection.get(wsSocketUrl).once(async ({ ctx }) => {
    const url = ctx.givenKey;
    const ws = presetWs ?? (await createWebSocket(wsSocketUrl, ca));
    const waitOpen = new Future<WebSocket>();
    const onError = OnFunc<(event: W3CWebSocketErrorEvent) => void>();
    const onMessage = OnFunc<(event: W3CWebSocketMessageEvent) => void>();
    const onClose = OnFunc<(event: W3CWebSocketCloseEvent) => void>();
    // const ende = JSONEnDecoderSingleton();

    const nativeClose = ws.close?.bind(ws);

    ws.onopen = () => {
      waitOpen.resolve(ws);
    };
    ws.onerror = (event) => {
      onError.invoke({ type: "ErrorEvent", event: event as W3CWebSocketErrorEvent["event"] });
      vibesDiyApiPerConnection.delete(url);
      waitOpen.reject(new Error(`WebSocket error: ${event}`));
    };
    ws.onclose = (event) => {
      // Only evict if this socket still owns the cache entry
      const cached = vibesDiyApiPerConnection.get(url);
      if (cached) {
        vibesDiyApiPerConnection.delete(url);
      }
      onClose.invoke({ type: "CloseEvent", event: { wasClean: event.wasClean, code: event.code, reason: event.reason } });
      waitOpen.reject(new Error(`WebSocket closed: code=${event.code} reason=${event.reason}`));
    };
    ws.onmessage = (event) => {
      onMessage.invoke({ type: "MessageEvent", event });
    };
    if (ws.readyState === WebSocket.OPEN) {
      waitOpen.resolve(ws);
    }
    return waitOpen.asPromise().then((ws) => ({
      ctx: ws,
      onError,
      onMessage,
      onClose,
      close: () => {
        vibesDiyApiPerConnection.delete(url);
        nativeClose?.();
        return Promise.resolve();
      },
      send: (data: Uint8Array<ArrayBuffer>): Result<void> => {
        if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
          vibesDiyApiPerConnection.delete(url);
          return Result.Err(`WebSocket is not open (readyState=${ws.readyState})`);
        }
        const rSend = exception2Result(() => ws.send(data));
        if (rSend.isErr()) {
          vibesDiyApiPerConnection.delete(url);
          return Result.Err(`WebSocket send failed: ${String(rSend.Err())}`);
        }
        return Result.Ok(undefined);
      },
    }));
  });
}
