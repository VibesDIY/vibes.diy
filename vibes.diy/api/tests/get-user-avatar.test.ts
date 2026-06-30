import { describe, it, expect, beforeEach } from "vitest";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA } from "@vibes.diy/identity/testing";
import { writeHandleBinding, writeHandleAvatar, type VibesApiSQLCtx } from "@vibes.diy/api-svc";
import { string2stream } from "@adviser/cement";
import { handleGetUserAvatar } from "../svc/public/get-user-avatar.js";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Per-handle avatar resolution. The avatar lives in HandleSettings as an
// `active.avatar` whose `currentCid` holds the storage getURL; there is NO
// fallback to a user-level avatar (privacy invariant) — a handle without its own
// avatar returns 404.

describe("GET /u/:ownerHandle/avatar", { timeout: 30000 }, () => {
  const sthis = ensureSuperThis();
  let vctx: VibesApiSQLCtx;
  let avatarGetURL: string;

  beforeEach(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    vctx = appCtx.vibesCtx;

    // Seed handleBinding for alice → user_alice
    const rAlice = await writeHandleBinding(vctx, "user_alice", "alice");
    if (rAlice.isErr()) throw new Error(`Failed to seed alice slug: ${rAlice.Err().message}`);

    // Seed avatar bytes into storage to obtain a real getURL, then write a
    // per-handle active.avatar for alice (currentCid = getURL).
    const avatarBytes = "fake-avatar-image-bytes";
    const [rStore] = await vctx.storage.ensure(string2stream(avatarBytes));
    if (rStore.isErr()) throw new Error(`storage.ensure failed: ${rStore.Err()}`);
    avatarGetURL = rStore.Ok().getURL;

    const rWrite = await writeHandleAvatar(vctx, {
      handle: "alice",
      userId: "user_alice",
      getURL: avatarGetURL,
      mime: "image/png",
    });
    if (rWrite.isErr()) throw new Error(`writeHandleAvatar failed: ${rWrite.Err().message}`);

    // Seed handleBinding for noavatar → user_noavatar with NO HandleSettings row.
    const rNoAvatar = await writeHandleBinding(vctx, "user_noavatar", "noavatar");
    if (rNoAvatar.isErr()) throw new Error(`Failed to seed noavatar slug: ${rNoAvatar.Err().message}`);
  });

  it("302s to the cid-asset URL built from the handle's own avatar getURL", async () => {
    const res = await handleGetUserAvatar(vctx, "alice", undefined);
    expect(res.status).toBe(302);
    expect(res.headers.Location).toContain(encodeURIComponent(avatarGetURL));
    expect(res.headers.ETag).toBe(`"${avatarGetURL}"`);
    expect(res.headers["Cache-Control"]).toBe("max-age=0, must-revalidate");
  });

  it("returns 304 when If-None-Match matches the current ETag", async () => {
    const etag = `"${avatarGetURL}"`;
    const res = await handleGetUserAvatar(vctx, "alice", etag);
    expect(res.status).toBe(304);
    expect(res.headers.ETag).toBe(etag);
  });

  it("404s when ownerHandle is unknown", async () => {
    const res = await handleGetUserAvatar(vctx, "ghost", undefined);
    expect(res.status).toBe(404);
  });

  it("404s when the handle has no avatar of its own (no cross-handle fallback)", async () => {
    const res = await handleGetUserAvatar(vctx, "noavatar", undefined);
    expect(res.status).toBe(404);
  });

  it("redirect URL points to /assets/cid/ with url and mime params", async () => {
    const res = await handleGetUserAvatar(vctx, "alice", undefined);
    expect(res.status).toBe(302);
    const loc = res.headers.Location;
    expect(loc).toMatch(/^\/assets\/cid\/\?/);
    const params = new URLSearchParams(loc.replace(/^\/assets\/cid\/\?/, ""));
    expect(params.get("url")).toBe(avatarGetURL);
    expect(params.get("mime")).toBe("image/png");
  });
});
