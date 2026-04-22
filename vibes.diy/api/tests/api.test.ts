import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { BuildURI, loadAsset, processStream, Result, TestFetchPair, TestWSPair, sleep } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import {
  calcEntryPointUrl,
  CFInject,
  cfServe,
  handlePromptContext,
  noopCache,
  VibesApiSQLCtx,
  vibesMsgEvento,
  WSSendProvider,
} from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { BlockEndMsg, BlockMsgs, isBlockStreamMsg } from "@vibes.diy/call-ai-v2";
import {
  isPromptBlockEnd,
  isResEnsureAppSlugOk,
  isResHasAccessInviteAccepted,
  isResHasAccessRequestApproved,
  isResRequestAccessApproved,
  PromptAndBlockMsgs,
  PromptMsgs,
  ReqPromptChatSection,
  ReqWithVerifiedAuth,
  SectionEvent,
} from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { and, eq } from "drizzle-orm/sql/expressions";
import { type } from "arktype";
import type { Model, VibeFile } from "@vibes.diy/api-types";

/** Minimal Model object for test fixtures */
function m(id: string): Model {
  return { id, name: id, description: id };
}

function toByPromptIds(calls: unknown[][]): Record<string, PromptAndBlockMsgs[]> {
  return calls.reduce(
    (acc, call) => {
      const msg = call[0] as SectionEvent;
      if (!acc[msg.promptId]) {
        acc[msg.promptId] = [];
      }
      for (const block of msg.blocks) {
        acc[msg.promptId].push(block);
      }
      return acc;
    },
    {} as Record<string, PromptAndBlockMsgs[]>
  );
}

function emptySectorStream(chatId: string, promptId: string, index: number) {
  return [
    {
      chatId,
      seq: 0,
      streamId: expect.any(String),
      timestamp: expect.any(Date),
      type: "prompt.block-begin",
    },
    {
      chatId,
      seq: 1,
      streamId: expect.any(String),
      timestamp: expect.any(Date),
      request: {
        messages: [{ content: [{ type: "text", text: `Hello world ${index}` }], role: "user" }],
      },
      type: "prompt.req",
    },
    {
      type: "prompt.block-end",
      chatId,
      seq: 2,
      streamId: expect.any(String),
      timestamp: expect.any(Date),
    },
  ];
}

