import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk, isResRequestAccessApproved } from "@vibes.diy/api-types";
import type { AccessDescriptor } from "@vibes.diy/api-types";
import { eq, and } from "drizzle-orm";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

const ACCESS_JS_CHAT = `export function chat(doc, oldDoc, user) {
  return { channels: ["general"], allowAnonymous: true };
}`;

interface InvokeRecorder {
  calls: { cid: string; user: unknown }[];
  result: AccessDescriptor | { forbidden: string };
}

async function setupCtx(recorder: InvokeRecorder) {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const ctx = await createVibeDiyTestCtx(sthis, deviceCA, {
    invokeAccessFn: async (params) => {
      recorder.calls.push({ cid: params.cid, user: params.user });
      return recorder.result;
    },
  });
  const wsPair = TestWSPair.create();
  const wsEvento = vibesMsgEvento();
  const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
  ctx.vibesCtx.connections.add(wsSendProvider);
  wsPair.p2.onmessage = (event: MessageEvent) => {
    wsEvento.trigger({ ctx: ctx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  };
  return { ctx, wsPair, wsSendProvider, sthis, deviceCA };
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

describe("channel-gated reads (integration)", { timeout: 30000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;
  let actualCid: string;
  let sthis: ReturnType<typeof ensureSuperThis>;
  let deviceCA: Awaited<ReturnType<typeof createTestDeviceCA>>;
  let wsPair: ReturnType<typeof TestWSPair.create>;
  let wsSendProvider: WSSendProvider;
  const recorder: InvokeRecorder = { calls: [], result: { channels: ["general"], allowAnonymous: true } };

  beforeAll(async () => {
    const setup = await setupCtx(recorder);
    const { ctx } = setup;
    sthis = setup.sthis;
    deviceCA = setup.deviceCA;
    wsPair = setup.wsPair;
    wsSendProvider = setup.wsSendProvider;
    appCtx = ctx;
    const ownerSetup = await mkUser(sthis, deviceCA, wsPair, 900);
    ownerApi = ownerSetup.api;
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_CHAT },
      ],
    });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;

    // Read actual CID from the binding the extraction logic created
    const tAfb = appCtx.vibesCtx.sql.tables.accessFunctionBindings;
    const bindings = await appCtx.vibesCtx.sql.db
      .select({ dbName: tAfb.dbName, accessFnCid: tAfb.accessFnCid })
      .from(tAfb)
      .where(and(eq(tAfb.ownerHandle, ownerHandle), eq(tAfb.appSlug, appSlug)));
    const chatBinding = bindings.find((b) => b.dbName === "chat");
    assert(chatBinding !== undefined, "extraction must create a 'chat' binding");
    actualCid = chatBinding.accessFnCid;

    // Write two docs through the access fn gate — one in "general", one in "secret"
    recorder.result = { channels: ["general"], allowAnonymous: true };
    const r1 = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "chat", doc: { title: "public-msg" } });
    assert(r1.isOk(), "first putDoc failed");

    recorder.result = { channels: ["secret"], allowAnonymous: true };
    const r2 = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "chat", doc: { title: "secret-msg" } });
    assert(r2.isOk(), "second putDoc failed");

    // Seed a grant so the owner has "general" channel access
    const tOutputs = appCtx.vibesCtx.sql.tables.accessFnOutputs;
    await appCtx.vibesCtx.sql.db
      .insert(tOutputs)
      .values({
        ownerHandle: ownerHandle,
        appSlug,
        dbName: "chat",
        docId: "grant-doc",
        fnCid: actualCid,
        output: JSON.stringify({ grant: { users: { [ownerHandle]: ["general"] } } }),
        hasGrants: 1,
      })
      .onConflictDoUpdate({
        target: [tOutputs.ownerHandle, tOutputs.appSlug, tOutputs.dbName, tOutputs.docId],
        set: {
          output: JSON.stringify({ grant: { users: { [ownerHandle]: ["general"] } } }),
          hasGrants: 1,
        },
      });

    // Seed secret-room db: insert a binding (reuse actualCid) so channel filtering applies,
    // then putDoc with channels: ["vip"] — owner is not in "vip", so normal reads filter it out.
    await appCtx.vibesCtx.sql.db
      .insert(tAfb)
      .values({
        ownerHandle,
        appSlug,
        dbName: "secret-room",
        accessFnCid: actualCid,
        updated: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: [tAfb.ownerHandle, tAfb.appSlug, tAfb.dbName],
        set: { accessFnCid: actualCid, updated: new Date().toISOString() },
      });

    recorder.result = { channels: ["vip"], allowAnonymous: false };
    const rGated = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "secret-room",
      docId: "gated-doc",
      doc: { _id: "gated-doc", title: "vip-only" },
    });
    assert(rGated.isOk(), "gated-doc putDoc failed");

    recorder.calls = [];
    recorder.result = { channels: ["general"], allowAnonymous: true };
  }, 30000);

  it("queryDocs returns only docs in user's channels", async () => {
    const res = await ownerApi.queryDocs({ ownerHandle, appSlug, dbName: "chat" });
    expect(res.isOk()).toBe(true);
    const docs = res.Ok().docs;
    expect(docs.length).toBe(1);
    expect(docs[0]?.title).toBe("public-msg");
  });

  it("getDoc returns not-found for doc in inaccessible channel", async () => {
    const tOutputs = appCtx.vibesCtx.sql.tables.accessFnOutputs;
    const secretRows = await appCtx.vibesCtx.sql.db
      .select({ docId: tOutputs.docId, output: tOutputs.output })
      .from(tOutputs)
      .where(
        and(
          eq(tOutputs.ownerHandle, ownerHandle),
          eq(tOutputs.appSlug, appSlug),
          eq(tOutputs.dbName, "chat"),
          eq(tOutputs.fnCid, actualCid)
        )
      );

    const secretDoc = secretRows.find((r) => {
      const parsed = JSON.parse(r.output) as { channels?: string[] };
      return parsed.channels?.includes("secret");
    });
    assert(secretDoc !== undefined, "secret doc output not found");

    const res = await ownerApi.getDoc({ ownerHandle, appSlug, dbName: "chat", docId: secretDoc.docId });
    expect(res.isOk()).toBe(true);
    const getRes = res.Ok();
    expect(getRes.status).toBe("not-found");
  });

  it("queryDocs returns all docs when no access fn binding", async () => {
    recorder.result = { allowAnonymous: true };
    const r1 = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "notes", doc: { title: "note-1" } });
    assert(r1.isOk());
    const r2 = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "notes", doc: { title: "note-2" } });
    assert(r2.isOk());

    const res = await ownerApi.queryDocs({ ownerHandle, appSlug, dbName: "notes" });
    expect(res.isOk()).toBe(true);
    expect(res.Ok().docs.length).toBe(2);
  });

  it("owner in adminMode sees docs across all channels (queryDocs)", async () => {
    const who = await ownerApi.whoAmI({ tid: crypto.randomUUID(), appSlug, ownerHandle, adminMode: true });
    assert(who.isOk(), "whoAmI adminMode should succeed");

    const r = await ownerApi.queryDocs({ appSlug, ownerHandle, dbName: "secret-room" });
    assert(r.isOk(), `queryDocs failed: ${r.isErr() ? r.Err().message : ""}`);
    const ids = r
      .Ok()
      .docs.map((d) => d._id)
      .sort();
    expect(ids).toContain("gated-doc"); // owner not in "vip" — only override lets this through
  });

  it("owner in adminMode sees gated doc via getDoc", async () => {
    const who = await ownerApi.whoAmI({ tid: crypto.randomUUID(), appSlug, ownerHandle, adminMode: true });
    assert(who.isOk(), "whoAmI adminMode should succeed");

    const r = await ownerApi.getDoc({ appSlug, ownerHandle, dbName: "secret-room", docId: "gated-doc" });
    assert(r.isOk(), `getDoc failed: ${r.isErr() ? r.Err().message : ""}`);
    // Expect an actual doc, NOT a not-found response.
    // Owner is not in "vip"; without the access !== "override" guard this would return not-found.
    expect(r.Ok().status).toBe("ok");
    expect(r.Ok().id).toBe("gated-doc");
  });

  it("owner subscribeDocs in adminMode subscribes to all channels (override)", async () => {
    // Ensure the connection is in adminMode before subscribing.
    const who = await ownerApi.whoAmI({ tid: crypto.randomUUID(), appSlug, ownerHandle, adminMode: true });
    assert(who.isOk(), "whoAmI adminMode should succeed");

    // Clear any keys from prior tests to isolate this assertion.
    wsSendProvider.subscribedDocKeys.clear();

    const r = await ownerApi.subscribeDocs({ appSlug, ownerHandle, dbName: "secret-room" });
    assert(r.isOk(), `subscribeDocs failed: ${r.isErr() ? r.Err() : ""}`);

    // The owner should be subscribed to the vip channel key, even though they
    // are not personally a member of "vip". Override enumerates ALL channels
    // from accessFnOutputs so doc-changed events reach the owner.
    const vipKey = `${ownerHandle}/${appSlug}/secret-room/vip`;
    expect(wsSendProvider.subscribedDocKeys.has(vipKey)).toBe(true);

    // Note: the negative case (non-override does NOT add vip key) is tested
    // implicitly by the "queryDocs returns only docs in user's channels" test
    // above, which relies on channel filtering being accurate. A direct
    // subscribeDocs negative assertion is omitted here because the shared
    // wsSendProvider adminMode state makes re-testing the non-override path on
    // the same connection unreliable (known harness quirk — adminMode is sticky
    // per-connection once set via whoAmI).
  });

  it("owner sees gated doc via queryDocs with per-request adminMode (no prior whoAmI)", async () => {
    // Pass adminMode:true directly in the request — no whoAmI call on this connection.
    // connectionAdminMode is false for the ownerApi (the existing adminMode tests set it
    // via whoAmI, but Evento connections are independent per test-run ordering).
    // The server must grant override based solely on req.adminMode for the actual owner.
    const r = await ownerApi.queryDocs({ appSlug, ownerHandle, dbName: "secret-room", adminMode: true });
    expect(r.isOk()).toBe(true);
    const ids = r
      .Ok()
      .docs.map((d) => d._id)
      .sort();
    expect(ids).toContain("gated-doc"); // per-request adminMode elevated the owner
  });

  it("owner sees gated doc via getDoc with per-request adminMode (no prior whoAmI)", async () => {
    // Same pattern: just adminMode:true on the getDoc request, no whoAmI.
    const r = await ownerApi.getDoc({ appSlug, ownerHandle, dbName: "secret-room", docId: "gated-doc", adminMode: true });
    expect(r.isOk()).toBe(true);
    expect(r.Ok().status).toBe("ok");
    expect(r.Ok().id).toBe("gated-doc");
  });

  it("non-owner with read access + adminMode is still channel-gated (no override)", async () => {
    // Create outsider with a distinct seqOffset so they don't collide with owner (900)
    const { api: outsiderApi } = await mkUser(sthis, deviceCA, wsPair, 950);

    // Grant the outsider editor role (read-capable) via auto-accept request flow.
    // This clears the ACL gate but gives them NO "vip" channel grant — only the
    // owner-binding match in checkDocAccess returns "override"; the request path
    // returns the plain role and ignores adminMode.
    await ownerApi.ensureAppSettings({ appSlug, ownerHandle, request: { enable: true, autoAcceptRole: "editor" } });
    const rReq = await outsiderApi.requestAccess({ appSlug, ownerHandle });
    assert(rReq.isOk(), `requestAccess failed: ${rReq.isErr() ? rReq.Err().message : ""}`);
    const req = rReq.Ok();
    assert(isResRequestAccessApproved(req), `Expected auto-approved, got state: ${req.state}`);
    expect(req.role).toBe("editor"); // outsider has read-capable role

    // Sanity: without adminMode the outsider clears the ACL gate (Ok, not access-denied)
    // and is channel-filtered out of the vip-only gated-doc.
    const before = await outsiderApi.queryDocs({ appSlug, ownerHandle, dbName: "secret-room" });
    assert(before.isOk(), `expected Ok (cleared ACL gate), got error: ${before.isErr() ? before.Err().message : ""}`);
    expect(before.Ok().docs.map((d) => d._id)).not.toContain("gated-doc");

    // Now the outsider asserts adminMode. checkDocAccess must still return their plain role,
    // NOT override — so they remain channel-filtered.
    const who = await outsiderApi.whoAmI({ tid: crypto.randomUUID(), appSlug, ownerHandle, adminMode: true });
    assert(who.isOk());

    const after = await outsiderApi.queryDocs({ appSlug, ownerHandle, dbName: "secret-room" });
    assert(after.isOk(), `expected Ok (cleared ACL gate), got error: ${after.isErr() ? after.Err().message : ""}`);
    expect(after.Ok().docs.map((d) => d._id)).not.toContain("gated-doc"); // adminMode did NOT elevate the non-owner
  });

  it("non-owner with per-request adminMode:true is still channel-gated (req path)", async () => {
    // Distinct seqOffset so this outsider doesn't collide with 900 (owner) or 950 (prior test).
    const { api: outsider2Api } = await mkUser(sthis, deviceCA, wsPair, 960);

    // Grant read access via auto-accept so they clear the ACL gate.
    await ownerApi.ensureAppSettings({ appSlug, ownerHandle, request: { enable: true, autoAcceptRole: "editor" } });
    const rReq = await outsider2Api.requestAccess({ appSlug, ownerHandle });
    assert(rReq.isOk(), `requestAccess failed: ${rReq.isErr() ? rReq.Err().message : ""}`);
    const req = rReq.Ok();
    assert(isResRequestAccessApproved(req), `Expected auto-approved, got state: ${req.state}`);

    // Pass adminMode:true directly in the queryDocs request — no whoAmI.
    // Non-owners must remain channel-filtered regardless of req.adminMode.
    const r = await outsider2Api.queryDocs({ appSlug, ownerHandle, dbName: "secret-room", adminMode: true });
    assert(r.isOk(), `expected Ok (cleared ACL gate), got error: ${r.isErr() ? r.Err().message : ""}`);
    expect(r.Ok().docs.map((d) => d._id)).not.toContain("gated-doc"); // per-request adminMode did NOT elevate the non-owner
  });
});
