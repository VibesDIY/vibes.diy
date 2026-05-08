import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, string2stream, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { processRequest, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk, isResRequestAccessApproved, isResGetDoc, isResPutDoc } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// End-to-end test for the `_files` flow:
//   1. Seed an AssetUploads row directly (put-asset endpoint not yet shipped).
//   2. Owner puts a doc carrying `_files.<key> = { uploadId, type, size, lastModified }`.
//   3. getDoc returns the doc with `_files.<key>.url` minted server-side.
//   4. HTTP GET on that URL streams the bytes (auth + ACL gate, public-app
//      anonymous reads, CORS for embed, etc).

interface TestApp {
  readonly userSlug: string;
  readonly appSlug: string;
  readonly api: VibesDiyApi;
  readonly userToken: string;
}

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
): Promise<{ user: Awaited<ReturnType<typeof createTestUser>>; api: VibesDiyApi; token: string }> {
  const user = await createTestUser({ sthis, deviceCA, seqUserId: seqOffset });
  const token = (await user.getDashBoardToken()).token;
  const api = new VibesDiyApi({
    apiUrl: "http://localhost:8787/api",
    ws: wsPair.p1 as unknown as WebSocket,
    timeoutMs: 10000,
    getToken: async () => Result.Ok(await user.getDashBoardToken()),
  });
  return { user, api, token };
}

interface SeededFile {
  readonly uploadId: string;
  readonly assetURI: string;
  readonly cid: string;
  readonly size: number;
  readonly bytes: string;
}

async function seedAssetUpload(
  ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>,
  app: { userSlug: string; appSlug: string; userId: string },
  bytes: string,
  mimeType: string
): Promise<SeededFile> {
  const [rStore] = await ctx.vibesCtx.storage.ensure(string2stream(bytes));
  if (rStore.isErr()) throw new Error(`storage.ensure failed: ${rStore.Err()}`);
  const stored = rStore.Ok();
  const uploadId = `test-upl-${stored.cid.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await ctx.vibesCtx.sql.db.insert(ctx.vibesCtx.sql.tables.assetUploads).values({
    uploadId,
    userId: app.userId,
    userSlug: app.userSlug,
    appSlug: app.appSlug,
    cid: stored.cid,
    assetURI: stored.getURL,
    size: bytes.length,
    mimeType,
    created: new Date().toISOString(),
  });
  return { uploadId, assetURI: stored.getURL, cid: stored.cid, size: bytes.length, bytes };
}

function fileUrl(
  ctx: { svc: { hostnameBase: string; protocol: string; port?: string } },
  app: TestApp,
  dbName: string,
  docId: string,
  key: string,
  uploadId: string
): string {
  const port = ctx.svc.port && ctx.svc.port !== "80" && ctx.svc.port !== "443" ? `:${ctx.svc.port}` : "";
  return `${ctx.svc.protocol}://assets.${ctx.svc.hostnameBase.replace(/^\./, "")}${port}/_files/${encodeURIComponent(app.userSlug)}/${encodeURIComponent(app.appSlug)}/${encodeURIComponent(dbName)}/${encodeURIComponent(docId)}/${encodeURIComponent(key)}?v=${encodeURIComponent(uploadId)}`;
}

// Mint an asset-session cookie for a test user by hitting the bridge
// endpoint /_auth/session with the user's Bearer. Returns the Cookie
// header value the test will attach to subsequent /_files requests.
async function mintAssetCookie(
  ctx: {
    appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>["appCtx"];
    svc: { hostnameBase: string; protocol: string; port?: string };
  },
  bearer: string
): Promise<string> {
  const port = ctx.svc.port && ctx.svc.port !== "80" && ctx.svc.port !== "443" ? `:${ctx.svc.port}` : "";
  const url = `${ctx.svc.protocol}://assets.${ctx.svc.hostnameBase.replace(/^\./, "")}${port}/_auth/session`;
  const res = await processRequest(
    ctx.appCtx,
    new Request(url, { method: "POST", headers: { Authorization: `Bearer ${bearer}` } })
  );
  if (res.status !== 200) throw new Error(`mintAssetCookie failed: ${res.status} ${await res.text()}`);
  const setCookie = res.headers.get("Set-Cookie");
  if (!setCookie) throw new Error("mintAssetCookie: no Set-Cookie on response");
  // Set-Cookie value is `name=value; flags`; the Cookie header sent back is just `name=value`.
  const semi = setCookie.indexOf(";");
  return semi > 0 ? setCookie.slice(0, semi) : setCookie;
}

