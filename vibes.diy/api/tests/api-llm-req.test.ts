import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { processStream, Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { CFInject, cfServe, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

describe("API LLM Requests", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 10000 }, () => {
  const sthis = ensureSuperThis();
  let api: VibesDiyApi;
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;

  async function createApp() {
    const now = sthis.nextId(8).str;
    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>Hello ${now}</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      assert.fail("Expected ensureAppSlug to return ResEnsureAppSlugOk");
    }
    return { appSlug: res.appSlug, userSlug: res.userSlug };
  }

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    const testUser = await createTestUser({ sthis, deviceCA });

    const fetchPair = TestFetchPair.create();
    const wsPair = TestWSPair.create();

    fetchPair.server.onServe(async (req: Request) => {
      return cfServe(
        req as unknown as CFRequest,
        {
          appCtx: appCtx.appCtx,
          cache: noopCache,
          drizzle: appCtx.vibesCtx.sql.db,
          webSocket: {
            connections: new Set(),
            webSocketPair: () => ({
              client: wsPair.p1,
              server: wsPair.p2,
            }),
          },
        } as unknown as ExecutionContext & CFInject
      ) as unknown as Promise<Response>;
    });

    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);

    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    api = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 100000,
      getToken: async () => {
        return Result.Ok(await testUser.getDashBoardToken());
      },
    });
  });

  it("can open app-mode chat", async () => {
    const { appSlug, userSlug } = await createApp();
    const rChat = await api.openChat({ mode: "app", appSlug, userSlug });
    expect(rChat.isOk()).toBe(true);
    const chat = rChat.Ok();
    expect(chat.chatId).toBeTruthy();

    const rChat2 = await api.openChat({ mode: "app", appSlug, userSlug, chatId: chat.chatId });
    expect(rChat2.isOk()).toBe(true);
    expect(rChat2.Ok().chatId).toBe(chat.chatId);

    await chat.close();
    await rChat2.Ok().close();
  });

  it("fixture produces streaming response", async () => {
    const rChatRes = await api.openChat({ mode: "chat" });
    expect(rChatRes.isOk()).toBe(true);
    const chat = rChatRes.Ok();
    const rPrompt = await chat.prompt({
      messages: [{ role: "user", content: [{ type: "text", text: "use fixture response" }] }],
    });
    expect(rPrompt.isOk()).toBe(true);
    const blockTypes: string[] = [];
    await processStream(chat.sectionStream, async (msg) => {
      if (!("blocks" in msg)) return;
      for (const b of msg.blocks) {
        blockTypes.push((b as { type: string }).type);
      }
      if (blockTypes.includes("prompt.block-end") || blockTypes.length > 200) {
        await chat.close();
      }
    });
    expect(blockTypes[0]).toBe("prompt.block-begin");
    expect(blockTypes[1]).toBe("prompt.req");
    expect(blockTypes).toContain("block.code.begin");
    expect(blockTypes).toContain("block.code.end");
    expect(blockTypes).toContain("block.end");
    expect(blockTypes).toContain("prompt.block-end");
  });
});
