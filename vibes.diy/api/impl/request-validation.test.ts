import { describe, expect, it, vi } from "vitest";
import { OnFunc, Result } from "@adviser/cement";
import { VibesDiyApi, VibesDiyApiParam } from "./index.js";
import { VibeDiyApiConnection } from "./api-connection.js";
import { W3CWebSocketCloseEvent, W3CWebSocketErrorEvent, W3CWebSocketMessageEvent } from "@vibes.diy/api-types";

function createMockConnection(): {
  connection: VibeDiyApiConnection;
  emitMessage: (message: Record<string, unknown>) => void;
} {
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

  const emitMessage = (message: Record<string, unknown>): void => {
    const payload = new Blob([new TextEncoder().encode(JSON.stringify(message))]);
    const evt = {
      type: "MessageEvent",
      event: { data: payload },
    } as W3CWebSocketMessageEvent;
    onMessage.invoke(evt);
  };

  return { connection, emitMessage };
}

function createApi(connection: VibeDiyApiConnection): VibesDiyApi {
  class TestVibesDiyApi extends VibesDiyApi {
    override async getReadyConnection(): Promise<VibeDiyApiConnection> {
      return connection;
    }
  }

  const getToken: VibesDiyApiParam["getToken"] = async () => Result.Ok({} as never);
  return new TestVibesDiyApi({
    apiUrl: "http://localhost:9999/api",
    getToken,
    timeoutMs: 2000,
  });
}

describe("VibesDiyApi.request", () => {
  it("does not run resMatch for messages with a non-matching tid", async () => {
    const { connection, emitMessage } = createMockConnection();
    const api = createApi(connection);
    const tid = "target-tid";
    const resMatch = vi.fn(() => false);

    const requestPromise = api.request({}, { tid, resMatch });

    emitMessage({
      tid: "other-tid",
      src: "vibes.diy.server",
      dst: "vibes.diy.client.test",
      ttl: 10,
      payload: {
        type: "vibes.diy.res-error",
        error: { message: "ignore", code: "ignore" },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(resMatch).not.toHaveBeenCalled();

    emitMessage({
      tid,
      src: "vibes.diy.server",
      dst: "vibes.diy.client.test",
      ttl: 10,
      payload: {
        type: "vibes.diy.res-error",
        error: { message: "expected", code: "expected" },
      },
    });

    const result = await requestPromise;
    expect(result.isErr()).toBe(true);
    expect(result.Err()).toMatchObject({ error: { code: "expected" } });
    expect(resMatch).toHaveBeenCalledTimes(1);
  });
});
