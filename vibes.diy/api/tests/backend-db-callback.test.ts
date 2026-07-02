import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@vibes.diy/identity/testing";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import type { AccessDescriptor, MsgBase } from "@vibes.diy/api-types";
import type { VibesApiSQLCtx } from "@vibes.diy/api-svc";
import { and, desc, eq } from "drizzle-orm";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import {
  makeBackendDbCallback,
  resolveBackendWriteIdentity,
  resolveOwnerWriteIdentity,
} from "../svc/intern/backend-db-callback.js";

// createTestUser({ session, seqUserId }) → userId `user-id-${session}-${seqUserId}`.
const OWNER_USER_ID = "user-id-be-db-cb-1";

// access.js exporting a `grants` function → extraction binds the "grants" dbName.
// The actual descriptor comes from the mocked invokeAccessFn recorder (as in
// access-fn-revoke-on-delete.test.ts), so the gate's decision is what we control.
const ACCESS_JS_GRANTS = `export function grants(doc, oldDoc, user) {
  return { channels: [doc._id], grant: { public: [doc._id] } };
}`;

interface Recorder {
  result: AccessDescriptor | { forbidden: string };
}

// Slice B6 (#2856): makeBackendDbCallback — a backend handler's ctx.db write
// re-enters the SAME production gate + seq/allocator path a frontend write uses,
// acting as the trigger identity, with the trusted loop-guard depth.
describe("makeBackendDbCallback (#2856 B6)", { timeout: 30000 }, () => {
  const recorder: Recorder = { result: { channels: ["x"], grant: { public: ["x"] } } };
  let vibesCtx: VibesApiSQLCtx;
  let ownerApi: VibesDiyApi;
  let ownerHandle: string;
  let appSlug: string;
  const posted: MsgBase[] = [];

  beforeAll(async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    const ctx = await createVibeDiyTestCtx(sthis, deviceCA, { invokeAccessFn: async () => recorder.result });
    vibesCtx = ctx.vibesCtx;
    vibesCtx.postQueue = async (msg: MsgBase) => {
      posted.push(msg);
    };
    vibesCtx.params.vibes.env.BACKEND_JS = "loader"; // un-dark the onChange emit so depth is observable

    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    ctx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: ctx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    const user = await createTestUser({ sthis, deviceCA, session: "be-db-cb", seqUserId: 1 }); // → OWNER_USER_ID
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
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_GRANTS },
      ],
    });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;
  });

  async function headRow(dbName: string, docId: string) {
    const t = vibesCtx.sql.tables.appDocuments;
    return vibesCtx.sql.db
      .select({ data: t.data, deleted: t.deleted })
      .from(t)
      .where(and(eq(t.ownerHandle, ownerHandle), eq(t.appSlug, appSlug), eq(t.dbName, dbName), eq(t.docId, docId)))
      .orderBy(desc(t.seq))
      .limit(1)
      .then((rows) => rows[0]);
  }

  async function outputRow(dbName: string, docId: string) {
    const t = vibesCtx.sql.tables.accessFnOutputs;
    return vibesCtx.sql.db
      .select({ docId: t.docId, hasGrants: t.hasGrants })
      .from(t)
      .where(and(eq(t.ownerHandle, ownerHandle), eq(t.appSlug, appSlug), eq(t.dbName, dbName), eq(t.docId, docId)))
      .limit(1)
      .then((rows) => rows[0]);
  }

  const ownerCallback = async (originDepth = 0) => {
    const identity = await resolveOwnerWriteIdentity(vibesCtx, { ownerHandle, appSlug });
    return makeBackendDbCallback(vibesCtx, { ownerHandle, appSlug, identity, originDepth });
  };

  it("put runs the production gate, commits a revision, and upserts the access-fn output", async () => {
    recorder.result = { channels: ["be-1"], grant: { public: ["be-1"] } };
    const db = await ownerCallback();
    const res = await db({ kind: "put", db: "grants", doc: { _id: "be-1", title: "hi" }, docId: "be-1" });
    expect(res).toEqual({ ok: true, id: "be-1" });

    const row = await headRow("grants", "be-1");
    expect(row?.deleted).toBe(0);
    expect((row?.data as { title?: string })?.title).toBe("hi");
    // The sidecar upserted the grant output inside the seq critical section.
    expect((await outputRow("grants", "be-1"))?.hasGrants).toBe(1);
  });

  it("a forbidden gate decision denies the write and surfaces the reason (no revision)", async () => {
    recorder.result = { forbidden: "not allowed" };
    const db = await ownerCallback();
    const res = await db({ kind: "put", db: "grants", doc: { _id: "be-deny", x: 1 }, docId: "be-deny" });
    expect(res).toEqual({ ok: false, error: "not allowed", code: "access-denied" });
    expect(await headRow("grants", "be-deny")).toBeUndefined();
  });

  it("delete writes a tombstone and drops the stored access-fn output (revocation)", async () => {
    recorder.result = { channels: ["be-2"], grant: { public: ["be-2"] } };
    const db = await ownerCallback();
    await db({ kind: "put", db: "grants", doc: { _id: "be-2" }, docId: "be-2" });
    expect(await outputRow("grants", "be-2")).toBeDefined();

    const res = await db({ kind: "delete", db: "grants", docId: "be-2" });
    expect(res).toEqual({ ok: true, id: "be-2" });
    expect((await headRow("grants", "be-2"))?.deleted).toBe(1);
    expect(await outputRow("grants", "be-2")).toBeUndefined();
  });

  it("resolveBackendWriteIdentity maps a writer userId to their active handle (onChange/fetch seam)", async () => {
    const id = await resolveBackendWriteIdentity(vibesCtx, { ownerHandle, appSlug, userId: OWNER_USER_ID });
    expect(id.userId).toBe(OWNER_USER_ID);
    expect(id.userContext?.userHandle).toBe(ownerHandle);
    expect(id.userContext?.isOwner).toBe(true);
  });

  it("resolveBackendWriteIdentity yields a null userContext for an anonymous trigger", async () => {
    const id = await resolveBackendWriteIdentity(vibesCtx, { ownerHandle, appSlug, userId: null });
    expect(id).toEqual({ userId: null, userContext: null });
  });

  it("threads the TRUSTED loop-guard depth into the emitted onChange (guard goes live)", async () => {
    recorder.result = { channels: ["be-3"], grant: { public: ["be-3"] } };
    posted.length = 0;
    const db = await ownerCallback(2); // handler running at generation 2
    await db({ kind: "put", db: "grants", doc: { _id: "be-3" }, docId: "be-3" });
    const onChange = posted.find((m) => (m.payload as { type?: string }).type === "vibes.diy.evt-backend-onChange");
    assert(onChange, "expected an onChange emit");
    // generation 2 write ⇒ onChange at depth 3 (originDepth + 1).
    expect((onChange.payload as { depth?: number }).depth).toBe(3);
    expect((onChange.payload as { writerUserId?: string | null }).writerUserId).toBeTruthy();
  });

  // ── ctx.db.query — the backend read lane ────────────────────────────────────

  it("query denies an access-fn-bound db (no channel-filter bypass)", async () => {
    const db = await ownerCallback();
    const res = await db({ kind: "query", db: "grants" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("access-fn-bound");
  });

  it("query denies an anonymous identity", async () => {
    const db = makeBackendDbCallback(vibesCtx, {
      ownerHandle,
      appSlug,
      identity: { userId: null, userContext: null },
      originDepth: 0,
    });
    const res = await db({ kind: "query", db: "anything" });
    expect(res).toEqual({ ok: false, error: "Access denied", code: "access-denied" });
  });

  it("query returns the latest non-deleted docs (with _id) on a plain-ACL db", async () => {
    // A second app WITHOUT an access.js — every db stays on the plain default ACL.
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create plain app");

    const identity = await resolveOwnerWriteIdentity(vibesCtx, { ownerHandle: res.ownerHandle, appSlug: res.appSlug });
    const db = makeBackendDbCallback(vibesCtx, {
      ownerHandle: res.ownerHandle,
      appSlug: res.appSlug,
      identity,
      originDepth: 0,
    });

    await db({ kind: "put", db: "scores", doc: { _id: "s1", kind: "highscore", score: 10 }, docId: "s1" });
    await db({ kind: "put", db: "scores", doc: { _id: "s2", kind: "highscore", score: 20 }, docId: "s2" });
    await db({ kind: "put", db: "scores", doc: { _id: "s2", kind: "highscore", score: 25 }, docId: "s2" }); // newer rev wins
    await db({ kind: "put", db: "scores", doc: { _id: "s3", kind: "highscore", score: 5 }, docId: "s3" });
    await db({ kind: "delete", db: "scores", docId: "s3" }); // tombstoned → excluded

    const q = await db({ kind: "query", db: "scores" });
    assert(q.ok && "docs" in q, "expected a docs result");
    const byId = new Map(q.docs.map((d) => [d._id, d]));
    expect(byId.size).toBe(2);
    expect(byId.get("s1")).toMatchObject({ kind: "highscore", score: 10 });
    expect(byId.get("s2")).toMatchObject({ kind: "highscore", score: 25 });
    expect(byId.has("s3")).toBe(false);
  });
});
