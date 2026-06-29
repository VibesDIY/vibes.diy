import { describe, it, expect, beforeEach } from "vitest";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import {
  readHandleAvatar,
  writeHandleAvatar,
  deleteHandleSettings,
  seedDefaultHandleAvatar,
  writeHandleBinding,
  type VibesApiSQLCtx,
} from "@vibes.diy/api-svc";
import { string2stream } from "@adviser/cement";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { eq } from "drizzle-orm";

describe("HandleSettings store", { timeout: 30000 }, () => {
  const sthis = ensureSuperThis();
  let vctx: VibesApiSQLCtx;

  beforeEach(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    vctx = appCtx.vibesCtx;
  });

  it("returns undefined for a handle with no row", async () => {
    expect(await readHandleAvatar(vctx, "nobody")).toBeUndefined();
  });

  it("writes then reads the current avatar (getURL + mime)", async () => {
    const rWrite = await writeHandleAvatar(vctx, { handle: "alice", userId: "u_alice", getURL: "fp:store/v1", mime: "image/png" });
    expect(rWrite.isOk()).toBe(true);
    const got = await readHandleAvatar(vctx, "alice");
    expect(got).toEqual({ getURL: "fp:store/v1", mime: "image/png" });
  });

  it("appends a version and moves currentCid on a second write", async () => {
    await writeHandleAvatar(vctx, { handle: "alice", userId: "u_alice", getURL: "fp:store/v1", mime: "image/png" });
    await writeHandleAvatar(vctx, { handle: "alice", userId: "u_alice", getURL: "fp:store/v2", mime: "image/jpeg" });
    const got = await readHandleAvatar(vctx, "alice");
    expect(got).toEqual({ getURL: "fp:store/v2", mime: "image/jpeg" });

    // History is retained: both versions present on the entry.
    const t = vctx.sql.tables.handleSettings;
    const row = await vctx.sql.db
      .select({ settings: t.settings })
      .from(t)
      .where(eq(t.handle, "alice"))
      .limit(1)
      .then((r) => r[0]);
    const avatar = (row?.settings as { type: string; versions: unknown[] }[]).find((e) => e.type === "active.avatar");
    expect(avatar?.versions).toHaveLength(2);
  });

  it("isolates handles — one user's two handles do not share avatars", async () => {
    await writeHandleAvatar(vctx, { handle: "alice", userId: "u_alice", getURL: "fp:store/alice", mime: "image/png" });
    // Same user, different handle, no avatar set → no fallback, reads undefined.
    expect(await readHandleAvatar(vctx, "alice-dev")).toBeUndefined();
  });

  it("deletes a handle's row scoped by userId", async () => {
    await writeHandleAvatar(vctx, { handle: "alice", userId: "u_alice", getURL: "fp:store/v1", mime: "image/png" });
    // Wrong userId must not delete.
    await deleteHandleSettings(vctx, "alice", "someone_else");
    expect(await readHandleAvatar(vctx, "alice")).toBeDefined();
    // Correct owner deletes.
    await deleteHandleSettings(vctx, "alice", "u_alice");
    expect(await readHandleAvatar(vctx, "alice")).toBeUndefined();
  });
});

describe("seedDefaultHandleAvatar (legacy migration)", { timeout: 30000 }, () => {
  const sthis = ensureSuperThis();
  let vctx: VibesApiSQLCtx;
  let legacyCid: string;
  let legacyGetURL: string;

  beforeEach(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    vctx = appCtx.vibesCtx;

    const r = await writeHandleBinding(vctx, "user_alice", "alice");
    if (r.isErr()) throw new Error(`seed alice: ${r.Err().message}`);

    const [rStore] = await vctx.storage.ensure(string2stream("legacy-avatar-bytes"));
    if (rStore.isErr()) throw new Error(`store: ${rStore.Err()}`);
    legacyCid = rStore.Ok().cid;
    legacyGetURL = rStore.Ok().getURL;
    await vctx.sql.db.insert(vctx.sql.tables.assetUploads).values({
      uploadId: `up-${Date.now()}`,
      userId: "user_alice",
      ownerHandle: "alice",
      appSlug: "profile",
      cid: legacyCid,
      assetURI: legacyGetURL,
      size: 1,
      mimeType: "image/png",
      created: new Date().toISOString(),
    });
  });

  it("seeds the default handle from the legacy avatarCid", async () => {
    await seedDefaultHandleAvatar(vctx, { userId: "user_alice", defaultHandle: "alice", avatarCid: legacyCid });
    expect(await readHandleAvatar(vctx, "alice")).toEqual({ getURL: legacyGetURL, mime: "image/png" });
  });

  it("is idempotent — a second seed does not overwrite a newer avatar", async () => {
    await seedDefaultHandleAvatar(vctx, { userId: "user_alice", defaultHandle: "alice", avatarCid: legacyCid });
    // User sets a new avatar after migration.
    await writeHandleAvatar(vctx, { handle: "alice", userId: "user_alice", getURL: "fp:store/new", mime: "image/jpeg" });
    // Re-running the seed must NOT revert it.
    await seedDefaultHandleAvatar(vctx, { userId: "user_alice", defaultHandle: "alice", avatarCid: legacyCid });
    expect(await readHandleAvatar(vctx, "alice")).toEqual({ getURL: "fp:store/new", mime: "image/jpeg" });
  });

  it("skips when there is no default handle (guardrail 4)", async () => {
    await seedDefaultHandleAvatar(vctx, { userId: "user_alice", defaultHandle: undefined, avatarCid: legacyCid });
    expect(await readHandleAvatar(vctx, "alice")).toBeUndefined();
  });

  it("skips when the user does not own the default handle (guardrail 2)", async () => {
    await seedDefaultHandleAvatar(vctx, { userId: "user_mallory", defaultHandle: "alice", avatarCid: legacyCid });
    expect(await readHandleAvatar(vctx, "alice")).toBeUndefined();
  });

  it("skips when the legacy cid was not uploaded by the user", async () => {
    await seedDefaultHandleAvatar(vctx, { userId: "user_alice", defaultHandle: "alice", avatarCid: "bafyNOTMINE" });
    expect(await readHandleAvatar(vctx, "alice")).toBeUndefined();
  });
});
