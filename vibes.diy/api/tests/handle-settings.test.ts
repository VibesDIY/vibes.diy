import { describe, it, expect, beforeEach } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { readHandleAvatar, writeHandleAvatar, deleteHandleSettings, type VibesApiSQLCtx } from "@vibes.diy/api-svc";
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
