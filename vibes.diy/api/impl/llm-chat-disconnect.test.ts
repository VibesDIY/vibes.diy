import { describe, expect, it } from "vitest";
import { OnFunc, Result } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { LLMChatImpl } from "./llm-chat.js";
import { VibeDiyApiConnection } from "./api-connection.js";
import { W3CWebSocketCloseEvent, W3CWebSocketErrorEvent, W3CWebSocketMessageEvent } from "@vibes.diy/api-types";

function createMockConnection() {
  const onMessage = OnFunc<(event: W3CWebSocketMessageEvent) => void>();
  const onClose = OnFunc<(event: W3CWebSocketCloseEvent) => void>();
  const onError = OnFunc<(event: W3CWebSocketErrorEvent) => void>();
  const connection: VibeDiyApiConnection = {
    ctx: {},
    onMessage,
    onClose,
    onError,
    send: () => Result.Ok(undefined),
    close: async () => undefined,
  };
  return { connection, onClose, onError };
}

function stubApi(connection: VibeDiyApiConnection) {
  return {
    cfg: { sthis: ensureSuperThis() },
    getReadyConnection: async () => connection,
    send: async () => Result.Ok({} as never),
    request: async () => Result.Ok({ chatId: "chat-1", ownerHandle: "o", appSlug: "a", mode: "codegen" }),
  };
}

async function openChat(connection: VibeDiyApiConnection) {
  const rChat = await LLMChatImpl.open({ ownerHandle: "o", appSlug: "a", mode: "codegen" } as never, stubApi(connection) as never);
  expect(rChat.isOk()).toBe(true);
  return rChat.Ok();
}

describe("LLMChat section stream on transport loss", () => {
  it("closes the section stream when the connection closes", async () => {
    const { connection, onClose } = createMockConnection();
    const chat = await openChat(connection);
    const reader = chat.sectionStream.getReader();
    const pendingRead = reader.read();
    onClose.invoke({} as W3CWebSocketCloseEvent);
    const { done } = await pendingRead;
    expect(done).toBe(true);
  });

  it("closes the section stream when the connection errors", async () => {
    const { connection, onError } = createMockConnection();
    const chat = await openChat(connection);
    const reader = chat.sectionStream.getReader();
    const pendingRead = reader.read();
    onError.invoke({} as W3CWebSocketErrorEvent);
    const { done } = await pendingRead;
    expect(done).toBe(true);
  });

  it("explicit close() after transport loss does not throw", async () => {
    const { connection, onClose } = createMockConnection();
    const chat = await openChat(connection);
    onClose.invoke({} as W3CWebSocketCloseEvent);
    await expect(chat.close()).resolves.toBeUndefined();
  });

  it("explicit close() unregisters the connection message listener", async () => {
    // Regression (#2473 review): close() must tear down the onMessage
    // subscription, not just close the writer. Otherwise a still-alive socket
    // that later flushes a message for this tid — the half-open reconnect case
    // — keeps invoking the evento handler, which writes into the already-closed
    // section stream (rejected writes / unhandled rejections).
    const { connection } = createMockConnection();
    let unregistered = false;
    const register = connection.onMessage;
    (connection as { onMessage: (cb: (e: W3CWebSocketMessageEvent) => void) => () => void }).onMessage = (cb) => {
      const unreg = register(cb);
      return () => {
        unregistered = true;
        unreg();
      };
    };
    const chat = await openChat(connection);
    expect(unregistered).toBe(false);
    await chat.close();
    expect(unregistered).toBe(true);
  });
});
