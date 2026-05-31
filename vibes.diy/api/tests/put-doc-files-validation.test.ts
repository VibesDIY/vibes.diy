import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, string2stream, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Phase 3 of Stage B: putDoc validates every `_files.<key>.uploadId`
// against AssetUploads. Three rejection paths covered:
//   1. unknown uploadId (typo or stale).
//   2. foreign uploadId (minted for a different app — paste-attack).
//   3. uploadId minted for the same ownerHandle but a different appSlug.
// Plus the happy path: valid uploadId for this exact app → accepted.
//
// See vibes.diy/api/svc/public/app-documents.ts validateFilesUploads.

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

interface Seeded {
  readonly uploadId: string;
  readonly cid: string;
}

async function seedAssetUpload(
  ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>,
  binding: { ownerHandle: string; appSlug: string; userId: string },
  bytes: string
): Promise<Seeded> {
  const [rStore] = await ctx.vibesCtx.storage.ensure(string2stream(bytes));
  if (rStore.isErr()) throw new Error(`storage.ensure failed: ${rStore.Err()}`);
  const stored = rStore.Ok();
  const uploadId = `test-upl-${stored.cid.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await ctx.vibesCtx.sql.db.insert(ctx.vibesCtx.sql.tables.assetUploads).values({
    uploadId,
    userId: binding.userId,
    ownerHandle: binding.ownerHandle,
    appSlug: binding.appSlug,
    cid: stored.cid,
    assetURI: stored.getURL,
    size: bytes.length,
    mimeType: "text/plain",
    created: new Date().toISOString(),
  });
  return { uploadId, cid: stored.cid };
}

describe("putDoc _files.uploadId validation (Stage B Phase 3)", { timeout: 30000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let app1Slug: string;
  let app2Slug: string;
  let ownerHandle: string;

  beforeAll(async () => {
    const { ctx, wsPair, sthis, deviceCA } = await setupCtx();
    appCtx = ctx;
    const ownerSetup = await mkUser(sthis, deviceCA, wsPair, 700);
    ownerApi = ownerSetup.api;
    const r1 = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    const res1 = r1.Ok();
    if (!isResEnsureAppSlugOk(res1)) assert.fail("Failed to create app1");
    app1Slug = res1.appSlug;
    ownerHandle = res1.ownerHandle;
    const r2 = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    const res2 = r2.Ok();
    if (!isResEnsureAppSlugOk(res2)) assert.fail("Failed to create app2");
    app2Slug = res2.appSlug;
  }, 30000);

  it("accepts a put referencing a valid uploadId minted for this app", async () => {
    const seeded = await seedAssetUpload(appCtx, { ownerHandle, appSlug: app1Slug, userId: "test-user" }, "valid-bytes");
    const res = await ownerApi.putDoc({
      ownerHandle,
      appSlug: app1Slug,
      dbName: "default",
      doc: { _files: { photo: { uploadId: seeded.uploadId, type: "text/plain", size: 11 } } },
    });
    expect(res.isOk()).toBe(true);
  });

  it("rejects a put referencing an unknown uploadId", async () => {
    const res = await ownerApi.putDoc({
      ownerHandle,
      appSlug: app1Slug,
      dbName: "default",
      doc: { _files: { photo: { uploadId: "test-upl-bogus-id", type: "text/plain", size: 1 } } },
    });
    expect(res.isErr()).toBe(true);
    expect(res.Err().error?.message).toContain("Invalid file reference");
  });

  it("rejects a put referencing an uploadId minted for a different app (paste-attack)", async () => {
    const seeded = await seedAssetUpload(appCtx, { ownerHandle, appSlug: app2Slug, userId: "test-user" }, "foreign-bytes");
    const res = await ownerApi.putDoc({
      ownerHandle,
      appSlug: app1Slug,
      dbName: "default",
      doc: { _files: { photo: { uploadId: seeded.uploadId, type: "text/plain", size: 13 } } },
    });
    expect(res.isErr()).toBe(true);
    expect(res.Err().error?.message).toContain("Invalid file reference");
  });

  it("docs without _files write through unchanged (no-op for legacy data)", async () => {
    const res = await ownerApi.putDoc({
      ownerHandle,
      appSlug: app1Slug,
      dbName: "default",
      doc: { title: "no files here" },
    });
    expect(res.isOk()).toBe(true);
  });

  it("entries that aren't in {uploadId, type, size} shape pass through (no-op)", async () => {
    // Some other shape — e.g. a legacy data field happens to be named _files
    const res = await ownerApi.putDoc({
      ownerHandle,
      appSlug: app1Slug,
      dbName: "default",
      doc: { _files: { unrelated: "just a string" } },
    });
    expect(res.isOk()).toBe(true);
  });

  it("rejects when one of multiple _files entries is invalid (all-or-nothing)", async () => {
    const goodSeed = await seedAssetUpload(appCtx, { ownerHandle, appSlug: app1Slug, userId: "test-user" }, "good-of-mixed");
    const res = await ownerApi.putDoc({
      ownerHandle,
      appSlug: app1Slug,
      dbName: "default",
      doc: {
        _files: {
          good: { uploadId: goodSeed.uploadId, type: "text/plain", size: 12 },
          bad: { uploadId: "test-upl-also-bogus", type: "text/plain", size: 1 },
        },
      },
    });
    expect(res.isErr()).toBe(true);
    expect(res.Err().error?.message).toContain("Invalid file reference");
  });
});
