import { Future, KeyedResolvOnce, OnFunc, ToDecoder } from "@adviser/cement";
import { VibeDiyApiConnection } from "./api-connection.js";
import { W3CWebSocketErrorEvent, W3CWebSocketMessageEvent, W3CWebSocketCloseEvent } from "@vibes.diy/api-types";

const vibesDiyApiPerConnection = new KeyedResolvOnce<VibeDiyApiConnection>();

async function createWebSocket(url: string): Promise<WebSocket> {
  if (typeof globalThis.WebSocket !== "function") {
    // node env
    const ws = await import("ws");
    return new ws.WebSocket(url) as unknown as WebSocket;
  }
  return new WebSocket(url);
}

export function getVibesDiyWebSocketConnection(url: string, presetWs?: WebSocket): Promise<VibeDiyApiConnection> {
  return vibesDiyApiPerConnection.get(url).once(async () => {
    const ws = presetWs ?? (await createWebSocket(url));
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
      send: (data: ToDecoder) => {
        ws.send(data as Uint8Array);
      },
    }));
  });
}
