import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { processStream, Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { cfServe, CFInject, noopCache, reconstructSourceFiles, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isPromptBlockEnd, isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

describe("forkApp", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
  const sthis = ensureSuperThis();

  let api: VibesDiyApi; // owner
  let api2: VibesDiyApi; // remixer
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    const testUser = await createTestUser({ sthis, deviceCA, seqUserId: 300 });

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
      getToken: async () => Result.Ok(await testUser.getDashBoardToken()),
    });

    const testUser2 = await createTestUser({ sthis, deviceCA, seqUserId: 400 });
    api2 = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 100000,
      getToken: async () => Result.Ok(await testUser2.getDashBoardToken()),
    });
  });

  async function createProdApp(markerText: string) {
    const rRes = await api.ensureAppSlug({
      mode: "production",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>${markerText}</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      assert.fail("Expected ensureAppSlug to return ResEnsureAppSlugOk");
    }
    return { appSlug: res.appSlug, userSlug: res.userSlug, fsId: res.fsId };
  }

  it("owner can fork their own app and seed chat with reconstructed source", async () => {
    const src = await createProdApp("hello-owner");

    const rFork = await api.forkApp({ srcUserSlug: src.userSlug, srcAppSlug: src.appSlug });
    if (rFork.isErr()) {
      assert.fail("Expected forkApp to succeed: " + JSON.stringify(rFork.Err()));
    }
    const fork = rFork.Ok();
    expect(fork.remixOf).toBe(`${src.userSlug}/${src.appSlug}`);
    expect(fork.appSlug).not.toBe(src.appSlug);
    expect(fork.userSlug).toBe(src.userSlug);
    expect(fork.chatId).toBeTruthy();
    expect(fork.sourceFiles.length).toBeGreaterThan(0);
    const appJsx = fork.sourceFiles.find((f) => f.filename === "/App.jsx");
    expect(appJsx).toBeDefined();
    expect(appJsx && "content" in appJsx ? appJsx.content : "").toContain("hello-owner");

    // Replay via promptFS — mirrors the chat editor's manual-save flow.
    const rChat = await api.openChat({ userSlug: fork.userSlug, appSlug: fork.appSlug, mode: "chat" });
    if (rChat.isErr()) assert.fail(`openChat failed: ${rChat.Err().message}`);
    const chat = rChat.Ok();
    const rPrompt = await chat.promptFS(fork.sourceFiles);
    if (rPrompt.isErr()) assert.fail(`promptFS failed: ${rPrompt.Err().message}`);

    let newFsId: string | undefined;
    await processStream(chat.sectionStream, async (msg) => {
      if (!("blocks" in msg)) return;
      for (const b of msg.blocks as unknown[]) {
        if (isPromptBlockEnd(b as { type?: string })) {
          await chat.close();
        }
        const be = b as { type?: string; streamId?: string; fsRef?: { fsId: string } };
        if (be.type === "block.end" && be.streamId === rPrompt.Ok().promptId && be.fsRef) {
          newFsId = be.fsRef.fsId;
        }
      }
    });
    expect(newFsId).toBeTruthy();

    // Apps row should be readable at the new slug after promptFS.
    const rApp = await api.getAppByFsId({ appSlug: fork.appSlug, userSlug: fork.userSlug });
    if (rApp.isErr()) assert.fail(`getAppByFsId failed: ${rApp.Err().message}`);
    expect(rApp.Ok().grant).toBe("owner");
    expect(rApp.Ok().mode).toBe("dev");
    expect(rApp.Ok().fileSystem.length).toBeGreaterThan(0);
  });

  it("non-owner can fork a publicAccess app", async () => {
    const src = await createProdApp("hello-public");
    await api.ensureAppSettings({ appSlug: src.appSlug, userSlug: src.userSlug, publicAccess: { enable: true } });

    const rFork = await api2.forkApp({ srcUserSlug: src.userSlug, srcAppSlug: src.appSlug });
    if (rFork.isErr()) {
      assert.fail("Expected forkApp to succeed: " + JSON.stringify(rFork.Err()));
    }
    const fork = rFork.Ok();
    expect(fork.userSlug).not.toBe(src.userSlug);
    expect(fork.sourceFiles.length).toBeGreaterThan(0);
    const appJsx = fork.sourceFiles.find((f) => f.filename === "/App.jsx");
    expect(appJsx).toBeDefined();
    expect(appJsx && "content" in appJsx ? appJsx.content : "").toContain("hello-public");
  });

  it("non-owner cannot fork a private app (no grant)", async () => {
    const src = await createProdApp("hello-private");

    const rFork = await api2.forkApp({ srcUserSlug: src.userSlug, srcAppSlug: src.appSlug });
    expect(rFork.isErr()).toBe(true);
  });

  it("forking a non-existent app returns an error", async () => {
    const rFork = await api2.forkApp({ srcUserSlug: "no-such-user", srcAppSlug: "no-such-app" });
    expect(rFork.isErr()).toBe(true);
  });
});

