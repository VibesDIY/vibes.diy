import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { processRequest, storeAndAuditAsset, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResAssetUploadGrant, isResEnsureAppSlugOk, isResRequestAccessApproved } from "@vibes.diy/api-types";
import { eq } from "drizzle-orm";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// End-to-end test for the put-asset flow:
//   1. Owner WS-mints a grant for (userSlug, appSlug).
//   2. POST /assets with X-Asset-Grant header streams bytes.
//   3. Response carries cid/getURL/size/uploadId.
//   4. AssetUploads audit row is written with the uploaded data + assetURI.
//   5. Stranger (no access) cannot mint a grant.
//   6. Anon POST /assets without a grant returns 401.
//   7. Tampered grant returns 401.

async function setupCtx() {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const ctx = await createVibeDiyTestCtx(sthis, deviceCA);
  const wsPair = TestWSPair.create();
  const wsEvento = vibesMsgEvento();
  const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
  ctx.vibesCtx.connections.add(wsSendProvider);
  wsPair.p2.onmessage = (event: MessageEvent) => {
    wsEvento.trigger({ ctx: ctx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  };
  return { ctx, wsPair, sthis, deviceCA };
}

async function mkUser(
  sthis: ReturnType<typeof ensureSuperThis>,
  deviceCA: Awaited<ReturnType<typeof createTestDeviceCA>>,
  wsPair: ReturnType<typeof TestWSPair.create>,
  seqOffset: number
) {
  const user = await createTestUser({ sthis, deviceCA, seqUserId: seqOffset });
  const api = new VibesDiyApi({
    apiUrl: "http://localhost:8787/api",
    ws: wsPair.p1 as unknown as WebSocket,
    timeoutMs: 10000,
    getToken: async () => Result.Ok(await user.getDashBoardToken()),
  });
  return { user, api };
}

describe("put-asset / asset-upload-grant end-to-end", { timeout: 30000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let strangerApi: VibesDiyApi;
  let appSlug: string;
  let userSlug: string;

  beforeAll(async () => {
    const { ctx, wsPair, sthis, deviceCA } = await setupCtx();
    appCtx = ctx;
    const ownerSetup = await mkUser(sthis, deviceCA, wsPair, 100);
    const strangerSetup = await mkUser(sthis, deviceCA, wsPair, 200);
    ownerApi = ownerSetup.api;
    strangerApi = strangerSetup.api;
    const rApp = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return <div/>; } App();` }],
    });
    const res = rApp.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    userSlug = res.userSlug;
  }, 30000);

  it("mints a grant, uploads bytes, returns cid + writes AssetUploads", async () => {
    const rGrant = await ownerApi.requestAssetUploadGrant({ userSlug, appSlug, mimeType: "text/plain" });
    if (rGrant.isErr()) assert.fail(`grant failed: ${rGrant.Err().message}`);
    const grantRes = rGrant.Ok();
    if (!isResAssetUploadGrant(grantRes)) assert.fail("grant response shape mismatch");
    expect(typeof grantRes.grant).toBe("string");
    expect(typeof grantRes.uploadId).toBe("string");
    expect(grantRes.uploadId.length).toBeGreaterThan(0);

    const bytes = new TextEncoder().encode("hello put-asset");
    const res = await processRequest(
      appCtx.appCtx,
      new Request("http://localhost.vibesdiy.net:8787/assets", {
        method: "POST",
        headers: { "X-Asset-Grant": grantRes.grant, "Content-Type": "text/plain" },
        body: bytes,
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { type: string; cid: string; getURL: string; size: number; uploadId: string };
    expect(body.type).toBe("vibes.diy.res-put-asset");
    expect(typeof body.cid).toBe("string");
    expect(body.cid.length).toBeGreaterThan(0);
    expect(typeof body.getURL).toBe("string");
    expect(body.size).toBe(bytes.byteLength);
    expect(body.uploadId).toBe(grantRes.uploadId);

    // AssetUploads audit row contains the upload metadata.
    const t = appCtx.vibesCtx.sql.tables.assetUploads;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.uploadId, grantRes.uploadId));
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.cid).toBe(body.cid);
    expect(row.assetURI).toBe(body.getURL);
    expect(row.userSlug).toBe(userSlug);
    expect(row.appSlug).toBe(appSlug);
    expect(row.size).toBe(bytes.byteLength);
    expect(row.mimeType).toBe("text/plain");
    expect(typeof row.userId).toBe("string");
    expect(row.userId.length).toBeGreaterThan(0);
  });

  it("stranger cannot mint a grant for an app they don't have access to", async () => {
    const rGrant = await strangerApi.requestAssetUploadGrant({ userSlug, appSlug });
    expect(rGrant.isErr()).toBe(true);
  });

  it("POST /assets without grant returns 401", async () => {
    const res = await processRequest(
      appCtx.appCtx,
      new Request("http://localhost.vibesdiy.net:8787/assets", { method: "POST", body: new Uint8Array([1, 2, 3]) })
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { type: string; message: string };
    expect(body.type).toBe("error");
  });

  it("POST /assets with tampered grant returns 401", async () => {
    const rGrant = await ownerApi.requestAssetUploadGrant({ userSlug, appSlug });
    if (rGrant.isErr()) assert.fail(`grant failed: ${rGrant.Err().message}`);
    const grantRes = rGrant.Ok();
    if (!isResAssetUploadGrant(grantRes)) assert.fail("grant response shape mismatch");
    const parts = grantRes.grant.split(".");
    parts[2] = parts[2].slice(0, -2) + (parts[2].slice(-2) === "AA" ? "BB" : "AA");
    const tampered = parts.join(".");
    const res = await processRequest(
      appCtx.appCtx,
      new Request("http://localhost.vibesdiy.net:8787/assets", {
        method: "POST",
        headers: { "X-Asset-Grant": tampered },
        body: new Uint8Array([1, 2, 3]),
      })
    );
    expect(res.status).toBe(401);
  });

  it("storeAndAuditAsset (server-mints uploadId, image-gen path)", async () => {
    // Direct call to the shared helper without a grant — exercises the
    // server-side image-gen branch where uploadId is freshly minted by
    // sthis.nextId. Audit row shape must match the put-asset row shape.
    const bytes = new TextEncoder().encode("server-minted bytes");
    const rStored = await storeAndAuditAsset(appCtx.vibesCtx, {
      bytes,
      userId: "test-user-id",
      userSlug,
      appSlug,
      mimeType: "image/png",
    });
    if (rStored.isErr()) assert.fail(`helper failed: ${rStored.Err().message}`);
    const stored = rStored.Ok();
    expect(typeof stored.uploadId).toBe("string");
    expect(stored.uploadId.length).toBeGreaterThan(0);
    expect(stored.size).toBe(bytes.byteLength);
    expect(stored.mimeType).toBe("image/png");

    const t = appCtx.vibesCtx.sql.tables.assetUploads;
    const rows = await appCtx.vibesCtx.sql.db.select().from(t).where(eq(t.uploadId, stored.uploadId));
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.cid).toBe(stored.cid);
    expect(row.assetURI).toBe(stored.assetURI);
    expect(row.userSlug).toBe(userSlug);
    expect(row.appSlug).toBe(appSlug);
    expect(row.userId).toBe("test-user-id");
    expect(row.mimeType).toBe("image/png");
    expect(row.size).toBe(bytes.byteLength);
  });

  it("auto-approved editor (write access) can also mint a grant", async () => {
    const { ctx: editorCtx, wsPair: editorWsPair, sthis: editorSthis, deviceCA: editorCA } = await setupCtx();
    const ownerEditorSetup = await mkUser(editorSthis, editorCA, editorWsPair, 410);
    const editorSetup = await mkUser(editorSthis, editorCA, editorWsPair, 420);
    const rApp = await ownerEditorSetup.api.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return <div/>; } App();` }],
    });
    const appRes = rApp.Ok();
    if (!isResEnsureAppSlugOk(appRes)) assert.fail("Failed to create app");
    await ownerEditorSetup.api.ensureAppSettings({
      appSlug: appRes.appSlug,
      userSlug: appRes.userSlug,
      request: { enable: true, autoAcceptRole: "editor" },
    });
    const rApproved = await editorSetup.api.requestAccess({ appSlug: appRes.appSlug, userSlug: appRes.userSlug });
    if (!isResRequestAccessApproved(rApproved.Ok())) assert.fail("editor not auto-approved");

    const rGrant = await editorSetup.api.requestAssetUploadGrant({
      appSlug: appRes.appSlug,
      userSlug: appRes.userSlug,
    });
    expect(rGrant.isOk()).toBe(true);
    void editorCtx;
  });
});