describe("files-asset / _files end-to-end", { timeout: 60000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let owner: TestApp;
  let viewer: TestApp;
  let stranger: TestApp;
  let publicAppSlug: string;
  let publicUserSlug: string;
  let privateAppSlug: string;
  let privateUserSlug: string;
  let svc: { hostnameBase: string; protocol: string; port?: string };
  // userId on AssetUploads rows is unused by the read handler (it gates on
  // userSlug/appSlug match). Phase 3 will validate userId on doc write.
  const seededUserId = "test-uploader";

  beforeAll(async () => {
    const { ctx, wsPair, sthis, deviceCA } = await setupCtx();
    appCtx = ctx;
    svc = ctx.vibesCtx.params.vibes.svc;

    const ownerSetup = await mkUser(sthis, deviceCA, wsPair, 100);
    const viewerSetup = await mkUser(sthis, deviceCA, wsPair, 200);
    const strangerSetup = await mkUser(sthis, deviceCA, wsPair, 300);

    // Owner creates two apps: one public, one private.
    const rPublic = await ownerSetup.api.ensureAppSlug({
      mode: "production",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return <div>public</div>; } App();` },
      ],
    });
    const pubRes = rPublic.Ok();
    if (!isResEnsureAppSlugOk(pubRes)) assert.fail("Failed to create public app");
    publicAppSlug = pubRes.appSlug;
    publicUserSlug = pubRes.userSlug;
    // Mark public app as publicAccess (mode: "production" + this flag is what
    // isPublicReadable checks).
    await ownerSetup.api.ensureAppSettings({
      appSlug: publicAppSlug,
      userSlug: publicUserSlug,
      publicAccess: { enable: true },
    });

    const rPrivate = await ownerSetup.api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return <div>private</div>; } App();` },
      ],
    });
    const privRes = rPrivate.Ok();
    if (!isResEnsureAppSlugOk(privRes)) assert.fail("Failed to create private app");
    privateAppSlug = privRes.appSlug;
    privateUserSlug = privRes.userSlug;

    // Viewer requests access to the private app — auto-approved as viewer.
    await ownerSetup.api.ensureAppSettings({
      appSlug: privateAppSlug,
      userSlug: privateUserSlug,
      request: { enable: true, autoAcceptRole: "viewer" },
    });
    const rViewer = await viewerSetup.api.requestAccess({ appSlug: privateAppSlug, userSlug: privateUserSlug });
    if (!isResRequestAccessApproved(rViewer.Ok())) assert.fail("viewer not auto-approved");

    owner = { userSlug: publicUserSlug, appSlug: publicAppSlug, api: ownerSetup.api, userToken: ownerSetup.token };
    viewer = { userSlug: publicUserSlug, appSlug: publicAppSlug, api: viewerSetup.api, userToken: viewerSetup.token };
    stranger = { userSlug: publicUserSlug, appSlug: publicAppSlug, api: strangerSetup.api, userToken: strangerSetup.token };
  }, 60000);

  describe("public app, default db (publicAccess + auto-approve viewer)", () => {
    it("anonymous reads work; CORS allows embed; bytes round-trip via meta.url", async () => {
      const seeded = await seedAssetUpload(
        appCtx,
        { userSlug: publicUserSlug, appSlug: publicAppSlug, userId: seededUserId },
        "anonymous-readable-content",
        "text/plain"
      );
      const dbName = "default";
      const docId = "pub-doc-1";

      // Owner puts a doc with the stored shape.
      const putRes = await owner.api.putDoc({
        userSlug: publicUserSlug,
        appSlug: publicAppSlug,
        dbName,
        docId,
        doc: {
          _files: {
            photo: { uploadId: seeded.uploadId, type: "text/plain", size: seeded.size, lastModified: 1700000000 },
          },
        },
      });
      const putOk = putRes.Ok();
      if (!isResPutDoc(putOk)) assert.fail("Failed to put doc");

      // getDoc returns the doc with the public file shape.
      const getRes = await owner.api.getDoc({ userSlug: publicUserSlug, appSlug: publicAppSlug, dbName, docId });
      const getOk = getRes.Ok();
      if (!isResGetDoc(getOk)) assert.fail("Failed to get doc");
      const photo = (getOk as unknown as { doc: { _files?: Record<string, unknown> } }).doc._files?.photo as
        | Record<string, unknown>
        | undefined;
      expect(photo).toBeTruthy();
      // uploadId stays on the wire so read-modify-write cycles preserve it
      // and put-doc validation can re-verify on save. cid / assetURI are
      // server-only.
      expect(photo?.uploadId).toBe(seeded.uploadId);
      expect(photo?.cid).toBeUndefined();
      expect(photo?.assetURI).toBeUndefined();
      expect(typeof photo?.url).toBe("string");
      expect(photo?.type).toBe("text/plain");
      expect(photo?.size).toBe(seeded.size);
      expect(photo?.lastModified).toBe(1700000000);
      expect(photo?.url).toBe(fileUrl({ svc }, owner, dbName, docId, "photo", seeded.uploadId));

      // Anonymous HTTP GET on the URL — public app, no cookie, expect 200.
      const url = photo?.url as string;
      const res = await processRequest(appCtx.appCtx, new Request(url, { method: "GET" }));
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("text/plain");
      expect(res.headers.get("Cache-Control")).toContain("public");
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(await res.text()).toBe(seeded.bytes);
    });
  });

  describe("private app, default db", () => {
    it("owner reads with cookie succeed", async () => {
      const seeded = await seedAssetUpload(
        appCtx,
        { userSlug: privateUserSlug, appSlug: privateAppSlug, userId: seededUserId },
        "private-content",
        "text/plain"
      );
      const dbName = "default";
      const docId = "priv-doc-owner";
      await owner.api.putDoc({
        userSlug: privateUserSlug,
        appSlug: privateAppSlug,
        dbName,
        docId,
        doc: { _files: { secret: { uploadId: seeded.uploadId, type: "text/plain", size: seeded.size } } },
      });
      const url = fileUrl(
        { svc },
        { ...owner, userSlug: privateUserSlug, appSlug: privateAppSlug },
        dbName,
        docId,
        "secret",
        seeded.uploadId
      );
      const cookie = await mintAssetCookie({ appCtx: appCtx.appCtx, svc }, owner.userToken);
      const res = await processRequest(appCtx.appCtx, new Request(url, { method: "GET", headers: { Cookie: cookie } }));
      expect(res.status).toBe(200);
      // Private reads must be no-store — the cookie that authorizes this
      // response can be cleared (logout) while the URL stays the same;
      // a disk-cached copy would survive logout and leak to the next
      // viewer of the same browser profile.
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      // CORS Access-Control-Allow-Origin is set globally by the send
      // provider — auth + ACL is what actually gates visibility.
      expect(await res.text()).toBe(seeded.bytes);
    });

    it("anonymous read returns 401", async () => {
      const seeded = await seedAssetUpload(
        appCtx,
        { userSlug: privateUserSlug, appSlug: privateAppSlug, userId: seededUserId },
        "private-anon-deny",
        "text/plain"
      );
      const dbName = "default";
      const docId = "priv-doc-anon";
      await owner.api.putDoc({
        userSlug: privateUserSlug,
        appSlug: privateAppSlug,
        dbName,
        docId,
        doc: { _files: { hidden: { uploadId: seeded.uploadId, type: "text/plain", size: seeded.size } } },
      });
      const url = fileUrl(
        { svc },
        { ...owner, userSlug: privateUserSlug, appSlug: privateAppSlug },
        dbName,
        docId,
        "hidden",
        seeded.uploadId
      );
      const res = await processRequest(appCtx.appCtx, new Request(url, { method: "GET" }));
      expect(res.status).toBe(401);
    });

    it("stranger with cookie (no access invite) returns 403", async () => {
      const seeded = await seedAssetUpload(
        appCtx,
        { userSlug: privateUserSlug, appSlug: privateAppSlug, userId: seededUserId },
        "private-stranger-deny",
        "text/plain"
      );
      const dbName = "default";
      const docId = "priv-doc-stranger";
      await owner.api.putDoc({
        userSlug: privateUserSlug,
        appSlug: privateAppSlug,
        dbName,
        docId,
        doc: { _files: { confidential: { uploadId: seeded.uploadId, type: "text/plain", size: seeded.size } } },
      });
      const url = fileUrl(
        { svc },
        { ...owner, userSlug: privateUserSlug, appSlug: privateAppSlug },
        dbName,
        docId,
        "confidential",
        seeded.uploadId
      );
      const cookie = await mintAssetCookie({ appCtx: appCtx.appCtx, svc }, stranger.userToken);
      const res = await processRequest(appCtx.appCtx, new Request(url, { method: "GET", headers: { Cookie: cookie } }));
      expect(res.status).toBe(403);
    });

    it("viewer with cookie (auto-approved) returns 200", async () => {
      const seeded = await seedAssetUpload(
        appCtx,
        { userSlug: privateUserSlug, appSlug: privateAppSlug, userId: seededUserId },
        "private-viewer-allowed",
        "text/plain"
      );
      const dbName = "default";
      const docId = "priv-doc-viewer";
      await owner.api.putDoc({
        userSlug: privateUserSlug,
        appSlug: privateAppSlug,
        dbName,
        docId,
        doc: { _files: { allowed: { uploadId: seeded.uploadId, type: "text/plain", size: seeded.size } } },
      });
      const url = fileUrl(
        { svc },
        { ...owner, userSlug: privateUserSlug, appSlug: privateAppSlug },
        dbName,
        docId,
        "allowed",
        seeded.uploadId
      );
      const cookie = await mintAssetCookie({ appCtx: appCtx.appCtx, svc }, viewer.userToken);
      const res = await processRequest(appCtx.appCtx, new Request(url, { method: "GET", headers: { Cookie: cookie } }));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(seeded.bytes);
    });
  });

  describe("read-modify-write preserves _files", () => {
    it("editing a sibling field does not break the file URL", async () => {
      const seeded = await seedAssetUpload(
        appCtx,
        { userSlug: publicUserSlug, appSlug: publicAppSlug, userId: seededUserId },
        "rmw-bytes",
        "text/plain"
      );
      const dbName = "default";
      const docId = "pub-doc-rmw";

      // First put: doc with _files + a sibling field.
      await owner.api.putDoc({
        userSlug: publicUserSlug,
        appSlug: publicAppSlug,
        dbName,
        docId,
        doc: {
          title: "v1",
          _files: { photo: { uploadId: seeded.uploadId, type: "text/plain", size: seeded.size, lastModified: 1700000000 } },
        },
      });

      // Read the doc back; client-shape includes uploadId so a verbatim
      // re-put preserves the file reference.
      const r1 = await owner.api.getDoc({ userSlug: publicUserSlug, appSlug: publicAppSlug, dbName, docId });
      const doc1 = (r1.Ok() as unknown as { doc: Record<string, unknown> }).doc;
      expect(doc1.title).toBe("v1");
      const photoBefore = doc1._files as Record<string, Record<string, unknown>> | undefined;
      expect(photoBefore?.photo.uploadId).toBe(seeded.uploadId);

      // Edit a sibling field, put back verbatim.
      const updated = { ...doc1, title: "v2" };
      const putBack = await owner.api.putDoc({ userSlug: publicUserSlug, appSlug: publicAppSlug, dbName, docId, doc: updated });
      expect(putBack.isOk()).toBe(true);

      // Re-read; URL still resolvable, bytes still served.
      const r2 = await owner.api.getDoc({ userSlug: publicUserSlug, appSlug: publicAppSlug, dbName, docId });
      const doc2 = (r2.Ok() as unknown as { doc: Record<string, unknown> }).doc;
      expect(doc2.title).toBe("v2");
      const photoAfter = (doc2._files as Record<string, Record<string, unknown>>).photo;
      expect(photoAfter.uploadId).toBe(seeded.uploadId);
      const url = photoAfter.url as string;
      const res = await processRequest(appCtx.appCtx, new Request(url, { method: "GET" }));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(seeded.bytes);
    });
  });

  describe("validation guards", () => {
    it("missing doc returns 404", async () => {
      const url = fileUrl({ svc }, owner, "default", "ghost-doc-id", "photo", "ghost-upl");
      const res = await processRequest(appCtx.appCtx, new Request(url, { method: "GET" }));
      expect(res.status).toBe(404);
    });

    it("doc without the requested file key returns 404", async () => {
      const seeded = await seedAssetUpload(
        appCtx,
        { userSlug: publicUserSlug, appSlug: publicAppSlug, userId: seededUserId },
        "key-mismatch-source",
        "text/plain"
      );
      const dbName = "default";
      const docId = "pub-doc-key-mismatch";
      await owner.api.putDoc({
        userSlug: publicUserSlug,
        appSlug: publicAppSlug,
        dbName,
        docId,
        doc: { _files: { actual: { uploadId: seeded.uploadId, type: "text/plain", size: seeded.size } } },
      });
      const url = fileUrl({ svc }, owner, dbName, docId, "missing", "ghost-upl");
      const res = await processRequest(appCtx.appCtx, new Request(url, { method: "GET" }));
      expect(res.status).toBe(404);
    });

    it("non-_files path on app subdomain falls through to 501 (or close)", async () => {
      const url = `http://${owner.appSlug}--${owner.userSlug}.localhost.vibesdiy.net:8787/__not_files/x/y/z`;
      const res = await processRequest(appCtx.appCtx, new Request(url, { method: "GET" }));
      // Wildcard or doc-fallback — never 200, never 5xx.
      expect([404, 501]).toContain(res.status);
    });

    it("malformed hostname (no `--`) falls through (no slug extraction)", async () => {
      const url = `http://example.com/_files/db/doc/key`;
      const res = await processRequest(appCtx.appCtx, new Request(url, { method: "GET" }));
      // No `<app>--<user>` pattern, so the validate guard passes; wildcard
      // or downstream handler responds — never 200 from our handler.
      expect(res.status).not.toBe(200);
    });

    it("encoded segments round-trip without double-decoding", async () => {
      // Names with `+` and `.` are URL-safe but easy round-trip targets.
      const seeded = await seedAssetUpload(
        appCtx,
        { userSlug: publicUserSlug, appSlug: publicAppSlug, userId: seededUserId },
        "encoded-segments",
        "text/plain"
      );
      const dbName = "default";
      const docId = "doc.with-dots+plus";
      const key = "key.png";
      await owner.api.putDoc({
        userSlug: publicUserSlug,
        appSlug: publicAppSlug,
        dbName,
        docId,
        doc: {
          _files: {
            [key]: { uploadId: seeded.uploadId, type: "text/plain", size: seeded.size, lastModified: 1700000000 },
          },
        },
      });
      const url = fileUrl({ svc }, owner, dbName, docId, key, seeded.uploadId);
      const res = await processRequest(appCtx.appCtx, new Request(url, { method: "GET" }));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe(seeded.bytes);
    });
  });
});
