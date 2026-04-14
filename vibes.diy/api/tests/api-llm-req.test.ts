import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { processStream, Result, sleep, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { CFInject, cfServe, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { createIsolatedDB } from "./globalSetup.libsql.js";

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
    const isolatedDbUrl = await createIsolatedDB(import.meta.dirname, "api-llm");
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA, isolatedDbUrl);
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

  it("emits prompt.error when LLM throws", async () => {
    const rChatRes = await api.openChat({ mode: "chat" });
    expect(rChatRes.isOk()).toBe(true);
    const chat = rChatRes.Ok();
    const rPrompt = await chat.prompt({
      messages: [{ role: "user", content: [{ type: "text", text: "trigger error" }] }],
    });
    expect(rPrompt.isOk()).toBe(true);
    const blockTypes: string[] = [];
    await processStream(chat.sectionStream, async (msg) => {
      if (!("blocks" in msg)) return;
      for (const b of msg.blocks) {
        blockTypes.push((b as { type: string }).type);
      }
      if (blockTypes.includes("prompt.error") || blockTypes.includes("prompt.block-end") || blockTypes.length > 200) {
        await chat.close();
      }
    });
    expect(blockTypes).toContain("prompt.error");
  });

  it("live-join receives in-flight and remaining blocks", async () => {
    const chat = (await api.openChat({ mode: "chat" })).Ok();

    // Start prompt with stepped fixture — server blocks until we call next()
    const rPrompt = await chat.prompt({
      messages: [{ role: "user", content: [{ type: "text", text: "use stepped fixture" }] }],
    });
    expect(rPrompt.isOk()).toBe(true);

    // Collect blocks on stream1 in background
    const stream1Blocks: { type: string; blockSeq?: number }[] = [];
    const stream1Done = processStream(chat.sectionStream, async (msg) => {
      if (!("blocks" in msg)) return;
      for (const b of msg.blocks) {
        stream1Blocks.push({ type: (b as { type: string }).type, blockSeq: (msg as { blockSeq?: number }).blockSeq });
      }
      if (stream1Blocks.some((b) => b.type === "prompt.block-end")) {
        await chat.close();
      }
    });

    // Release first two SSE chunks — role:assistant + code block content
    // This produces: prompt.block-begin, prompt.req, block.begin, code lines, block.end
    await sleep(10); // let server start processing
    appCtx.fixtureStream.next(); // chunk 1: role:assistant
    await sleep(10);
    appCtx.fixtureStream.next(); // chunk 2: code block content
    await sleep(10);

    // Mid-stream: open second connection on same chatId
    // resendChatSectionsPrevMsg will replay persisted + in-flight blocks
    const rNext = await api.openChat({ chatId: chat.chatId, mode: "chat" });
    expect(rNext.isOk()).toBe(true);
    const secondChat = rNext.Ok();

    // Collect blocks on stream2 in background
    const stream2Blocks: { type: string; blockSeq?: number }[] = [];
    const stream2Done = processStream(secondChat.sectionStream, async (msg) => {
      if (!("blocks" in msg)) return;
      for (const b of msg.blocks) {
        stream2Blocks.push({ type: (b as { type: string }).type, blockSeq: (msg as { blockSeq?: number }).blockSeq });
      }
      if (stream2Blocks.some((b) => b.type === "prompt.block-end")) {
        await secondChat.close();
      }
    });

    // Release remaining chunks (finish_reason:stop, usage, [DONE])
    await sleep(10);
    appCtx.fixtureStream.next(); // chunk 3: finish_reason:stop
    await sleep(10);
    appCtx.fixtureStream.next(); // chunk 4: usage stats
    await sleep(10);
    appCtx.fixtureStream.next(); // chunk 5: [DONE]

    await Promise.all([stream1Done, stream2Done]);

    // Stream 1: complete from start to end
    const s1Types = stream1Blocks.map((b) => b.type);
    expect(s1Types[0]).toBe("prompt.block-begin");
    expect(s1Types).toContain("block.code.begin");
    expect(s1Types).toContain("prompt.block-end");

    // Stream 2: received resent + live blocks, ends with prompt.block-end
    const s2Types = stream2Blocks.map((b) => b.type);
    expect(s2Types.length).toBeGreaterThan(0);
    expect(s2Types).toContain("prompt.block-end");

    // Dedup contract: clients should track max blockSeq per promptId
    // and skip already-seen seqs. Verify blockSeq values are present.
    const s2Seqs = stream2Blocks.filter((b) => b.blockSeq !== undefined).map((b) => b.blockSeq);
    expect(s2Seqs.length).toBeGreaterThan(0);
  });
});
