import { VibeDiyApi } from "@vibes.diy/api-impl";
import { createHandler } from "@vibes.diy/api-svc";
import { createClient } from "@libsql/client/node";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { drizzle } from "drizzle-orm/libsql";
import { BuildURI, HandleTriggerCtx, Result, TestFetchPair, TestWSPair, EventoSendProvider } from "@adviser/cement";
import { ensureSuperThis, sts } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";

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

describe("VibesDiyApi", () => {
  const sthis = ensureSuperThis();
  const url = inject("VIBES_DIY_TEST_SQL_URL" as never) as string;
  const client = createClient({ url });
  const db = drizzle(client);

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
      VIBES_SVC_PROTOCOL: "http",
      CALLAI_API_KEY: "what-ever",
      CALLAI_CHAT_URL: "what-ever",
    };

    const fetchPair = TestFetchPair.create();
    const wsPair = TestWSPair.create();

    const svc = await createHandler({
      db,
      cache: noopCache,
      env,
    });
    const svcSendWS = new (class implements EventoSendProvider<Request, unknown, unknown> {
      readonly responses: Response[] = [];
      send<IS, OS>(_trigger: HandleTriggerCtx<Request, unknown, unknown>, data: IS): Promise<Result<OS, Error>> {
        this.responses.push(new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } }));
        wsPair.p1.onMessage({ data: JSON.stringify(data) } as MessageEvent<string>);
        return Promise.resolve(Result.Ok(data as unknown as OS));
      }
    })();
    wsPair.p2.onMessage = async (evt: MessageEvent) => {
      svc({ type: "MessageEvent", event: evt }, { send: svcSendWS });
    };
    // const svcSendFetch = new (class implements EventoSendProvider<Request, unknown, unknown> {
    // fetchPair.server.onServe((req: Request) => {
    //   svc(req)
    // });

    api = new VibeDiyApi({
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
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
    const resIframe = await api.cfg.fetch(res.Ok().entryPointUrl);
    expect(resIframe.status).toBe(200);
    const iframeText = await resIframe.text();
    const imports = [...iframeText.matchAll(/^import \* as V\d+ from "(~~transformed~~\/[^"]*)"/gm)];
    for (const imp of imports || []) {
      const importFile = await api.cfg.fetch(BuildURI.from(res.Ok().entryPointUrl).appendRelative(imp[1]).toString());
      expect(importFile.status).toBe(200);
      const importText = await importFile.text();
      expect(importText).toContain(`console.log('hello world');`);
    }
  });

  it("ensureChatContext creates new context", async () => {
    const res = await api.ensureChatContext({});
    expect(res.isOk()).toBe(true);
    expect(res.Ok().contextId.length).toBeGreaterThan(0);

    // Calling again without contextId should create a new context
    const res2 = await api.ensureChatContext({});
    expect(res2.isOk()).toBe(true);
    expect(res2.Ok().contextId).not.toBe(res.Ok().contextId);
  });

  it("ensureChatContext reuses existing context", async () => {
    const res = await api.ensureChatContext({});
    expect(res.isOk()).toBe(true);
    const contextId = res.Ok().contextId;

    // Calling with existing contextId should return the same context
    const res2 = await api.ensureChatContext({ contextId });
    expect(res2.isOk()).toBe(true);
    expect(res2.Ok().contextId).toBe(contextId);
  });

  it("ensureChatContext creates context with provided id", async () => {
    const contextId = `test-context-${Date.now()}`;
    const res = await api.ensureChatContext({ contextId });
    expect(res.isOk()).toBe(true);
    expect(res.Ok().contextId).toBe(contextId);

    // Verify it can be retrieved again
    const res2 = await api.ensureChatContext({ contextId });
    expect(res2.isOk()).toBe(true);
    expect(res2.Ok().contextId).toBe(contextId);
  });

  it("appendChatSection adds section with incrementing seq", async () => {
    // First create a context
    const contextRes = await api.ensureChatContext({});
    expect(contextRes.isOk()).toBe(true);
    const contextId = contextRes.Ok().contextId;

    // Append first section (seq should be 0)
    const res1 = await api.appendChatSection({
      contextId,
      origin: "user",
      blocks: [
        {
          type: "prompt.txt",
          streamId: "test-stream-1",
          request: {
            model: "test-model",
            messages: [{ role: "user", content: "Hello, world!" }],
          },
          timestamp: new Date(),
        },
      ],
    });
    expect(res1.isOk()).toBe(true);
    expect(res1.Ok().contextId).toBe(contextId);
    expect(res1.Ok().seq).toBe(0);
    expect(res1.Ok().origin).toBe("user");

    // Append second section (seq should be 1)
    const res2 = await api.appendChatSection({
      contextId,
      origin: "llm",
      blocks: [
        {
          type: "block.begin",
          blockId: "block-1",
          blockNr: 0,
          seq: 1,
          streamId: "test-stream-1",
          timestamp: new Date(),
        },
        {
          type: "block.toplevel.begin",
          blockId: "block-1",
          sectionId: "toplevel-1",
          blockNr: 0,
          seq: 1,
          streamId: "test-stream-1",
          timestamp: new Date(),
        },
        {
          type: "block.toplevel.line",
          blockId: "block-1",
          blockNr: 0,
          sectionId: "toplevel-1",
          seq: 2,
          streamId: "test-stream-1",
          lineNr: 0,
          line: "Hello! How can I help?",
          timestamp: new Date(),
        },
        {
          type: "block.toplevel.end",
          blockId: "block-1",
          blockNr: 0,
          sectionId: "toplevel-1",
          streamId: "test-stream-1",
          seq: 3,
          stats: {
            lines: 1,
            bytes: 18,
          },
          timestamp: new Date(),
        },
        {
          type: "block.end",
          blockId: "block-1",
          blockNr: 0,
          streamId: "test-stream-1",
          seq: 4,
          stats: {
            toplevel: { lines: 1, bytes: 18 },
            code: { lines: 0, bytes: 0 },
            image: { lines: 0, bytes: 0 },
            total: { lines: 1, bytes: 18 },
          },
          timestamp: new Date(),
        },
      ],
    });
    expect(res2.isOk()).toBe(true);
    expect(res2.Ok().seq).toBe(1);
    expect(res2.Ok().origin).toBe("llm");

    // Append third section (seq should be 2)
    const res3 = await api.appendChatSection({
      contextId,
      origin: "user",
      blocks: [
        {
          type: "prompt.txt",
          streamId: "test-stream-2",
          request: {
            model: "test-model",
            messages: [{ role: "user", content: "Tell me a joke" }],
          },
          timestamp: new Date(),
        },
      ],
    });
    expect(res3.isOk()).toBe(true);
    expect(res3.Ok().seq).toBe(2);
  });

  it("appendChatSection fails for non-existent context", async () => {
    const res = await api.appendChatSection({
      contextId: "non-existent-context-id",
      origin: "user",
      blocks: [
        {
          type: "prompt.txt",
          streamId: "test-stream",
          request: {
            model: "test-model",
            messages: [{ role: "user", content: "Hello" }],
          },
          timestamp: new Date(),
        },
      ],
    });
    expect(res.isErr()).toBe(true);
  });

  it("claimUserSlug claims a new slug", async () => {
    const userSlug = `test-slug-${Date.now()}`;
    const res = await api.claimUserSlug({ userSlug });
    expect(res.isOk()).toBe(true);
    expect(res.Ok().userSlug).toBe(userSlug);
    expect(res.Ok().owned).toBe(true);
  });

  it("claimUserSlug is idempotent for same user", async () => {
    const userSlug = `idempotent-slug-${Date.now()}`;

    // Claim first time
    const res1 = await api.claimUserSlug({ userSlug });
    expect(res1.isOk()).toBe(true);
    expect(res1.Ok().userSlug).toBe(userSlug);

    // Claim again - should succeed (idempotent)
    const res2 = await api.claimUserSlug({ userSlug });
    expect(res2.isOk()).toBe(true);
    expect(res2.Ok().userSlug).toBe(userSlug);
    expect(res2.Ok().owned).toBe(true);
  });

  it("listUserSlugs returns all owned slugs", async () => {
    const slug1 = `list-test-a-${Date.now()}`;
    const slug2 = `list-test-b-${Date.now()}`;

    // Claim two slugs
    await api.claimUserSlug({ userSlug: slug1 });
    await api.claimUserSlug({ userSlug: slug2 });

    // List should include both
    const res = await api.listUserSlugs({});
    expect(res.isOk()).toBe(true);
    expect(res.Ok().slugs).toContain(slug1);
    expect(res.Ok().slugs).toContain(slug2);
  });

  it("ensureAppSlug with userSlug I own works", async () => {
    const userSlug = `owned-slug-${Date.now()}`;

    // First claim the slug
    const claimRes = await api.claimUserSlug({ userSlug });
    expect(claimRes.isOk()).toBe(true);

    // Then publish with it
    const res = await api.ensureAppSlug({
      mode: "dev",
      userSlug,
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: "console.log('hello');",
        },
      ],
    });
    expect(res.isOk()).toBe(true);
    expect(res.Ok().userSlug).toBe(userSlug);
  });

  it("claimUserSlug with profile stores it", async () => {
    const userSlug = `profile-slug-${Date.now()}`;
    const res = await api.claimUserSlug({
      userSlug,
      profile: { type: "user", name: "J Chris Anderson" },
    });
    expect(res.isOk()).toBe(true);
    expect(res.Ok().profile?.name).toBe("J Chris Anderson");
  });

  it("claimUserSlug returns existing profile", async () => {
    const userSlug = `existing-profile-${Date.now()}`;
    await api.claimUserSlug({
      userSlug,
      profile: { type: "user", name: "Initial Name" },
    });

    // Call again without profile - should still return it
    const res = await api.claimUserSlug({ userSlug });
    expect(res.isOk()).toBe(true);
    expect(res.Ok().profile?.name).toBe("Initial Name");
  });

  it("claimUserSlug updates profile on subsequent calls", async () => {
    const userSlug = `update-profile-${Date.now()}`;
    await api.claimUserSlug({
      userSlug,
      profile: { type: "user", name: "Old Name" },
    });

    const res = await api.claimUserSlug({
      userSlug,
      profile: { type: "user", name: "New Name" },
    });
    expect(res.isOk()).toBe(true);
    expect(res.Ok().profile?.name).toBe("New Name");
  });

  it("claimUserSlug with profile and url", async () => {
    const userSlug = `profile-url-${Date.now()}`;
    const res = await api.claimUserSlug({
      userSlug,
      profile: { type: "user", name: "Chris", url: "https://example.com" },
    });
    expect(res.isOk()).toBe(true);
    expect(res.Ok().profile?.name).toBe("Chris");
    expect(res.Ok().profile?.url).toBe("https://example.com");
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
        entryPointUrl: `http://sand-nose-hope--immediately-steel-${now}.localhost.vibesdiy.net/~zGDU8X6kbHpi3Uxf7jMZMhUTad4VbtrmrwuRxtpzXxn7s~/`,
        env: {
          TEST_ENV_VAR: "hello world",
        },
        fileSystem: [
          {
            assetId: "zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s",
            assetURI: "sql://Assets/zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s",
            fileName: "/App.jsx",
            mimeType: "text/jsx",
            size: expect.any(Number),
            transform: {
              type: "jsx-to-js",
              transformedAssetId: "zAVHPsNUCbx2Kz6h4Z59bCx4XWiN9MtqDBRWePf282dcK",
            },
          },
          {
            assetId: "zAVHPsNUCbx2Kz6h4Z59bCx4XWiN9MtqDBRWePf282dcK",
            assetURI: "sql://Assets/zAVHPsNUCbx2Kz6h4Z59bCx4XWiN9MtqDBRWePf282dcK",
            fileName: "/~~transformed~~/zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s",
            mimeType: "application/javascript",
            size: 276,
            transform: {
              action: "jsx-to-js",
              transformedAssetId: "zALtCJe12EFVgLEg6YDxtpba7jPHLRYEojT6aP8rtG3s",
              type: "transformed",
            },
          },
          {
            assetId: "z8SQeNpedZd3Tzj4WPTmWYzKPVY9qBnNnJ8TQ8jR3G9GC",
            assetURI: "sql://Assets/z8SQeNpedZd3Tzj4WPTmWYzKPVY9qBnNnJ8TQ8jR3G9GC",
            fileName: "/~~calculated~~/import-map.json",
            mimeType: "application/importmap+json",
            size: 6822,
            transform: {
              fromAssetIds: ["/App.jsx"],
              type: "import-map",
            },
          },
        ],
        fsId: "zGDU8X6kbHpi3Uxf7jMZMhUTad4VbtrmrwuRxtpzXxn7s",
        mode: "dev",
        type: "vibes.diy.res-ensure-app-slug",
        userSlug: `immediately-steel-${now}`,
        wrapperUrl: `https://tbd/immediately-steel-${now}/sand-nose-hope/zGDU8X6kbHpi3Uxf7jMZMhUTad4VbtrmrwuRxtpzXxn7s`,
      });
    }
  });
});
