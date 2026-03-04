import { VibeDiyApi } from "@vibes.diy/api-impl";
import { createClient } from "@libsql/client/node";
import { beforeAll, describe, expect, inject, it, vi } from "vitest";
import { BuildURI, consumeStream, loadAsset, Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis, sts } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { calcEntryPointUrl, CFInject, cfServe, createAppContext, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/libsql";
import { isPromptBlockEnd, LLMRequest } from "@vibes.diy/call-ai-v2";
import { FetchResult, MsgBase, PromptAndBlockMsgs, S3Api, SectionEvent } from "@vibes.diy/api-types";

const noopCache = {
  put: async (_req: Request, _res: Response) => {
    /* noop */
  },
  delete: async (_req: Request) => {
    return false;
  },
  match: async () => {
    return undefined;
  },
};

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
  const url = inject("VIBES_DIY_TEST_SQL_URL" as never) as string;
  const client = createClient({ url });
  const drizzleDB = drizzle(client);

  // let svc: Awaited<ReturnType<typeof createHandler>>;
  let api: VibeDiyApi;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);

    const testUser = await createTestUser({ sthis, deviceCA });

    const env = {
      CLOUD_SESSION_TOKEN_PUBLIC:
        "zeWndr5LEoaySgKSo2aZniYqZ3z6Ecx3Z6qFThtXC8aMEAx6oDFMKgm3SptRgHhN4UxFSvTnmU5HXNrF6cZ4dBz6Ddphq8hsxzUKbryaBu5AFnbNyHrZEod2uw2q2UnPgeEdTDszU1AzSn7iiEfSv4NZ17ENVx7WfRAY8J8F1aog8",
      CLERK_PUBLISHABLE_KEY: "pk_test_cHJlY2lzZS1jb2x0LTQ5LmNsZXJrLmFjY291bnRzLmRldiQ",
      DEVICE_ID_CA_PRIV_KEY: await sts.jwk2env(await deviceCA.getCAKey().exportPrivateJWK()),
      DEVICE_ID_CA_CERT: await deviceCA.caCertificate().then((r) => r.Ok().jwtStr),

      CLOUD_SESSION_TOKEN_SECRET:
        "z33KxHvFS3jLz72v9DeyGBqo7H34SCC1RA5LvQFCyDiU4r4YBR4jEZxZwA9TqBgm6VB5QzwjrZJoVYkpmHgH7kKJ6Sasat3jTDaBCkqWWfJAVrBL7XapUstnKW3AEaJJKvAYWrKYF9JGqrHNU8WVjsj3MZNyqqk8iAtTPPoKtPTLo2c657daVMkxibmvtz2egnK5wPeYEUtkbydrtBzteN25U7zmGqhS4BUzLjDiYKMLP8Tayi",

      WRAPPER_BASE_URL: "https://tbd",
      ENTRY_POINT_TEMPLATE_URL:
        // "http://{fsId}{.groupid}.localhost.adviser.com/entry-point",
        "http://{fsId}.localhost.adviser.com/entry-point",
      FP_VERSION: "0.24.8-dev-test-device-id",

      VIBES_SVC_HOSTNAME_BASE: "localhost.vibesdiy.net",
      VIBES_SVC_PORT: "8787",
      VIBES_SVC_PROTOCOL: "http",
      CALLAI_API_KEY: "what-ever",
      CALLAI_CHAT_URL: "what-ever",

      LLM_BACKEND_URL: "http://what-ever",
      ENVIRONMENT: "test",

      LLM_BACKEND_API_KEY: "llm-api-key",
      FPCLOUD_URL: "fpcloud-url",
      DASHBOARD_URL: "dashboard-url",
      DEV_SERVER_HOST: "localhost",
      DEV_SERVER_PORT: "8787",
    };

    const fetchPair = TestFetchPair.create();
    const wsPair = TestWSPair.create();
    const appCtx = await createAppContext({
      sthis,
      s3Api: new (class implements S3Api {
        genId(): string {
          throw new Error("Method not implemented.");
        }
        get(_iurl: string): Promise<FetchResult> {
          throw new Error("Method not implemented.");
        }
        put(_iurl: string): Promise<WritableStream<Uint8Array>> {
          throw new Error("Method not implemented.");
        }
        rename(_fromUrl: string, _toUrl: string): Promise<Result<void>> {
          throw new Error("Method not implemented.");
        }
      })(),
      fetchAsset: async (url: string) => {
        throw new Error(`fetchAsset not implemented in test for url: ${url}`);
      },
      postQueue: async (_msg: MsgBase) => {
        // throw new Error(`postQueue not implemented in test for msg: ${JSON.stringify(msg)}`);
      },
      llmRequest: async (prompt: LLMRequest) => {
        // console.log("Received LLM request in test llmRequest handler with messages:", prompt.messages.filter((m) => m.content.some((c) => c.type === "text")).map((m) => m.content.filter((c) => c.type === "text").map((c) => c.text).join("\n")).join("\n---\n"));
        if (prompt.messages[0]?.content?.some((c) => c.type === "text" && c.text.includes("use fixture response"))) {
          const fixture = await loadAsset("./fixture.llm", { basePath: () => import.meta.url });
          return new Response(fixture.Ok(), { status: 200 });
        }
        // console.log("Received LLM request in test llmRequest handler with messages:", prompt.messages);
        return new Response("", { status: 200 });
      },
      netHash: () => "test-hash",
      connections: new Set(),
      env,
      db: drizzleDB, // as unknown as VibesSqlite,
      cache: noopCache,
    });

    fetchPair.server.onServe(async (req: Request) => {
      // console.log("fetchPair.server received request:", req.url, Object.fromEntries(req.headers.entries()));
      return cfServe(
        req as unknown as CFRequest,
        {
          appCtx: appCtx.appCtx,
          cache: noopCache,
          drizzle: drizzleDB,
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

    api = new VibeDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 100000,
      getToken: async () => {
        return Result.Ok(await testUser.getDashBoardToken());
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
});
