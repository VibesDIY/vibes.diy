import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { cfServe, CFInject, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
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

  it("owner can fork their own app; forked row shares source fsId and points back via remix-of meta", async () => {
    const src = await createProdApp("hello-owner");

    const rFork = await api.forkApp({ srcUserSlug: src.userSlug, srcAppSlug: src.appSlug });
    if (rFork.isErr()) {
      assert.fail("Expected forkApp to succeed: " + JSON.stringify(rFork.Err()));
    }
    const fork = rFork.Ok();
    expect(fork.appSlug).not.toBe(src.appSlug);
    expect(fork.userSlug).toBe(src.userSlug);
    expect(fork.chatId).toBeTruthy();
    expect(fork.srcFsId).toBe(src.fsId);
    expect(fork.srcUserSlug).toBe(src.userSlug);
    expect(fork.srcAppSlug).toBe(src.appSlug);

    // Apps row at the forked pair should share the source fsId and be readable.
    const rApp = await api.getAppByFsId({ appSlug: fork.appSlug, userSlug: fork.userSlug });
    if (rApp.isErr()) assert.fail(`getAppByFsId failed: ${rApp.Err().message}`);
    expect(rApp.Ok().grant).toBe("owner");
    expect(rApp.Ok().mode).toBe("dev");
    expect(rApp.Ok().fsId).toBe(src.fsId);
    expect(rApp.Ok().fileSystem.length).toBeGreaterThan(0);
    const remixMeta = rApp.Ok().meta.find((m) => m.type === "remix-of");
    expect(remixMeta).toBeDefined();
    expect(remixMeta && "srcFsId" in remixMeta ? remixMeta.srcFsId : "").toBe(src.fsId);
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
    expect(fork.srcFsId).toBe(src.fsId);
    expect(fork.srcUserSlug).toBe(src.userSlug);
    expect(fork.srcAppSlug).toBe(src.appSlug);
  });

  it("non-owner can fork an enableRequest app (matches /vibe 'remix while you wait' affordance)", async () => {
    const src = await createProdApp("hello-request-enabled");
    await api.ensureAppSettings({
      appSlug: src.appSlug,
      userSlug: src.userSlug,
      request: { enable: true, autoAcceptViewRequest: false },
    });

    const rFork = await api2.forkApp({ srcUserSlug: src.userSlug, srcAppSlug: src.appSlug });
    if (rFork.isErr()) {
      assert.fail("Expected forkApp to succeed for enableRequest app: " + JSON.stringify(rFork.Err()));
    }
    const fork = rFork.Ok();
    expect(fork.userSlug).not.toBe(src.userSlug);
    expect(fork.srcFsId).toBe(src.fsId);
    expect(fork.srcUserSlug).toBe(src.userSlug);
    expect(fork.srcAppSlug).toBe(src.appSlug);

    // Forker's admin UI must NOT inherit src env entries from the source.
    const rForkSettings = await api2.ensureAppSettings({ appSlug: fork.appSlug, userSlug: fork.userSlug });
    if (rForkSettings.isErr()) assert.fail(`ensureAppSettings failed: ${rForkSettings.Err().message}`);
    expect(rForkSettings.Ok().settings.entry.settings.env).toEqual([]);
  });

  it("skipChat=true clones into production with -clone slug and request-access settings (no chat seed)", async () => {
    const src = await createProdApp("hello-clone");

    const rFork = await api.forkApp({ srcUserSlug: src.userSlug, srcAppSlug: src.appSlug, skipChat: true });
    if (rFork.isErr()) {
      assert.fail("Expected forkApp(skipChat) to succeed: " + JSON.stringify(rFork.Err()));
    }
    const fork = rFork.Ok();
    expect(fork.appSlug).toContain("clone");
    expect(fork.srcFsId).toBe(src.fsId);

    const rApp = await api.getAppByFsId({ appSlug: fork.appSlug, userSlug: fork.userSlug });
    if (rApp.isErr()) assert.fail(`getAppByFsId failed: ${rApp.Err().message}`);
    expect(rApp.Ok().mode).toBe("production");
    expect(rApp.Ok().fsId).toBe(src.fsId);
    const remixMeta = rApp.Ok().meta.find((m) => m.type === "remix-of");
    expect(remixMeta).toBeDefined();

    const rSettings = await api.ensureAppSettings({ appSlug: fork.appSlug, userSlug: fork.userSlug });
    if (rSettings.isErr()) assert.fail(`ensureAppSettings failed: ${rSettings.Err().message}`);
    const entry = rSettings.Ok().settings.entry;
    expect(entry.enableRequest?.enable).toBe(true);
    expect(entry.enableRequest?.autoAcceptViewRequest).toBe(false);
    expect(entry.publicAccess?.enable).toBe(false);
  });

  it("remix-of meta survives a code edit on the fork", async () => {
    const src = await createProdApp("hello-carry-forward");

    const rFork = await api.forkApp({ srcUserSlug: src.userSlug, srcAppSlug: src.appSlug });
    if (rFork.isErr()) assert.fail("forkApp failed: " + JSON.stringify(rFork.Err()));
    const fork = rFork.Ok();

    // Simulate a code edit on the fork — ensureAppSlug with different content
    // produces a new fsId at the same (userSlug, appSlug).
    const rEdit = await api.ensureAppSlug({
      mode: "dev",
      appSlug: fork.appSlug,
      userSlug: fork.userSlug,
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>edited-after-fork</div>; } App();`,
        },
      ],
    });
    if (rEdit.isErr()) assert.fail("edit ensureAppSlug failed: " + JSON.stringify(rEdit.Err()));
    const edit = rEdit.Ok();
    if (!isResEnsureAppSlugOk(edit)) assert.fail("Expected ensureAppSlug to return ResEnsureAppSlugOk");
    expect(edit.fsId).not.toBe(fork.srcFsId);

    // The new release should have carried the remix-of meta forward.
    const rApp = await api.getAppByFsId({ appSlug: fork.appSlug, userSlug: fork.userSlug, fsId: edit.fsId });
    if (rApp.isErr()) assert.fail(`getAppByFsId failed: ${rApp.Err().message}`);
    const remixMeta = rApp.Ok().meta.find((m) => m.type === "remix-of");
    expect(remixMeta).toBeDefined();
    expect(remixMeta && "srcFsId" in remixMeta ? remixMeta.srcFsId : "").toBe(src.fsId);
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
