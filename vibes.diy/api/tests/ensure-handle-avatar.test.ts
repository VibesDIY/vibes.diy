import { describe, it, expect, beforeEach } from "vitest";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { writeHandleBinding, readHandleAvatar, type VibesApiSQLCtx } from "@vibes.diy/api-svc";
import { string2stream } from "@adviser/cement";
import type { ReqEnsureHandleAvatar, ReqWithVerifiedAuth } from "@vibes.diy/api-types";
import { ensureHandleAvatar } from "../svc/public/ensure-handle-avatar.js";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

function authedReq(
  userId: string,
  body: { handle: string; cid: string; mime?: string }
): ReqWithVerifiedAuth<ReqEnsureHandleAvatar> {
  return {
    _auth: { verifiedAuth: { claims: { userId } } },
    type: "vibes.diy.req-ensure-handle-avatar",
    auth: { type: "clerk" },
    ...body,
  } as unknown as ReqWithVerifiedAuth<ReqEnsureHandleAvatar>;
}

describe("ensureHandleAvatar", { timeout: 30000 }, () => {
  const sthis = ensureSuperThis();
  let vctx: VibesApiSQLCtx;
  let aliceGetURL: string;
  let aliceCid: string;

  beforeEach(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    vctx = appCtx.vibesCtx;

    // alice owns handle "alice"
    const r = await writeHandleBinding(vctx, "user_alice", "alice");
    if (r.isErr()) throw new Error(`seed alice: ${r.Err().message}`);

    // alice uploaded an asset (AssetUploads row)
    const [rStore] = await vctx.storage.ensure(string2stream("alice-avatar-bytes"));
    if (rStore.isErr()) throw new Error(`store: ${rStore.Err()}`);
    aliceCid = rStore.Ok().cid;
    aliceGetURL = rStore.Ok().getURL;
    await vctx.sql.db.insert(vctx.sql.tables.assetUploads).values({
      uploadId: `up-${Date.now()}`,
      userId: "user_alice",
      ownerHandle: "alice",
      appSlug: "profile",
      cid: aliceCid,
      assetURI: aliceGetURL,
      size: 1,
      mimeType: "image/png",
      created: new Date().toISOString(),
    });
  });

  it("writes the avatar for a handle the caller owns", async () => {
    const res = await ensureHandleAvatar(vctx, authedReq("user_alice", { handle: "alice", cid: aliceCid }));
    expect(res.isOk()).toBe(true);
    expect(res.Ok()).toMatchObject({
      type: "vibes.diy.res-ensure-handle-avatar",
      handle: "alice",
      getURL: aliceGetURL,
      mime: "image/png",
    });
    expect(await readHandleAvatar(vctx, "alice")).toEqual({ getURL: aliceGetURL, mime: "image/png" });
  });

  it("denies writing to a handle the caller does not own", async () => {
    const res = await ensureHandleAvatar(vctx, authedReq("user_mallory", { handle: "alice", cid: aliceCid }));
    expect(res.Ok()).toMatchObject({ type: "vibes.diy.res-error" });
    // Nothing written.
    expect(await readHandleAvatar(vctx, "alice")).toBeUndefined();
  });

  it("rejects a cid the caller never uploaded (no forged getURL)", async () => {
    const res = await ensureHandleAvatar(vctx, authedReq("user_alice", { handle: "alice", cid: "bafyNOTMINE" }));
    expect(res.Ok()).toMatchObject({ type: "vibes.diy.res-error" });
    expect(await readHandleAvatar(vctx, "alice")).toBeUndefined();
  });
});
