import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, string2stream, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { processRequest, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk, isResRequestAccessApproved } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// ACL gate on /assets/cid: when ?user=&app=&db= are all present the handler
// authenticates the caller and enforces the per-db ACL. Without those three
// the existing public-by-CID behavior is preserved (icons, app code, the
// CLI's --verify-fetch flow).

const BASE = "http://localhost:8787";

interface FetchOpts {
  readonly url: string;
  readonly mime?: string;
  readonly userSlug?: string;
  readonly appSlug?: string;
  readonly dbName?: string;
  readonly bearer?: string;
}

async function cidAssetFetch(
  appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>["appCtx"],
  opts: FetchOpts
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.bearer) headers["Authorization"] = `Bearer ${opts.bearer}`;
  const params = new URLSearchParams({ url: opts.url, mime: opts.mime ?? "text/plain" });
  if (opts.userSlug) params.set("user", opts.userSlug);
  if (opts.appSlug) params.set("app", opts.appSlug);
  if (opts.dbName) params.set("db", opts.dbName);
  return processRequest(appCtx, new Request(`${BASE}/assets/cid?${params.toString()}`, { method: "GET", headers }));
}

describe("cid-asset ACL gate", { timeout: 20000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>["appCtx"];
  let ownerToken: string;
  let viewerToken: string;
  let strangerToken: string;
  let appSlug: string;
  let userSlug: string;
  let assetURI: string;
  const dbName = "default";
  const payload = "hello-cid-asset-acl";

  beforeAll(async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    const ctx = await createVibeDiyTestCtx(sthis, deviceCA);
    appCtx = ctx.appCtx;

    const ownerUser = await createTestUser({ sthis, deviceCA });
    const viewerUser = await createTestUser({ sthis, deviceCA, seqUserId: 200 });
    const strangerUser = await createTestUser({ sthis, deviceCA, seqUserId: 300 });

    ownerToken = (await ownerUser.getDashBoardToken()).token;
    viewerToken = (await viewerUser.getDashBoardToken()).token;
    strangerToken = (await strangerUser.getDashBoardToken()).token;

    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    ctx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    const ownerApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await ownerUser.getDashBoardToken()),
    });
    const viewerApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await viewerUser.getDashBoardToken()),
    });
    void strangerUser;

    const rApp = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>cid-asset ACL test</div>; } App();`,
        },
      ],
    });
    const app = rApp.Ok();
    if (!isResEnsureAppSlugOk(app)) assert.fail("Failed to create app");
    appSlug = app.appSlug;
    userSlug = app.userSlug;

    await ownerApi.ensureAppSettings({ appSlug, userSlug, request: { enable: true, autoAcceptRole: "viewer" } });
    const rViewer = await viewerApi.requestAccess({ appSlug, userSlug });
    if (!isResRequestAccessApproved(rViewer.Ok())) assert.fail("viewer not auto-approved");

    const [rStore] = await ctx.vibesCtx.storage.ensure(string2stream(payload));
    if (rStore.isErr()) assert.fail(`storage.ensure failed: ${rStore.Err()}`);
    assetURI = rStore.Ok().getURL;
  });

  describe("public path (no user/app/db) — unchanged from today", () => {
    it("serves bytes without auth", async () => {
      const res = await cidAssetFetch(appCtx, { url: assetURI });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(payload);
      expect(res.headers.get("Cache-Control")).toContain("public");
    });
  });

  describe("gated path (user+app+db present)", () => {
    it("owner: 200 + body + private cache", async () => {
      const res = await cidAssetFetch(appCtx, { url: assetURI, userSlug, appSlug, dbName, bearer: ownerToken });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(payload);
      const cc = res.headers.get("Cache-Control") ?? "";
      expect(cc).toContain("private");
      expect(cc).toContain("immutable");
    });

    it("viewer (auto-approved): 200 + body", async () => {
      const res = await cidAssetFetch(appCtx, { url: assetURI, userSlug, appSlug, dbName, bearer: viewerToken });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(payload);
    });

    it("stranger: 403", async () => {
      const res = await cidAssetFetch(appCtx, { url: assetURI, userSlug, appSlug, dbName, bearer: strangerToken });
      expect(res.status).toBe(403);
      const body = (await res.json()) as { type: string; message: string };
      expect(body.type).toBe("error");
    });

    it("missing bearer with gate engaged: 401", async () => {
      const res = await cidAssetFetch(appCtx, { url: assetURI, userSlug, appSlug, dbName });
      expect(res.status).toBe(401);
    });

    it("partial gate (only user) with no others: 400", async () => {
      const res = await cidAssetFetch(appCtx, { url: assetURI, userSlug, bearer: ownerToken });
      expect(res.status).toBe(400);
    });
  });
});
