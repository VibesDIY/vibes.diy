import { describe, it, expect, beforeEach } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { writeHandleBinding, type VibesApiSQLCtx } from "@vibes.diy/api-svc";
import { string2stream } from "@adviser/cement";
import { handleGetUserAvatar } from "../svc/public/get-user-avatar.js";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

describe("GET /u/:ownerHandle/avatar", { timeout: 30000 }, () => {
  const sthis = ensureSuperThis();
  let vctx: VibesApiSQLCtx;
  let avatarCid: string;
  let avatarAssetURI: string;

  beforeEach(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    vctx = appCtx.vibesCtx;

    // Seed handleBinding for alice → user_alice
    const rAlice = await writeHandleBinding(vctx, "user_alice", "alice");
    if (rAlice.isErr()) throw new Error(`Failed to seed alice slug: ${rAlice.Err().message}`);

    // Seed avatar bytes into storage and AssetUploads
    const avatarBytes = "fake-avatar-image-bytes";
    const [rStore] = await vctx.storage.ensure(string2stream(avatarBytes));
    if (rStore.isErr()) throw new Error(`storage.ensure failed: ${rStore.Err()}`);
    const stored = rStore.Ok();
    avatarCid = stored.cid;
    avatarAssetURI = stored.getURL;

    const uploadId = `test-avatar-upload-${Date.now()}`;
    await vctx.sql.db.insert(vctx.sql.tables.assetUploads).values({
      uploadId,
      userId: "user_alice",
      ownerHandle: "alice",
      appSlug: "profile",
      cid: avatarCid,
      assetURI: avatarAssetURI,
      size: avatarBytes.length,
      mimeType: "image/png",
      created: new Date().toISOString(),
    });

    // Seed userSettings for alice with profile.avatarCid
    const now = new Date().toISOString();
    await vctx.sql.db.insert(vctx.sql.tables.userSettings).values({
      userId: "user_alice",
      settings: [{ type: "profile", avatarCid }],
      updated: now,
      created: now,
    });

    // Seed handleBinding for noavatar → user_noavatar (NO avatar configured)
    const rNoAvatar = await writeHandleBinding(vctx, "user_noavatar", "noavatar");
    if (rNoAvatar.isErr()) throw new Error(`Failed to seed noavatar slug: ${rNoAvatar.Err().message}`);
    // No userSettings row for user_noavatar
  });

  it("302s to cid-asset URL when avatarCid is set", async () => {
    const res = await handleGetUserAvatar(vctx, "alice", undefined);
    expect(res.status).toBe(302);
    expect(res.headers.Location).toContain(encodeURIComponent(avatarAssetURI));
    expect(res.headers.ETag).toBe(`"${avatarCid}"`);
    expect(res.headers["Cache-Control"]).toBe("max-age=0, must-revalidate");
  });

  it("returns 304 when If-None-Match matches the current ETag", async () => {
    const etag = `"${avatarCid}"`;
    const res = await handleGetUserAvatar(vctx, "alice", etag);
    expect(res.status).toBe(304);
    expect(res.headers.ETag).toBe(etag);
  });

  it("404s when ownerHandle is unknown", async () => {
    const res = await handleGetUserAvatar(vctx, "ghost", undefined);
    expect(res.status).toBe(404);
  });

  it("404s when ownerHandle is bound but has no avatarCid", async () => {
    const res = await handleGetUserAvatar(vctx, "noavatar", undefined);
    expect(res.status).toBe(404);
  });

  it("redirect URL points to /assets/cid/ with url and mime params", async () => {
    const res = await handleGetUserAvatar(vctx, "alice", undefined);
    expect(res.status).toBe(302);
    const loc = res.headers.Location;
    expect(loc).toMatch(/^\/assets\/cid\/\?/);
    const params = new URLSearchParams(loc.replace(/^\/assets\/cid\/\?/, ""));
    expect(params.get("url")).toBe(avatarAssetURI);
    expect(params.get("mime")).toBe("image/png");
  });
});