describe("reconstructSourceFiles classification", () => {
  // Direct unit tests against the reconstruction helper with a stub storage.
  // The end-to-end ingest path (ensureAppSlug → transformJSXAndImports) only
  // retains js/jsx code-blocks today, so non-code VibeFiles can't round-trip
  // through the public API — these tests exercise the classifier directly.

  function makeStorage(table: Record<string, Uint8Array>) {
    return {
      fetch: async (url: string) => {
        const bytes = table[url];
        if (!bytes) return { type: "fetch.notfound" as const, url };
        return {
          type: "fetch.ok" as const,
          url,
          data: new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(bytes);
              controller.close();
            },
          }),
        };
      },
    };
  }

  it("classifies items by transform marker and mime", async () => {
    const jsxBytes = new TextEncoder().encode("function App(){ return <div/>; }");
    const cssBytes = new TextEncoder().encode(".x{color:red}");
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0x80, 0x01]);
    const storage = makeStorage({
      "mem://jsx": jsxBytes,
      "mem://css": cssBytes,
      "mem://png": pngBytes,
    });
    const rFiles = await reconstructSourceFiles(
      { storage } as unknown as Parameters<typeof reconstructSourceFiles>[0],
      [
        {
          fileName: "/App.jsx",
          mimeType: "text/javascript",
          assetId: "jsx",
          assetURI: "mem://jsx",
          size: jsxBytes.length,
          transform: { type: "jsx-to-js", transformedAssetId: "tjsx" },
          entryPoint: true,
        },
        { fileName: "/styles.css", mimeType: "text/css", assetId: "css", assetURI: "mem://css", size: cssBytes.length },
        { fileName: "/logo.png", mimeType: "image/png", assetId: "png", assetURI: "mem://png", size: pngBytes.length },
      ]
    );
    if (rFiles.isErr()) assert.fail(rFiles.Err().message);
    const [jsx, css, png] = rFiles.Ok();
    expect(jsx.type).toBe("code-block");
    expect(jsx.filename).toBe("/App.jsx");
    expect((jsx as { entryPoint?: boolean }).entryPoint).toBe(true);
    expect(css.type).toBe("str-asset-block");
    expect("content" in css && typeof css.content === "string" ? css.content : "").toBe(".x{color:red}");
    expect(png.type).toBe("uint8-asset-block");
    const pngContent = "content" in png ? png.content : undefined;
    expect(pngContent).toBeInstanceOf(Uint8Array);
    expect(Array.from(pngContent as Uint8Array)).toEqual(Array.from(pngBytes));
  });

  it("returns Err with filename when any asset fetch fails", async () => {
    const storage = makeStorage({ "mem://ok": new TextEncoder().encode("ok") });
    const rFiles = await reconstructSourceFiles(
      { storage } as unknown as Parameters<typeof reconstructSourceFiles>[0],
      [
        { fileName: "/App.jsx", mimeType: "text/javascript", assetId: "ok", assetURI: "mem://ok", size: 2 },
        { fileName: "/missing.css", mimeType: "text/css", assetId: "x", assetURI: "mem://missing", size: 0 },
      ]
    );
    expect(rFiles.isErr()).toBe(true);
    expect(rFiles.Err().message).toContain("/missing.css");
    expect(rFiles.Err().message).toContain("mem://missing");
  });
});