describe("VibesDiyApi", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
  const sthis = ensureSuperThis();

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

  // let svc: Awaited<ReturnType<typeof createHandler>>;
  let api: VibesDiyApi;
  let api2: VibesDiyApi;
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    const testUser = await createTestUser({ sthis, deviceCA });

    const fetchPair = TestFetchPair.create();
    const wsPair = TestWSPair.create();

    fetchPair.server.onServe(async (req: Request) => {
      // console.log("fetchPair.server received request:", req.url, Object.fromEntries(req.headers.entries()));
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
      // console.log("fetchPair.server received request:", req);
      // return
    });

    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);

    appCtx.vibesCtx.connections.add(wsSendProvider);

    wsPair.p2.onmessage = (event: MessageEvent) => {
      // console.log("wsPair.p2 received message", event.data.length);
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
      /* noop */
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

    const testUser2 = await createTestUser({ sthis, deviceCA });
    api2 = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 100000,
      getToken: async () => {
        return Result.Ok(await testUser2.getDashBoardToken());
      },
    });
  });

  it("make it a valid appSlug", async () => {
    const id = sthis.nextId(8).str.toLocaleLowerCase();
    let userSlug: string | undefined;
    for (let i = 0; i < 3; i++) {
      const rRes = await api.ensureAppSlug({
        appSlug: `Invalid App Slug! ${id}`,
        mode: "dev",
        fileSystem: [
          {
            type: "code-block",
            lang: "jsx",
            filename: "/App.jsx",
            content: "console.log('hello world');",
          },
        ],
      });
      const res = rRes.Ok();
      if (!isResEnsureAppSlugOk(res)) {
        assert.fail("Expected invalid appSlug to return a ResEnsureAppSlugOk");
      }
      expect(res.appSlug).toBe(`invalid-app-slug-${id}`);
      if (!userSlug) {
        userSlug = res.userSlug;
      }
      expect(res.userSlug).toBe(userSlug);
    }
  });

  it("coerce invalid userSlugs", async () => {
    const id = sthis.nextId(8).str.toLocaleLowerCase();
    for (let i = 0; i < 3; i++) {
      const rRes = await api.ensureAppSlug({
        appSlug: `valid-app-slug-${id}`,
        userSlug: `Invalid User Slug! ${id}`,
        mode: "dev",
        fileSystem: [
          {
            type: "code-block",
            lang: "jsx",
            filename: "/App.jsx",
            content: "console.log('hello world');",
          },
        ],
      });
      const res = rRes.Ok();
      if (!isResEnsureAppSlugOk(res)) {
        assert.fail("Expected invalid appSlug to return a ResEnsureAppSlugOk");
      }
      expect(res.userSlug).toBe(`invalid-user-slug-${id}`);
    }
  });

  it("does defaults", async () => {
    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: "console.log('hello world');",
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      assert.fail("Expected ensureAppSlug with defaults to return a ResEnsureAppSlugOk");
    }
    expect(res.appSlug.length).toBeGreaterThan(3);
    expect(res.userSlug.length).toBeGreaterThan(3);

    const rRes1 = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: "console.log('hello world');",
        },
      ],
    });
    const res1 = rRes1.Ok();
    if (!isResEnsureAppSlugOk(res1)) {
      assert.fail("Expected ensureAppSlug with defaults to return a ResEnsureAppSlugOk");
    }
    expect(res.fsId).toBe(res1.fsId);
    expect(res.appSlug).not.toBe(res1.appSlug);
    expect(res.userSlug).toBe(res.userSlug);
  });

  it("render iframe content page", async () => {
    // this is the iframe content page
    const rRes = await api.ensureAppSlug({
      mode: "dev",
      env: {
        TEST_ENV_VAR: "testVar",
      },
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `export default function App() { return <div>Hello VibesDiy</div>; } console.log('hello world');`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      assert.fail("Expected ensureAppSlug with defaults to return a ResEnsureAppSlugOk");
    }
    const url = calcEntryPointUrl({
      hostnameBase: ".nowhere",
      protocol: "http",
      port: "4711",
      bindings: {
        appSlug: res.appSlug,
        userSlug: res.userSlug,
        fsId: res.fsId,
      },
    });
    // console.log("render iframe content page res:", url);
    const resIframe = await api.cfg.fetch(url);
    expect(resIframe.status).toBe(200);
    const iframeText = await resIframe.text();
    const imports = [...iframeText.matchAll(/^import \* as V\d+ from "(~~transformed~~\/[^"]*)"/gm)];
    for (const imp of imports || []) {
      const importFile = await api.cfg.fetch(BuildURI.from(url).appendRelative(imp[1]).toString());
      expect(importFile.status).toBe(200);
      const importText = await importFile.text();
      expect(importText).toContain(`console.log('hello world');`);
    }
  });

  it("rejects ensureAppSlug with no code files", async () => {
    const res = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "str-asset-block", content: "body { color: red; }", filename: "/style.css" }],
    });
    expect(res.isErr()).toBe(true);
    expect(res.Err()).toMatchObject({
      code: "app-slug-invalid",
    });
  });

  it("rejects ensureAppSlug with empty fileSystem", async () => {
    const res = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [],
    });
    expect(res.isErr()).toBe(true);
    expect(res.Err()).toMatchObject({
      code: "app-slug-invalid",
    });
  });

  it("repeatable stable ensureAppSlug", async () => {
    const now = Date.now();
    for (let i = 0; i < 2; i++) {
      const res = await api.ensureAppSlug({
        mode: "dev",
        appSlug: "sand-nose-hope",
        userSlug: `immediately-steel-${now}`,
        env: {
          TEST_ENV_VAR: "hello world",
        },
        fileSystem: [
          {
            type: "code-block",
            lang: "jsx",
            filename: "/App.jsx",
            content: [
              "import na from 'find-up';",
              "function App() {",
              "  return <div>Hello VibesDiy</div>;",
              "}",
              "console.log('hello world');",
              "App();",
            ]
              .map((i) => i.trim())
              .join("\n"),
          },
        ],
      });
      // console.log("ensureAppSlug res", res);
      expect(res.Ok()).toEqual({
        appSlug: "sand-nose-hope",
        entryPointUrl: `http://sand-nose-hope--immediately-steel-${now}.localhost.vibesdiy.net:8787/~zGDU8X6kbHpi3Uxf7jMZMhUTad4VbtrmrwuRxtpzXxn7s~`,
        env: {
          TEST_ENV_VAR: "hello world",
        },
        fileSystem: [
          {
            assetId: "zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s",
            assetURI: expect.stringMatching("//Assets/zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s"),
            fileName: "/App.jsx",
            mimeType: "text/javascript",
            size: expect.any(Number),
            transform: {
              type: "jsx-to-js",
              transformedAssetId: "zAVHPsNUCbx2Kz6h4Z59bCx4XWiN9MtqDBRWePf282dcK",
            },
          },
          {
            assetId: "zAVHPsNUCbx2Kz6h4Z59bCx4XWiN9MtqDBRWePf282dcK",
            assetURI: expect.stringMatching("//Assets/zAVHPsNUCbx2Kz6h4Z59bCx4XWiN9MtqDBRWePf282dcK"),
            fileName: "/~~transformed~~/zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s",
            mimeType: "text/javascript",
            size: 276,
            transform: {
              action: "jsx-to-js",
              transformedAssetId: "zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s",
              type: "transformed",
            },
          },
          {
            assetId: "zBKasKKmW2a3imcye1bbJvbZJRFF87V1vTsBZ12MEeUq1",
            assetURI: expect.stringMatching("//Assets/zBKasKKmW2a3imcye1bbJvbZJRFF87V1vTsBZ12MEeUq1"),
            fileName: "/~~calculated~~/import-map.json",
            mimeType: "application/importmap+json",
            size: 153,
            transform: {
              fromAssetIds: ["zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s"],
              type: "import-map",
            },
          },
        ],
        fsId: "zGDU8X6kbHpi3Uxf7jMZMhUTad4VbtrmrwuRxtpzXxn7s",
        mode: "dev",
        type: "vibes.diy.res-ensure-app-slug",
        userSlug: `immediately-steel-${now}`,
        // wrapperUrl: `https://tbd/immediately-steel-${now}/sand-nose-hope/zGDU8X6kbHpi3Uxf7jMZMhUTad4VbtrmrwuRxtpzXxn7s`,
      });
    }
  });

  it("can open chat", async () => {
    // console.log("Testing openChat");
    const rChatRes = await api.openChat({
      mode: "chat",
    });
    // console.log("openChat res", rChatRes);
    expect(rChatRes.isOk()).toBe(true);
    const chat = rChatRes.Ok();
    const resp = vi.fn();
    const promptIds: string[] = [];
    const loops = 3;
    const toWait = processStream(chat.sectionStream, async (msg) => {
      resp(msg);
      // console.log(resp.mock.calls.length)
      if (resp.mock.calls.length >= loops * 3) {
        await rChatRes.Ok().close();
      }

      // if (msg.type === "vibes.diy.section-event" && msg.promptId === promptIds[loops - 1]
      //   && isPromptBlockEnd(msg.blocks[0])) {
      //   console.log("Closing chat stream", msg, resp.mock.calls.map(c => c[0].blocks));
      // }
    });
    // console.log("Chat opened, sending prompts");

    for (let i = 0; i < loops; i++) {
      const rPrompt = await chat.prompt({
        messages: [{ role: "user", content: [{ type: "text", text: `Hello world ${i}` }] }],
      });
      expect(rPrompt.isOk()).toBe(true);
      promptIds.push(rPrompt.Ok().promptId);
    }
    // console.log("Prompts sent, waiting for responses");
    await toWait;
    // console.log("Prompts sent, waited for responses", resp.mock.calls.map(c => c[0].blocks));

    Array.from(Object.entries(toByPromptIds(resp.mock.calls))).forEach(([promptId, blocks], idx) => {
      // console.log("Checking promptId", promptId, "blocks", blocks, idx);
      expect(blocks).toEqual(emptySectorStream(chat.chatId, promptId, idx));
    });

    const rNext = await api.openChat({
      chatId: chat.chatId,
      mode: "chat",
    });
    const nextFn = vi.fn();
    await processStream(rNext.Ok().sectionStream, (msg) => {
      nextFn(msg);
      if (msg.type === "vibes.diy.section-event" && msg.promptId === promptIds[2] && isPromptBlockEnd(msg.blocks[0])) {
        rNext.Ok().close();
      }
    });

    Array.from(Object.entries(toByPromptIds(nextFn.mock.calls))).forEach(([promptId, blocks], idx) => {
      // console.log("Checking promptId", promptId, "blocks", blocks, idx);
      expect(blocks).toEqual(emptySectorStream(chat.chatId, promptId, idx));
    });
  });

  // TODO: consistently times out at 5s waiting for 44 blocks from the fixture
  // stream — broken since aa354215. Needs a rewrite of the block-count
  // expectation to match current LLM fixture output.
  it.skip("queries the llm", async () => {
    const rChatRes = await api.openChat({
      mode: "chat",
    });
    expect(rChatRes.isOk()).toBe(true);
    const chat = rChatRes.Ok();
    console.log("pre-chat.prompt");
    const rPrompt = await chat.prompt({
      messages: [{ role: "user", content: [{ type: "text", text: `use fixture response` }] }],
    });
    expect(rPrompt.isOk()).toBe(true);
    console.log("post-chat.prompt");
    const firstStream = processStream(chat.sectionStream, async () => {
      await sleep(100);
      // console.log("Received message in llm query test", msg);
    });

    const rNext = await api.openChat({
      chatId: chat.chatId,
      mode: "chat",
    });
    // console.log("pre-processStream");
    const nextFn = vi.fn();
    Promise.all([
      firstStream,
      await processStream(rNext.Ok().sectionStream, async (msg) => {
        nextFn(msg);
        const blocks = nextFn.mock.calls.reduce((acc, call) => acc + call[0].blocks.length, 0);
        // console.log("Received message in llm query test", blocks, "blocks so far", msg);
        if (blocks >= 44) {
          await rNext.Ok().close();
        }
        // if (msg.type === "vibes.diy.section-event" && msg.promptId === rPrompt.Ok().promptId && isPromptBlockEnd(msg.blocks[0])) {
        //   rNext.Ok().close();
        // }
      }),
    ]);
    // console.log("LLM query test, received blocks:", nextFn.mock.calls.flatMap((call) => call[0].blocks))
    expect(nextFn.mock.calls.flatMap((call) => call[0].blocks).length).toEqual(44);
  });

  it("promptFS", async () => {
    const rChatRes = await api.openChat({
      mode: "chat",
    });
    expect(rChatRes.isOk()).toBe(true);
    const chat = rChatRes.Ok();
    const rPrompt = await chat.promptFS([
      {
        type: "code-block",
        filename: "/App.jsx",
        lang: "jsx",
        content: `export default function App() { return <div>Hello VibesDiy</div>; } console.log('hello world');`,
      } satisfies VibeFile,
    ]);
    expect(rPrompt.isOk()).toBe(true);

    // Wait for the first stream to complete so blocks are persisted
    await processStream(chat.sectionStream, async (msg) => {
      if ("blocks" in msg && msg.blocks.some((b: { type: string }) => b.type === "prompt.block-end")) {
        await chat.close();
      }
    });

    // Re-open the same chat — replays persisted blocks
    const rNext = await api.openChat({
      chatId: chat.chatId,
      mode: "chat",
    });
    const nextFn = vi.fn();
    await processStream(rNext.Ok().sectionStream, async (msg) => {
      nextFn(msg);
      if ("blocks" in msg && msg.blocks.some((b: { type: string }) => b.type === "prompt.block-end")) {
        await rNext.Ok().close();
      }
    });
    const replayedBlocks = nextFn.mock.calls.filter((c) => "blocks" in c[0]).flatMap((c) => c[0].blocks);
    expect(replayedBlocks.length).toBeGreaterThan(0);
    expect(replayedBlocks[0]).toHaveProperty("type", "prompt.block-begin");
  });

  describe("ensureAppSettings", () => {
    let appSlug: string;
    let userSlug: string;
    beforeAll(async () => {
      const rRes = await api.ensureAppSlug({
        mode: "dev",
        fileSystem: [
          {
            type: "code-block",
            lang: "jsx",
            filename: "/App.jsx",
            content: [
              "import na from 'find-up';",
              "function App() {",
              "  return <div>Hello VibesDiy</div>;",
              "}",
              "console.log('hello world');",
              "App();",
            ]
              .map((i) => i.trim())
              .join("\n"),
          },
        ],
      });
      const res = rRes.Ok();
      if (!isResEnsureAppSlugOk(res)) {
        assert.fail("Expected ensureAppSlug with defaults to return a ResEnsureAppSlugOk");
      }
      appSlug = res.appSlug;
      userSlug = res.userSlug;
    });

    it("ensureAppSettings not found", async () => {
      const res = await api.ensureAppSettings({ appSlug: "non-existent-app", userSlug: "non-existent-user" });
      expect(res.Ok().error).toContain("not-found");
    });

    it("ensureAppSettings found", async () => {
      const res = await api.ensureAppSettings({ appSlug, userSlug });
      expect(res.Ok().error).toBeFalsy();
    });

    it("ensureAppSettings can't update if not owner", async () => {
      // need for parallel test isolation, as the following tests will update the settings
      const rTest = await api.ensureAppSlug({
        mode: "dev",
        fileSystem: [
          {
            type: "code-block",
            lang: "jsx",
            filename: "/App.jsx",
            content: [
              "import na from 'find-up';",
              "function App() {",
              "  return <div>Hello VibesDiy</div>;",
              "}",
              "console.log('hello world');",
              "App();",
            ]
              .map((i) => i.trim())
              .join("\n"),
          },
        ],
      });

      const test = rTest.Ok();
      if (!isResEnsureAppSlugOk(test)) {
        assert.fail("Expected ensureAppSlug with defaults to return a ResEnsureAppSlugOk");
      }
      appSlug = test.appSlug;
      userSlug = test.userSlug;

      const ref = await api.ensureAppSettings({ appSlug, userSlug });
      const res = await api2.ensureAppSettings({
        appSlug,
        userSlug,
        request: {
          enable: true,
          autoAcceptViewRequest: true,
        },
        // aclEntry: { op: "upsert", entry: { type: "app.acl.enable.request", autoAcceptViewRequest: true } },
      });
      expect(res.Ok().settings.entries).toEqual(ref.Ok().settings.entries);
    });

    it("ensureAppSettings update title", async () => {
      const x1 = await api.ensureAppSettings({ appSlug, userSlug, title: "My App" });
      const x2 = await api.ensureAppSettings({ appSlug, userSlug, title: "My App" });
      const x3 = await api.ensureAppSettings({ appSlug, userSlug, title: "My App1" });
      expect(x1.Ok().settings.entries).toEqual(x2.Ok().settings.entries);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "active.title",
            title: "My App1",
          }),
        ])
      );
      expect(x3.Ok().settings.entry.settings.title).toBe("My App1");
    });

    it("ensureAppSettings update chat", async () => {
      const x1 = await api.ensureAppSettings({ appSlug, userSlug, chat: { model: m("x") } });
      const x2 = await api.ensureAppSettings({ appSlug, userSlug, chat: { model: m("x") } });
      const x3 = await api.ensureAppSettings({ appSlug, userSlug, chat: { model: m("x1"), apiKey: "x" } });
      expect(x1.Ok().settings.entries).toEqual(x2.Ok().settings.entries);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            param: {
              apiKey: "x",
              model: m("x1"),
            },
            type: "active.model",
            usage: "chat",
          }),
        ])
      );
      expect(x3.Ok().settings.entry.settings.chat).toEqual({
        model: m("x1"),
        apiKey: "x",
      });
    });

    it("ensureAppSettings update app", async () => {
      const x1 = await api.ensureAppSettings({ appSlug, userSlug, app: { model: m("x") } });
      const x2 = await api.ensureAppSettings({ appSlug, userSlug, app: { model: m("x") } });
      const x3 = await api.ensureAppSettings({ appSlug, userSlug, app: { model: m("x1"), apiKey: "x" } });
      expect(x1.Ok().settings.entries).toEqual(x2.Ok().settings.entries);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            param: {
              apiKey: "x",
              model: m("x1"),
            },
            type: "active.model",
            usage: "app",
          }),
        ])
      );
      expect(x3.Ok().settings.entry.settings.app).toEqual({
        model: m("x1"),
        apiKey: "x",
      });
    });

    it("ensureAppSettings update env", async () => {
      const x1 = await api.ensureAppSettings({ appSlug, userSlug, env: [{ key: "x", value: "x" }] });
      const x2 = await api.ensureAppSettings({ appSlug, userSlug, env: [{ key: "x", value: "x" }] });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        env: [
          { key: "x1", value: "x" },
          { key: "x", value: "y" },
        ],
      });
      expect(x1.Ok().settings.entries).toEqual(x2.Ok().settings.entries);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entry.settings.env).toEqual([
        { key: "x1", value: "x" },
        { key: "x", value: "y" },
      ]);
    });

    it("ensureAppSettings update enable-public-access", async () => {
      const { appSlug, userSlug } = await createApp();
      const x1 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        publicAccess: {
          enable: true,
        },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        publicAccess: {
          enable: false,
        },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        publicAccess: {
          enable: true,
          // tick: { count: 5, last: new Date() },
        },
      });
      expect(x1.Ok().settings.entries.length).toBe(x2.Ok().settings.entries.length);
      expect(x1.Ok().settings.entry.publicAccess?.enable).toEqual(true);
      expect(x2.Ok().settings.entry.publicAccess?.enable).toEqual(false);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entry.publicAccess?.enable).toEqual(true);
      // expect(x3.Ok().settings.entry.publicAccess?.tick?.count).toBeGreaterThan(0);
    });

    it("ensureAppSettings update enable-request", async () => {
      const { appSlug, userSlug } = await createApp();
      const x1 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        request: {
          enable: true,
        },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        request: {
          enable: true,
        },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        request: { enable: true, autoAcceptViewRequest: true },
      });
      expect(x1.Ok().settings.entries).toEqual(x2.Ok().settings.entries);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entry.enableRequest).toBeDefined();
      expect(x3.Ok().settings.entry.enableRequest?.autoAcceptViewRequest).toBe(true);
    });
  });

  describe("handlePromptContext", () => {
    let vctx: VibesApiSQLCtx;
    const req = {
      _auth: {
        verifiedAuth: {
          claims: {
            userId: "testUserId",
          },
        },
      },
      type: "vibes.diy.res-prompt-chat-section",
      mode: "chat",
    } as unknown as ReqWithVerifiedAuth<ReqPromptChatSection>;

    const bp = BlockMsgs.or(PromptMsgs);
    const collectedMsgs: BlockMsgs[] = [];
    beforeAll(async () => {
      vctx = appCtx.vibesCtx;
      // setup vctx and req with necessary properties for testing
      const rJsonl = await loadAsset("./prompt-ctx.fixture.jsonl", {
        basePath: () => import.meta.url,
      });
      for await (const line of (rJsonl.Ok() + "\n").split("\n")) {
        if (line.trim()) {
          const parsed = bp.array()(JSON.parse(line));
          if (parsed instanceof type.errors) {
            console.error("Error parsing line in fixture:", parsed.summary);
          } else {
            collectedMsgs.push(...parsed.filter((i) => isBlockStreamMsg(i)));
          }
        }
      }
    });

    it("processes prompt context correctly", async () => {
      const chatId = `testChatId-${vctx.sthis.nextId(8).str}`;
      const promptId = `testPromptId-${vctx.sthis.nextId(8).str}`;
      const pctx = await handlePromptContext({
        vctx,
        req: {
          ...req,
          chatId,
          userSlug: "example-user",
          appSlug: "example-app",
          promptId,
          outerTid: "outer",
        } as unknown as ReqWithVerifiedAuth<ReqPromptChatSection>,
        resChat: {
          appSlug: "example-app",
          userSlug: "example-user",
          mode: "chat",
        },
        promptId,
        blockSeq: collectedMsgs.length,
        value: collectedMsgs[collectedMsgs.length - 1] as BlockEndMsg,
        collectedMsgs,
      });
      // console.log("handlePromptContext result:", pctx);
      expect(pctx.isOk()).toBe(true);

      const fs = await vctx.sql.db
        .select()
        .from(vctx.sql.tables.apps)
        .where(
          and(
            eq(vctx.sql.tables.apps.appSlug, "example-app"),
            eq(vctx.sql.tables.apps.userSlug, "example-user"),
            eq(vctx.sql.tables.apps.fsId, pctx.Ok().fsRef.Unwrap().fsId)
          )
        )
        .limit(1)
        .then((r) => r[0]);
      // console.log("Database entries for exampleApp/exampleUser:", fs);
      expect(fs).toEqual({
        appSlug: "example-app",
        created: expect.any(String),
        env: {},
        fileSystem: [
          {
            assetId: "z7s2pNqju7dRUpKYPc5AisTkM8TsK4PHp2suH9YzQxXvc",
            assetURI: expect.stringContaining("//Assets/z7s2pNqju7dRUpKYPc5AisTkM8TsK4PHp2suH9YzQxXvc"),
            fileName: "/App.jsx",
            mimeType: "text/javascript",
            size: 5370,
            transform: {
              transformedAssetId: "z9F292JVxJPpjFBsMz9pzP8rc7qTPecWCzYxkBQrnsPMm",
              type: "jsx-to-js",
            },
          },
          {
            assetId: "z9F292JVxJPpjFBsMz9pzP8rc7qTPecWCzYxkBQrnsPMm",
            assetURI: expect.stringContaining("//Assets/z9F292JVxJPpjFBsMz9pzP8rc7qTPecWCzYxkBQrnsPMm"),
            fileName: "/~~transformed~~/z7s2pNqju7dRUpKYPc5AisTkM8TsK4PHp2suH9YzQxXvc",
            mimeType: "text/javascript",
            size: 9405,
            transform: {
              action: "jsx-to-js",
              transformedAssetId: "z7s2pNqju7dRUpKYPc5AisTkM8TsK4PHp2suH9YzQxXvc",
              type: "transformed",
            },
          },
          {
            assetId: "z2prY9cv7dc5XywUH4pxdyRSqtkmrA8S8Av768CRNiFs4",
            assetURI: expect.stringContaining("//Assets/z2prY9cv7dc5XywUH4pxdyRSqtkmrA8S8Av768CRNiFs4"),
            fileName: "/~~calculated~~/import-map.json",
            mimeType: "application/importmap+json",
            size: 153,
            transform: {
              fromAssetIds: ["z7s2pNqju7dRUpKYPc5AisTkM8TsK4PHp2suH9YzQxXvc"],
              type: "import-map",
            },
          },
        ],
        fsId: "zDdC6RKfJgJB9HzK8qKMXGgTSaENJXjXBWUarsrgShUCW",
        meta: [],
        mode: "dev",
        releaseSeq: 1,
        userId: "testUserId",
        userSlug: "example-user",
      });
      expect(pctx.Ok()).toEqual({
        blockSeq: 138,
        fsRef: {
          _t: {
            appSlug: "example-app",
            fsId: "zDdC6RKfJgJB9HzK8qKMXGgTSaENJXjXBWUarsrgShUCW",
            mode: "dev",
            userSlug: "example-user",
          },
        },
      });
    });
  });

  describe("request flow", () => {
    it("owner cannot requestAccess or hasAccessRequest own app", async () => {
      const { appSlug, userSlug } = await createApp();
      await api.ensureAppSettings({ appSlug, userSlug, request: { enable: true } });

      const reqResult = await api.requestAccess({ appSlug, userSlug });
      expect(reqResult.isErr()).toBe(true);
      expect(reqResult.Err().code).toBe("owner-error");

      const hasResult = await api.hasAccessRequest({ appSlug, userSlug });
      expect(hasResult.isErr()).toBe(true);
      expect(hasResult.Err().code).toBe("owner-error");
    });

    it("manual approval lifecycle", async () => {
      const { appSlug, userSlug } = await createApp();

      // enable request access (no auto-approve)
      await api.ensureAppSettings({ appSlug, userSlug, request: { enable: true } });

      // api2 requests access → pending
      const rRequested = await api2.requestAccess({ appSlug, userSlug });
      if (rRequested.isErr()) {
        assert.fail("Expected requestAccess to succeed, got error: " + JSON.stringify(rRequested.Err()));
      }
      const requested = rRequested.Ok();
      expect(requested.state).toBe("pending");
      expect(requested.foreignUserId).toBeTruthy();
      expect((requested.foreignInfo as { claims: { userId: string } }).claims.userId).toBe(requested.foreignUserId);
      const foreignUserId = requested.foreignUserId;

      // api2 checks own access → pending (not yet approved)
      expect((await api2.hasAccessRequest({ appSlug, userSlug })).Ok().state).toBe("pending");

      // owner lists → 1 pending item with foreignInfo.claims containing userId
      const listPending = (await api.listRequestGrants({ appSlug, userSlug, pager: {} })).Ok();
      expect(listPending.items).toHaveLength(1);
      expect(listPending.items[0].state).toBe("pending");
      expect(listPending.items[0].foreignUserId).toBe(foreignUserId);
      expect((listPending.items[0].foreignInfo as { claims: { userId: string } }).claims.userId).toBe(foreignUserId);

      // owner approves
      const approved = (await api.approveRequest({ appSlug, userSlug, foreignUserId, role: "viewer" })).Ok();
      expect(approved.state).toBe("approved");
      expect(approved.role).toBe("viewer");

      // owner lists → approved
      const listApproved = (await api.listRequestGrants({ appSlug, userSlug, pager: {} })).Ok();
      expect(listApproved.items[0].state).toBe("approved");

      // api2 checks own access → approved with role
      const access = (await api2.hasAccessRequest({ appSlug, userSlug })).Ok();
      if (!isResHasAccessRequestApproved(access)) {
        assert.fail("Expected hasAccessRequest to be approved, got: " + JSON.stringify(access));
      }
      expect(access.state).toBe("approved");
      expect(access.role).toBe("viewer");

      // owner revokes (no delete) → revoked
      expect((await api.revokeRequest({ appSlug, userSlug, foreignUserId })).Ok().deleted).toBe(false);
      expect((await api.listRequestGrants({ appSlug, userSlug, pager: {} })).Ok().items[0].state).toBe("revoked");
      expect((await api2.hasAccessRequest({ appSlug, userSlug })).Ok().state).toBe("revoked");

      // owner revokes with delete → gone
      expect((await api.revokeRequest({ appSlug, userSlug, foreignUserId, delete: true })).Ok().deleted).toBe(true);
      expect((await api.listRequestGrants({ appSlug, userSlug, pager: {} })).Ok().items).toEqual([]);
    });

    it("auto-approve lifecycle with role update", async () => {
      const { appSlug, userSlug } = await createApp();

      // enable request access with auto-approve
      await api.ensureAppSettings({ appSlug, userSlug, request: { enable: true, autoAcceptViewRequest: true } });

      // api2 checks before requesting → not-found (request is possible)
      expect((await api2.hasAccessRequest({ appSlug, userSlug })).Ok().state).toBe("not-found");

      // api2 requests access → auto-approved as viewer
      const requested = (await api2.requestAccess({ appSlug, userSlug })).Ok();
      if (!isResRequestAccessApproved(requested)) {
        assert.fail("Expected requestAccess to be auto-approved, got: " + JSON.stringify(requested));
      }
      expect(requested.state).toBe("approved");
      expect(requested.role).toBe("viewer");
      const foreignUserId = requested.foreignUserId;

      // owner lists → approved
      const listApproved = (await api.listRequestGrants({ appSlug, userSlug, pager: {} })).Ok();
      expect(listApproved.items).toHaveLength(1);
      expect(listApproved.items[0].state).toBe("approved");
      expect(listApproved.items[0].role).toBe("viewer");

      // api2 checks own access → approved
      const access = (await api2.hasAccessRequest({ appSlug, userSlug })).Ok();
      if (!isResHasAccessRequestApproved(access)) {
        assert.fail("Expected hasAccessRequest to be approved, got: " + JSON.stringify(access));
      }
      expect(access.state).toBe("approved");
      expect(access.role).toBe("viewer");

      // owner updates role to editor
      const roleUpdated = (await api.requestSetRole({ appSlug, userSlug, foreignUserId, role: "editor" })).Ok();
      expect(roleUpdated.role).toBe("editor");

      // owner lists → role is editor
      const listEditor = (await api.listRequestGrants({ appSlug, userSlug, pager: {} })).Ok();
      expect(listEditor.items[0].role).toBe("editor");
    });

    it("drains pending queue when auto-accept is enabled", async () => {
      const { appSlug, userSlug } = await createApp();

      await api.ensureAppSettings({ appSlug, userSlug, request: { enable: true } });

      const pending = (await api2.requestAccess({ appSlug, userSlug })).Ok();
      expect(pending.state).toBe("pending");

      const before = (await api.listRequestGrants({ appSlug, userSlug, pager: {} })).Ok();
      expect(before.items).toHaveLength(1);
      expect(before.items[0].state).toBe("pending");

      await api.ensureAppSettings({
        appSlug,
        userSlug,
        request: { enable: true, autoAcceptViewRequest: true },
      });

      const after = (await api.listRequestGrants({ appSlug, userSlug, pager: {} })).Ok();
      expect(after.items).toHaveLength(1);
      expect(after.items[0].state).toBe("approved");
      expect(after.items[0].role).toBe("viewer");

      const access = (await api2.hasAccessRequest({ appSlug, userSlug })).Ok();
      if (!isResHasAccessRequestApproved(access)) {
        assert.fail("Expected hasAccessRequest to be approved, got: " + JSON.stringify(access));
      }
      expect(access.state).toBe("approved");
      expect(access.role).toBe("viewer");
    });

    it("does not re-approve revoked requests when auto-accept is enabled", async () => {
      const { appSlug, userSlug } = await createApp();

      await api.ensureAppSettings({ appSlug, userSlug, request: { enable: true } });

      const requested = (await api2.requestAccess({ appSlug, userSlug })).Ok();
      const foreignUserId = requested.foreignUserId;

      await api.approveRequest({ appSlug, userSlug, foreignUserId, role: "viewer" });
      await api.revokeRequest({ appSlug, userSlug, foreignUserId });

      await api.ensureAppSettings({
        appSlug,
        userSlug,
        request: { enable: true, autoAcceptViewRequest: true },
      });

      const after = (await api.listRequestGrants({ appSlug, userSlug, pager: {} })).Ok();
      expect(after.items).toHaveLength(1);
      expect(after.items[0].state).toBe("revoked");
    });
  });

  describe("invite flow", () => {
    it("full invite lifecycle", async () => {
      const now = sthis.nextId(8).str;
      const appSlug = `test-app-invite-${now}`;
      const userSlug = `test-user-invite-${now}`;
      const invitedEmail = `Test.User+alias@Gmail.com`;
      const canonicalEmail = `testuser@gmail.com`;

      // list is empty
      const rListEmpty = await api.listInviteGrants({ appSlug, userSlug, pager: {} });
      if (rListEmpty.isErr()) {
        assert.fail("Expected listInviteGrants to succeed, got error: " + JSON.stringify(rListEmpty.Err()));
      }
      expect(rListEmpty.Ok().items).toEqual([]);

      // revoke on non-existent → deleted:false
      expect((await api.revokeInvite({ appSlug, userSlug, emailKey: canonicalEmail })).Ok().deleted).toBe(false);

      // create invite
      const created = (await api.createInvite({ appSlug, userSlug, invitedEmail, role: "viewer" })).Ok();
      expect(created.emailKey).toBe(canonicalEmail);
      expect(created.state).toBe("pending");
      expect(created.role).toBe("viewer");
      expect(created.tokenOrGrantUserId).toBeTruthy();
      expect(created.foreignInfo).toEqual({ givenEmail: invitedEmail });
      const token = created.tokenOrGrantUserId;

      // list shows pending with token
      const listPending = (await api.listInviteGrants({ appSlug, userSlug, pager: {} })).Ok();
      expect(listPending.items).toHaveLength(1);
      expect(listPending.items[0].state).toBe("pending");
      expect(listPending.items[0].tokenOrGrantUserId).toBe(token);

      // hasAccess before redeem → not-found
      expect((await api2.hasAccessInvite({ appSlug, userSlug })).Ok().state).toBe("not-found");

      // set role to editor
      expect((await api.inviteSetRole({ appSlug, userSlug, emailKey: canonicalEmail, role: "editor" })).Ok().role).toBe("editor");

      // owner cannot redeem own invite
      expect((await api.redeemInvite({ token })).isErr()).toBe(true);

      // other user redeems
      const redeemed = (await api2.redeemInvite({ token })).Ok();
      expect(redeemed.state).toBe("accepted");
      expect(redeemed.role).toBe("editor");
      expect(redeemed.appSlug).toBe(appSlug);
      expect(redeemed.userSlug).toBe(userSlug);

      // list shows accepted with redeemer userId and claims
      const listAccepted = (await api.listInviteGrants({ appSlug, userSlug, pager: {} })).Ok();
      expect(listAccepted.items).toHaveLength(1);
      expect(listAccepted.items[0].state).toBe("accepted");
      expect(listAccepted.items[0].tokenOrGrantUserId).not.toBe(token);
      expect((listAccepted.items[0].foreignInfo as { claims: unknown }).claims).toBeTruthy();

      // hasAccess → accepted with role
      const access = (await api2.hasAccessInvite({ appSlug, userSlug })).Ok();
      if (!isResHasAccessInviteAccepted(access)) {
        assert.fail("Expected hasAccessRequest to be approved, got: " + JSON.stringify(access));
      }
      expect(access.state).toBe("accepted");
      expect(access.role).toBe("editor");

      // revoke (state → revoked, no delete)
      expect((await api.revokeInvite({ appSlug, userSlug, emailKey: canonicalEmail })).Ok().deleted).toBe(false);
      expect((await api.listInviteGrants({ appSlug, userSlug, pager: {} })).Ok().items[0].state).toBe("revoked");
      expect((await api2.hasAccessInvite({ appSlug, userSlug })).Ok().state).toBe("revoked");

      // revoke with delete
      expect((await api.revokeInvite({ appSlug, userSlug, emailKey: canonicalEmail, delete: true })).Ok().deleted).toBe(true);
      expect((await api.listInviteGrants({ appSlug, userSlug, pager: {} })).Ok().items).toEqual([]);
      expect((await api2.hasAccessInvite({ appSlug, userSlug })).Ok().state).toBe("not-found");
    });
  });
});
