import { VibesDiyApi } from "@vibes.diy/api-impl";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { BuildURI, consumeStream, loadAsset, Result, TestFetchPair, TestWSPair } from "@adviser/cement";
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
import { BlockEndMsg, BlockMsgs, isBlockStreamMsg, isPromptBlockEnd, PromptMsgs } from "@vibes.diy/call-ai-v2";
import { PromptAndBlockMsgs, ReqPromptChatSection, SectionEvent } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.ts";
import { ReqWithVerifiedAuth } from "@vibes.diy/api-svc/check-auth.ts";
import { sqlApps } from "@vibes.diy/api-svc/sql/vibes-diy-api-schema.ts";
import { and, eq } from "drizzle-orm";
import { type } from "arktype";

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

describe("VibesDiyApi", () => {
  const sthis = ensureSuperThis();

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
          drizzle: appCtx.vibesCtx.db,
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

    // cfServe(
    //   new Request("http://example.com/api", {
    //     headers: { Upgrade: "websocket" },
    //   }) as unknown as CFRequest,
    //   {
    //     appCtx: appCtx.appCtx,
    //     cache: noopCache,
    //     drizzle: drizzleDB,
    //     wsResponse: new Response(null, { status: 200 }),
    //     llmRequest: async (prompt: LLMRequest) => {
    //       console.log("Received LLM request in test llmRequest handler with messages:", prompt.messages);
    //       if (prompt.messages[0]?.content?.some((c) => c.type === "text" && c.text.includes("use fixture response"))) {
    //         const fixture = await loadAsset("./fixture.llm", { basePath: () => sthis.pathOps.dirname(import.meta.url) });
    //         return new Response(fixture.Ok(), { status: 200 });
    //       }
    //       return new Response("", { status: 200 });
    //     },
    //     webSocket: {
    //       connections: new Set<WSSendProvider>(),
    //       webSocketPair: () => ({
    //         client: wsPair.p1,
    //         server: wsPair.p2,
    //       }),
    //     },
    //   } as unknown as ExecutionContext & CFInject
    // );

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

  it("does defaults", async () => {
    const res = await api.ensureAppSlug({
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
    expect(res.Ok().appSlug.length).toBeGreaterThan(3);
    expect(res.Ok().userSlug.length).toBeGreaterThan(3);

    const res1 = await api.ensureAppSlug({
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
    expect(res.Ok().fsId).toBe(res1.Ok().fsId);
    expect(res.Ok().appSlug).not.toBe(res1.Ok().appSlug);
    expect(res.Ok().userSlug).not.toBe(res1.Ok().userSlug);
  });

  it("render iframe content page", async () => {
    // this is the iframe content page
    const res = await api.ensureAppSlug({
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
    const url = calcEntryPointUrl({
      hostnameBase: ".nowhere",
      protocol: "http",
      port: "4711",
      bindings: {
        appSlug: res.Ok().appSlug,
        userSlug: res.Ok().userSlug,
        fsId: res.Ok().fsId,
      },
    });
    // console.log("render iframe content page res:", res);
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
            assetURI: "sqlite://Assets/zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s",
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
            assetURI: "sqlite://Assets/zAVHPsNUCbx2Kz6h4Z59bCx4XWiN9MtqDBRWePf282dcK",
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
            assetURI: "sqlite://Assets/zBKasKKmW2a3imcye1bbJvbZJRFF87V1vTsBZ12MEeUq1",
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
      mode: "creation",
    });
    // console.log("openChat res", rChatRes);
    expect(rChatRes.isOk()).toBe(true);
    const chat = rChatRes.Ok();
    const resp = vi.fn();
    const toWait = consumeStream(chat.sectionStream, (msg) => {
      resp(msg);
      if (msg.type === "vibes.diy.section-event" && msg.promptId === promptIds[2] && isPromptBlockEnd(msg.blocks[0])) {
        rChatRes.Ok().close();
      }
    });
    // console.log("Chat opened, sending prompts");

    const promptIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const rPrompt = await chat.prompt({
        messages: [{ role: "user", content: [{ type: "text", text: `Hello world ${i}` }] }],
      });
      expect(rPrompt.isOk()).toBe(true);
      promptIds.push(rPrompt.Ok().promptId);
    }
    // console.log("Prompts sent, waiting for responses");
    await toWait;
    // console.log("Prompts sent, waited for responses");

    Array.from(Object.entries(toByPromptIds(resp.mock.calls))).forEach(([promptId, blocks], idx) => {
      expect(blocks).toEqual(emptySectorStream(chat.chatId, promptId, idx));
    });

    const rNext = await api.openChat({
      chatId: chat.chatId,
      mode: "creation",
    });
    const nextFn = vi.fn();
    await consumeStream(rNext.Ok().sectionStream, (msg) => {
      nextFn(msg);
      if (msg.type === "vibes.diy.section-event" && msg.promptId === promptIds[2] && isPromptBlockEnd(msg.blocks[0])) {
        rNext.Ok().close();
      }
    });

    Array.from(Object.entries(toByPromptIds(nextFn.mock.calls))).forEach(([promptId, blocks], idx) => {
      expect(blocks).toEqual(emptySectorStream(chat.chatId, promptId, idx));
    });
  });

  it("queries the llm", async () => {
    const rChatRes = await api.openChat({
      mode: "creation",
    });
    expect(rChatRes.isOk()).toBe(true);
    const chat = rChatRes.Ok();
    const rPrompt = await chat.prompt({
      messages: [{ role: "user", content: [{ type: "text", text: `use fixture response` }] }],
    });
    expect(rPrompt.isOk()).toBe(true);

    const rNext = await api.openChat({
      chatId: chat.chatId,
      mode: "creation",
    });
    const nextFn = vi.fn();
    await consumeStream(rNext.Ok().sectionStream, (msg) => {
      nextFn(msg);
      if (msg.type === "vibes.diy.section-event" && msg.promptId === rPrompt.Ok().promptId && isPromptBlockEnd(msg.blocks[0])) {
        rNext.Ok().close();
      }
    });
    expect(nextFn.mock.calls.flatMap((call) => call[0].blocks).length).toEqual(44);
  });

  describe("ensureAppSettings", () => {
    let appSlug: string;
    let userSlug: string;
    beforeAll(async () => {
      const res = await api.ensureAppSlug({
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
      appSlug = res.Ok().appSlug;
      userSlug = res.Ok().userSlug;
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
      const test = await api.ensureAppSlug({
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
      appSlug = test.Ok().appSlug;
      userSlug = test.Ok().userSlug;

      const ref = await api.ensureAppSettings({ appSlug, userSlug });
      const res = await api2.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: { op: "upsert", entry: { type: "app.acl.enable.request", autoAcceptViewRequest: true } },
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
      const x1 = await api.ensureAppSettings({ appSlug, userSlug, chat: { model: "x" } });
      const x2 = await api.ensureAppSettings({ appSlug, userSlug, chat: { model: "x" } });
      const x3 = await api.ensureAppSettings({ appSlug, userSlug, chat: { model: "x1", apiKey: "x" } });
      expect(x1.Ok().settings.entries).toEqual(x2.Ok().settings.entries);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            param: {
              apiKey: "x",
              model: "x1",
            },
            type: "active.model",
            usage: "chat",
          }),
        ])
      );
      expect(x3.Ok().settings.entry.settings.chat).toEqual({
        model: "x1",
        apiKey: "x",
      });
    });

    it("ensureAppSettings update app", async () => {
      const x1 = await api.ensureAppSettings({ appSlug, userSlug, app: { model: "x" } });
      const x2 = await api.ensureAppSettings({ appSlug, userSlug, app: { model: "x" } });
      const x3 = await api.ensureAppSettings({ appSlug, userSlug, app: { model: "x1", apiKey: "x" } });
      expect(x1.Ok().settings.entries).toEqual(x2.Ok().settings.entries);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            param: {
              apiKey: "x",
              model: "x1",
            },
            type: "active.model",
            usage: "app",
          }),
        ])
      );
      expect(x3.Ok().settings.entry.settings.app).toEqual({
        model: "x1",
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
      const x1 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: { op: "upsert", entry: { type: "app.acl.enable.public.access" } },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: { op: "upsert", entry: { type: "app.acl.enable.public.access" } },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: { op: "upsert", entry: { type: "app.acl.enable.public.access", tick: { count: 5, last: new Date() } } },
      });
      expect(x1.Ok().settings.entries).toEqual(x2.Ok().settings.entries);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entry.publicAccess).toBeDefined();
      expect(x3.Ok().settings.entry.publicAccess?.tick?.count).toBeGreaterThan(0);
    });

    it("ensureAppSettings update enable-request", async () => {
      const x1 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: { op: "upsert", entry: { type: "app.acl.enable.request" } },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: { op: "upsert", entry: { type: "app.acl.enable.request" } },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: { op: "upsert", entry: { type: "app.acl.enable.request", autoAcceptViewRequest: true } },
      });
      expect(x1.Ok().settings.entries).toEqual(x2.Ok().settings.entries);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entry.enableRequest).toBeDefined();
      expect(x3.Ok().settings.entry.enableRequest?.autoAcceptViewRequest).toBe(true);
    });

    it("ensureAppSettings acl invite editor pending", async () => {
      const x1 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.invite",
            role: "editor",
            state: "pending",
            invite: { email: "ed-pending@example.com", created: new Date() },
            token: "placeholder",
          },
        },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.invite",
            role: "editor",
            state: "pending",
            invite: { email: "ed-pending@example.com", created: new Date() },
            token: "placeholder",
          },
        },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.invite",
            role: "editor",
            state: "accepted",
            invite: { email: "ed-pending@example.com", created: new Date() },
            grant: { ownerId: "owner-1", on: new Date() },
            tick: { count: 1, last: new Date() },
          },
        },
      });
      expect(x1.Ok().settings.entries.length).toBe(x2.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entry.invite.editors.accepted.find((e) => e.invite.email === "ed-pending@example.com")).toBeDefined();
    });

    it("ensureAppSettings acl invite viewer pending", async () => {
      const x1 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.invite",
            role: "viewer",
            state: "pending",
            invite: { email: "vw-pending@example.com", created: new Date() },
            token: "placeholder",
          },
        },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.invite",
            role: "viewer",
            state: "pending",
            invite: { email: "vw-pending@example.com", created: new Date() },
            token: "placeholder",
          },
        },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.invite",
            role: "viewer",
            state: "accepted",
            invite: { email: "vw-pending@example.com", created: new Date() },
            grant: { ownerId: "owner-2", on: new Date() },
            tick: { count: 1, last: new Date() },
          },
        },
      });
      expect(x1.Ok().settings.entries.length).toBe(x2.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entry.invite.viewers.accepted.find((e) => e.invite.email === "vw-pending@example.com")).toBeDefined();
    });

    it("ensureAppSettings acl invite editor accepted", async () => {
      const x1 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.invite",
            role: "editor",
            state: "accepted",
            invite: { email: "ed-accepted@example.com", created: new Date() },
            grant: { ownerId: "owner-3", on: new Date() },
            tick: { count: 1, last: new Date() },
          },
        },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.invite",
            role: "editor",
            state: "accepted",
            invite: { email: "ed-accepted@example.com", created: new Date() },
            grant: { ownerId: "owner-3", on: new Date() },
            tick: { count: 1, last: new Date() },
          },
        },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.invite",
            role: "editor",
            state: "accepted",
            invite: { email: "ed-accepted@example.com", created: new Date() },
            grant: { ownerId: "owner-3", on: new Date() },
            tick: { count: 2, last: new Date() },
          },
        },
      });
      expect(x1.Ok().settings.entries.length).toBe(x2.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      const entry = x3.Ok().settings.entry.invite.editors.accepted.find((e) => e.invite.email === "ed-accepted@example.com");
      expect(entry).toBeDefined();
      expect(entry?.tick.count).toBeGreaterThan(1);
    });

    it("ensureAppSettings acl invite viewer accepted", async () => {
      const x1 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.invite",
            role: "viewer",
            state: "accepted",
            invite: { email: "vw-accepted@example.com", created: new Date() },
            grant: { ownerId: "owner-4", on: new Date() },
            tick: { count: 1, last: new Date() },
          },
        },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.invite",
            role: "viewer",
            state: "accepted",
            invite: { email: "vw-accepted@example.com", created: new Date() },
            grant: { ownerId: "owner-4", on: new Date() },
            tick: { count: 1, last: new Date() },
          },
        },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.invite",
            role: "viewer",
            state: "accepted",
            invite: { email: "vw-accepted@example.com", created: new Date() },
            grant: { ownerId: "owner-4", on: new Date() },
            tick: { count: 2, last: new Date() },
          },
        },
      });
      expect(x1.Ok().settings.entries.length).toBe(x2.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      const entry = x3.Ok().settings.entry.invite.viewers.accepted.find((e) => e.invite.email === "vw-accepted@example.com");
      expect(entry).toBeDefined();
      expect(entry?.tick.count).toBeGreaterThan(1);
    });

    it("ensureAppSettings acl invite editor revoked", async () => {
      const x1 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.invite",
            role: "editor",
            state: "accepted",
            invite: { email: "ed-revoked@example.com", created: new Date() },
            grant: { ownerId: "owner-5", on: new Date() },
            tick: { count: 1, last: new Date() },
          },
        },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.invite",
            role: "editor",
            state: "accepted",
            invite: { email: "ed-revoked@example.com", created: new Date() },
            grant: { ownerId: "owner-5", on: new Date() },
            tick: { count: 1, last: new Date() },
          },
        },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.invite",
            role: "editor",
            state: "revoked",
            invite: { email: "ed-revoked@example.com", created: new Date() },
            grant: { ownerId: "owner-5", on: new Date() },
            tick: { count: 1, last: new Date() },
          },
        },
      });
      expect(x1.Ok().settings.entries.length).toBe(x2.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entry.invite.editors.revoked.find((e) => e.invite.email === "ed-revoked@example.com")).toBeDefined();
    });

    it("ensureAppSettings acl invite viewer revoked", async () => {
      const x1 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.invite",
            role: "viewer",
            state: "accepted",
            invite: { email: "vw-revoked@example.com", created: new Date() },
            grant: { ownerId: "owner-6", on: new Date() },
            tick: { count: 1, last: new Date() },
          },
        },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.invite",
            role: "viewer",
            state: "accepted",
            invite: { email: "vw-revoked@example.com", created: new Date() },
            grant: { ownerId: "owner-6", on: new Date() },
            tick: { count: 1, last: new Date() },
          },
        },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.invite",
            role: "viewer",
            state: "revoked",
            invite: { email: "vw-revoked@example.com", created: new Date() },
            grant: { ownerId: "owner-6", on: new Date() },
            tick: { count: 1, last: new Date() },
          },
        },
      });
      expect(x1.Ok().settings.entries.length).toBe(x2.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entry.invite.viewers.revoked.find((e) => e.invite.email === "vw-revoked@example.com")).toBeDefined();
    });

    it("ensureAppSettings acl request viewer pending", async () => {
      const x1 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.request",
            role: "viewer",
            state: "pending",
            request: { key: "req-vw-pending@example.com", provider: "google", userId: "uid-001", created: new Date() },
          },
        },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.request",
            role: "viewer",
            state: "pending",
            request: { key: "req-vw-pending@example.com", provider: "google", userId: "uid-001", created: new Date() },
          },
        },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.request",
            role: "viewer",
            state: "approved",
            request: { key: "req-vw-pending@example.com", provider: "google", userId: "uid-001", created: new Date() },
            grant: { ownerId: "owner-7", on: new Date() },
            tick: { count: 1, last: new Date() },
          },
        },
      });
      expect(x1.Ok().settings.entries.length).toBe(x2.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entry.request.approved.find((e) => e.request.key === "req-vw-pending@example.com")).toBeDefined();
    });

    it("ensureAppSettings acl request viewer approved", async () => {
      const x1 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.request",
            role: "viewer",
            state: "approved",
            request: { key: "req-vw-approved@example.com", provider: "github", userId: "uid-002", created: new Date() },
            grant: { ownerId: "owner-8", on: new Date() },
            tick: { count: 1, last: new Date() },
          },
        },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.request",
            role: "viewer",
            state: "approved",
            request: { key: "req-vw-approved@example.com", provider: "github", userId: "uid-002", created: new Date() },
            grant: { ownerId: "owner-8", on: new Date() },
            tick: { count: 1, last: new Date() },
          },
        },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.request",
            role: "viewer",
            state: "approved",
            request: { key: "req-vw-approved@example.com", provider: "github", userId: "uid-002", created: new Date() },
            grant: { ownerId: "owner-8", on: new Date() },
            tick: { count: 2, last: new Date() },
          },
        },
      });
      expect(x1.Ok().settings.entries.length).toBe(x2.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      const entry = x3.Ok().settings.entry.request.approved.find((e) => e.request.key === "req-vw-approved@example.com");
      expect(entry).toBeDefined();
      expect(entry?.tick.count).toBeGreaterThan(1);
    });

    it("ensureAppSettings acl request viewer rejected", async () => {
      const x1 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.request",
            role: "viewer",
            state: "pending",
            request: { key: "req-vw-rejected@example.com", provider: "clerk", userId: "uid-003", created: new Date() },
          },
        },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.request",
            role: "viewer",
            state: "pending",
            request: { key: "req-vw-rejected@example.com", provider: "clerk", userId: "uid-003", created: new Date() },
          },
        },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.request",
            role: "viewer",
            state: "rejected",
            request: { key: "req-vw-rejected@example.com", provider: "clerk", userId: "uid-003", created: new Date() },
            grant: { ownerId: "owner-9", on: new Date() },
          },
        },
      });
      expect(x1.Ok().settings.entries.length).toBe(x2.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entry.request.rejected.find((e) => e.request.key === "req-vw-rejected@example.com")).toBeDefined();
    });

    it("ensureAppSettings acl request editor approved", async () => {
      const x1 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.request",
            role: "viewer",
            state: "pending",
            request: { key: "req-ed-approved@example.com", provider: "google", userId: "uid-004", created: new Date() },
          },
        },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.request",
            role: "viewer",
            state: "pending",
            request: { key: "req-ed-approved@example.com", provider: "google", userId: "uid-004", created: new Date() },
          },
        },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.request",
            role: "editor",
            state: "approved",
            request: { key: "req-ed-approved@example.com", provider: "google", userId: "uid-004", created: new Date() },
            grant: { ownerId: "owner-10", on: new Date() },
            tick: { count: 1, last: new Date() },
          },
        },
      });
      expect(x1.Ok().settings.entries.length).toBe(x2.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      const entry = x3.Ok().settings.entry.request.approved.find((e) => e.request.key === "req-ed-approved@example.com");
      expect(entry).toBeDefined();
      expect(entry?.role).toBe("editor");
    });

    it("ensureAppSettings acl request editor rejected", async () => {
      const x1 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.request",
            role: "viewer",
            state: "pending",
            request: { key: "req-ed-rejected@example.com", provider: "github", userId: "uid-005", created: new Date() },
          },
        },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.request",
            role: "viewer",
            state: "pending",
            request: { key: "req-ed-rejected@example.com", provider: "github", userId: "uid-005", created: new Date() },
          },
        },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.request",
            role: "editor",
            state: "rejected",
            request: { key: "req-ed-rejected@example.com", provider: "github", userId: "uid-005", created: new Date() },
            grant: { ownerId: "owner-11", on: new Date() },
          },
        },
      });
      expect(x1.Ok().settings.entries.length).toBe(x2.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      const entry = x3.Ok().settings.entry.request.rejected.find((e) => e.request.key === "req-ed-rejected@example.com");
      expect(entry).toBeDefined();
      expect(entry?.role).toBe("editor");
    });

    it("ensureAppSettings acl request approved back to pending", async () => {
      const x1 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.request",
            role: "viewer",
            state: "approved",
            request: { key: "req-re-pending@example.com", provider: "clerk", userId: "uid-006", created: new Date() },
            grant: { ownerId: "owner-12", on: new Date() },
            tick: { count: 1, last: new Date() },
          },
        },
      });
      const x2 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.request",
            role: "viewer",
            state: "approved",
            request: { key: "req-re-pending@example.com", provider: "clerk", userId: "uid-006", created: new Date() },
            grant: { ownerId: "owner-12", on: new Date() },
            tick: { count: 1, last: new Date() },
          },
        },
      });
      const x3 = await api.ensureAppSettings({
        appSlug,
        userSlug,
        aclEntry: {
          op: "upsert",
          entry: {
            type: "app.acl.active.request",
            role: "viewer",
            state: "pending",
            request: { key: "req-re-pending@example.com", provider: "clerk", userId: "uid-006", created: new Date() },
          },
        },
      });
      expect(x1.Ok().settings.entries.length).toBe(x2.Ok().settings.entries.length);
      expect(x3.Ok().settings.entries.length).toBe(x1.Ok().settings.entries.length);
      expect(x3.Ok().settings.entry.request.pending.find((e) => e.request.key === "req-re-pending@example.com")).toBeDefined();
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
      mode: "creation",
    } as unknown as ReqWithVerifiedAuth<ReqPromptChatSection>;

    const bp = BlockMsgs.or(PromptMsgs);
    const collectedMsgs: BlockMsgs[] = [];
    beforeAll(async () => {
      vctx = appCtx.vibesCtx;
      // setup vctx and req with necessary properties for testing
      const rJsonl = await loadAsset("./prompt-ctx.fixture.jsonl", {
        basePath: () => import.meta.url,
      });
      for await (const line of rJsonl.Ok().split("\n")) {
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
          userSlug: "exampleUser",
          appSlug: "exampleApp",
          promptId,
          outerTid: "outer",
        } as unknown as ReqWithVerifiedAuth<ReqPromptChatSection>,
        resChat: {
          appSlug: "exampleApp",
          userSlug: "exampleUser",
          mode: "creation",
        },
        promptId,
        blockSeq: collectedMsgs.length,
        value: collectedMsgs[collectedMsgs.length - 1] as BlockEndMsg,
        collectedMsgs,
      });
      // console.log("handlePromptContext result:", x.Err());
      expect(pctx.isOk()).toBe(true);

      const fs = await vctx.db
        .select()
        .from(sqlApps)
        .where(
          and(
            eq(sqlApps.appSlug, "exampleApp"),
            eq(sqlApps.userSlug, "exampleUser"),
            eq(sqlApps.fsId, pctx.Ok().fsRef.Unwrap().fsId)
          )
        )
        .get();
      // console.log("Database entries for exampleApp/exampleUser:", fs);
      expect(fs).toEqual({
        appSlug: "exampleApp",
        created: expect.any(String),
        env: {},
        fileSystem: [
          {
            assetId: "z7s2pNqju7dRUpKYPc5AisTkM8TsK4PHp2suH9YzQxXvc",
            assetURI: "sqlite://Assets/z7s2pNqju7dRUpKYPc5AisTkM8TsK4PHp2suH9YzQxXvc",
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
            assetURI: "sqlite://Assets/z9F292JVxJPpjFBsMz9pzP8rc7qTPecWCzYxkBQrnsPMm",
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
            assetURI: "sqlite://Assets/z2prY9cv7dc5XywUH4pxdyRSqtkmrA8S8Av768CRNiFs4",
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
        userSlug: "exampleUser",
      });
      expect(pctx.Ok()).toEqual({
        blockSeq: 138,
        fsRef: {
          _t: {
            appSlug: "exampleApp",
            fsId: "zDdC6RKfJgJB9HzK8qKMXGgTSaENJXjXBWUarsrgShUCW",
            mode: "dev",
            userSlug: "exampleUser",
          },
        },
      });
    });
  });
});
