import { assert, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { appMsgEvento } from "@vibes.diy/api-svc/app-msg-evento.js";
import { isResEnsureAppSlugOk, isResError, openVibe, type ShardIdentity } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Runtime shard-gate regression suite (#2714). The gate is fail-loud: a request
// whose shard *kind* is not allowed for its (reqType, mode) is rejected with a
// coded `ResError` and the handler never runs; a vibe-keyed op whose
// `owner--slug` does not match the connection's `shardId` is rejected BEFORE any
// D1 write or broadcast (the split-brain defense). These tests drive the real
// vibe-plane evento (`appMsgEvento`, which routes through `handlersForShard` →
// `gated`) with a `shardIdentity` stamped on the AppContext, exactly as the DO
// does. No mocking — broadcast/doc-change callbacks are captured via the test
// ctx, and persistence is asserted by querying the SQL tables directly.

interface DocChange {
  ownerHandle: string;
  appSlug: string;
  docId: string;
}

// The transport rejects a server `res-error` via `mkResError`, which is a
// VibesDiyError (ResError & Error). The typed `.Err()` surfaces as `Error`, so
// narrow with `isResError` to read the coded `error.code`.
function errCode(e: Error): string | undefined {
  return isResError(e) ? e.error.code : undefined;
}

describe("shard gate (#2714)", { timeout: 30000 }, () => {
  const sthis = ensureSuperThis();
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let api: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;
  let vibeKey: string;
  const docChanges: DocChange[] = [];
  const viewerGrantEvents: unknown[] = [];

  // The vibe-plane evento driven for the GATED assertions below. Setup (which
  // includes the CODEGEN_ONLY `ensureAppSlug` op) runs ungated through
  // `vibesMsgEvento`; once the app exists we stamp `shardIdentity` on the
  // AppContext and rewire onmessage to `appMsgEvento` so the gate is live.
  const vibePlane = appMsgEvento();

  function setShardIdentity(id: ShardIdentity): void {
    appCtx.appCtx.set("shardIdentity", id);
  }

  async function docCount(owner: string, slug: string, dbName: string, docId: string): Promise<number> {
    const t = appCtx.vibesCtx.sql.tables.appDocuments;
    const rows = await appCtx.vibesCtx.sql.db
      .select({ seq: t.seq })
      .from(t)
      .where(and(eq(t.ownerHandle, owner), eq(t.appSlug, slug), eq(t.dbName, dbName), eq(t.docId, docId)));
    return rows.length;
  }

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA, {
      notifyDocChanged: async (evt) => {
        docChanges.push({ ownerHandle: evt.ownerHandle, appSlug: evt.appSlug, docId: evt.docId });
      },
      notifyViewerGrantsChanged: async (evt) => {
        viewerGrantEvents.push(evt);
      },
    });
    const testUser = await createTestUser({ sthis, deviceCA });

    const wsPair = TestWSPair.create();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);

    // Setup path: ungated monolith evento so the CODEGEN_ONLY `ensureAppSlug`
    // op (used to mint the app) is not rejected by the gate.
    const setupEvento = vibesMsgEvento();
    wsPair.p2.onmessage = (event: MessageEvent) => {
      setupEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    api = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await testUser.getDashBoardToken()),
    });

    const rRes = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return <div>Test</div>; } App();` },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app for test");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;
    vibeKey = openVibe(ownerHandle, appSlug);

    // Switch onmessage to the GATED vibe plane for all the assertions below.
    wsPair.p2.onmessage = (event: MessageEvent) => {
      vibePlane.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };
  }, 30000);

  it("rejects open-chat {mode:codegen} on a vibe shard (wrong-shard-kind), handler does not run", async () => {
    // codegen mode → codegen shard only. On a vibe shard, the kind+mode gate
    // must reject before any chat resolution. shardId is a foreign-but-valid key.
    setShardIdentity({ kind: "vibe", shardId: openVibe("alice", "todo") });
    const before = docChanges.length;

    const rRes = await api.openChat({ mode: "codegen", appSlug, ownerHandle });
    expect(rRes.isErr()).toBe(true);
    expect(errCode(rRes.Err())).toBe("wrong-shard-kind");
    // Handler never ran: no resolution side effects, no broadcast.
    expect(docChanges.length).toBe(before);
  });

  it("rejects put-doc whose owner--slug != shardId (wrong-shard): no persist, no broadcast", async () => {
    // The split-brain regression. shardId is "alice--todo" but the op addresses
    // (ownerHandle, appSlug) — a real, persistable app. The identity gate must
    // fire BEFORE the write and the broadcast.
    setShardIdentity({ kind: "vibe", shardId: openVibe("alice", "todo") });
    const docId = `split-brain-${sthis.nextId(4).str}`;
    const beforeBroadcasts = docChanges.length;

    const rRes = await api.putDoc({ ownerHandle, appSlug, dbName: "test", doc: { title: "should-not-persist" }, docId });
    expect(rRes.isErr()).toBe(true);
    expect(errCode(rRes.Err())).toBe("wrong-shard");

    // No doc persisted under the legitimate key...
    expect(await docCount(ownerHandle, appSlug, "test", docId)).toBe(0);
    // ...and no broadcast emitted.
    expect(docChanges.length).toBe(beforeBroadcasts);
  });

  it("allows a put-doc whose owner--slug matches shardId (behavior preserved)", async () => {
    setShardIdentity({ kind: "vibe", shardId: vibeKey });
    const docId = `legit-${sthis.nextId(4).str}`;

    const rRes = await api.putDoc({ ownerHandle, appSlug, dbName: "test", doc: { title: "persist-me" }, docId });
    expect(rRes.isOk()).toBe(true);
    expect(rRes.Ok().status).toBe("ok");
    expect(rRes.Ok().id).toBe(docId);

    // The write landed.
    expect(await docCount(ownerHandle, appSlug, "test", docId)).toBe(1);

    // And a read round-trips through the gated plane too.
    const rGet = await api.getDoc({ ownerHandle, appSlug, dbName: "test", docId });
    expect(rGet.isOk()).toBe(true);
    expect(rGet.Ok().status).toBe("ok");
  });

  it("allows a shared-safe op carrying a FOREIGN vibe key on a vibe shard (asset-upload-grant for _profile)", async () => {
    // The avatar-upload regression: on a vibe page sharedApi === vibeApi, so an
    // ALL_SHARDS grant request for `<owner>--_profile` rides THIS vibe's shard.
    // It carries ownerHandle/appSlug inline (structurally "vibe-keyed"), but it's
    // shard-stateless, so the identity gate must NOT reject it for not matching
    // the connection's shardId. Set the shard to the legit app and request a
    // grant for a different appSlug (_profile) under the same owner.
    setShardIdentity({ kind: "vibe", shardId: vibeKey });

    const rRes = await api.requestAssetUploadGrant({ ownerHandle, appSlug: "_profile", mimeType: "image/png" });
    // Not a wrong-shard rejection — the gate let it through to the handler. (The
    // handler may still deny on access, but never with a shard error.)
    if (rRes.isErr()) {
      expect(errCode(rRes.Err())).not.toBe("wrong-shard");
      expect(errCode(rRes.Err())).not.toBe("wrong-shard-kind");
    } else {
      expect(rRes.Ok().type).toBe("vibes.diy.res-asset-upload-grant");
    }
  });

  it("rejects open-chat {mode:img} whose resolved app != vibe shard (post-resolution wrong-shard)", async () => {
    // img mode is allowed on the vibe shard (kind+mode gate passes), so the
    // post-resolution identity gate in open-chat is what must catch a resolved
    // app that does not address THIS shard. shardId is a foreign key.
    setShardIdentity({ kind: "vibe", shardId: openVibe("someone-else", "other-app") });

    const rRes = await api.openChat({ mode: "img", appSlug, ownerHandle });
    expect(rRes.isErr()).toBe(true);
    expect(errCode(rRes.Err())).toBe("wrong-shard");
  });
});
