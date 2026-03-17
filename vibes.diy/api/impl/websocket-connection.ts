import { BuildURI, Future, KeyedResolvOnce, OnFunc, runtimeFn, URI } from "@adviser/cement";
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

    ws.onopen = () => {
      waitOpen.resolve(ws);
    };
    ws.onerror = (event) => {
      onError.invoke({ type: "ErrorEvent", event: event as W3CWebSocketErrorEvent["event"] });
      waitOpen.reject(new Error(`WebSocket error: ${event}`));
    };
    ws.close = (code, reason) => {
      onClose.invoke({ type: "CloseEvent", event: { wasClean: true, code: code ?? 1000, reason: reason ?? "Closed by client" } });
      vibesDiyApiPerConnection.delete(url);
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
        ws.close();
        // console.log('ws-close', x)
        return Promise.resolve();
      },
      send: (data: Uint8Array<ArrayBuffer>) => {
        ws.send(data);
      },
    }));
  });
}
