import { assert, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Regression for VibesDIY/vibes.diy#2275: the document write path must hand the
// access function the writer's ACTIVE handle (their defaultHandle setting) — the
// same handle who-am-i puts on the viewer payload. Before the shared resolver,
// the write path used a bare unordered `handleBinding ... limit(1)`, so a
// multi-handle user published as one handle but was validated as another →
// spurious `{ forbidden: "not author" }`.
//
// A mock invokeAccessFn stands in for the AccessFnDO and enforces the same rule
// a real access.js would: a write is allowed only when doc.authorHandle equals
// the resolved user.userHandle. The client honestly stamps its active handle as
// authorHandle, so the server must resolve the same one.
const ACCESS_JS_AUTHOR = `export default function(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
  return { channels: ["gallery"], grant: { public: ["gallery"] } };
}`;

describe("write path resolves the active (default) handle for access fns (#2275)", { timeout: 30000 }, () => {
  const sthis = ensureSuperThis();
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;
  const seenUsers: ({ userHandle?: string } | null)[] = [];
  const ALT_HANDLE = "owner-alt-handle";

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA, {
      invokeAccessFn: async (params) => {
        const user = params.user as { userHandle?: string } | null;
        seenUsers.push(user);
        const doc = params.doc as { authorHandle?: string };
        if (!user) return { forbidden: "sign in" };
        if (doc.authorHandle !== user.userHandle) return { forbidden: "not author" };
        return { channels: ["gallery"], grant: { public: ["gallery"] } };
      },
    });
    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    const user = await createTestUser({ sthis, deviceCA, seqUserId: 920 });
    ownerApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await user.getDashBoardToken()),
    });

    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_AUTHOR },
      ],
    });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;

    // The owner's auto-assigned handle was inserted first, so a bare unordered
    // limit(1) returns it. Bind a SECOND handle to the same userId and make it
    // the user's default — this is the multi-handle divergence #2275 describes.
    const t = appCtx.vibesCtx.sql.tables;
    const ownerRow = await appCtx.vibesCtx.sql.db
      .select({ userId: t.handleBinding.userId })
      .from(t.handleBinding)
      .where(eq(t.handleBinding.handle, ownerHandle))
      .limit(1)
      .then((rows) => rows[0]);
    assert(ownerRow !== undefined, "owner handleBinding row must exist");
    const userId = ownerRow.userId;
    const now = new Date().toISOString();

    await appCtx.vibesCtx.sql.db
      .insert(t.handleBinding)
      .values({ userId, handle: ALT_HANDLE, tenant: "t-owner-alt", created: now })
      .onConflictDoNothing();
    await appCtx.vibesCtx.sql.db
      .insert(t.userSettings)
      .values({ userId, settings: [{ type: "defaultHandle", ownerHandle: ALT_HANDLE }], updated: now, created: now })
      .onConflictDoUpdate({
        target: t.userSettings.userId,
        set: { settings: [{ type: "defaultHandle", ownerHandle: ALT_HANDLE }], updated: now },
      });
  }, 30000);

  it("hands the access fn the active (default) handle, not an arbitrary bound one", async () => {
    seenUsers.length = 0;
    const res = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "caricatures",
      doc: { type: "caricature", authorHandle: ALT_HANDLE, dreamJob: "astronaut chef" },
    });
    expect(res.isOk()).toBe(true);
    expect(seenUsers.at(-1)?.userHandle).toBe(ALT_HANDLE);
  });

  it("rejects a write stamped with a non-active bound handle as not author", async () => {
    const res = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "caricatures",
      doc: { type: "caricature", authorHandle: ownerHandle, dreamJob: "should fail" },
    });
    expect(res.isErr()).toBe(true);
    expect(res.Err().error?.message).toBe("not author");
  });
});
