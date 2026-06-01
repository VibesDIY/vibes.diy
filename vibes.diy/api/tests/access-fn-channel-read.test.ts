import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import type { AccessDescriptor } from "@vibes.diy/api-types";
import { eq, and } from "drizzle-orm";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

const CID = "test-channel-read-cid";

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

describe("channel-gated reads (integration)", { timeout: 30000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;
  const recorder: InvokeRecorder = { calls: [], result: { channels: ["general"], allowAnonymous: true } };

  beforeAll(async () => {
    const { ctx, wsPair, sthis, deviceCA } = await setupCtx(recorder);
    appCtx = ctx;
    const ownerSetup = await mkUser(sthis, deviceCA, wsPair, 900);
    ownerApi = ownerSetup.api;
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return null; } App();`,
        },
      ],
    });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;

    // Seed access fn binding for "chat" db
    await appCtx.vibesCtx.sql.db.insert(appCtx.vibesCtx.sql.tables.accessFunctionBindings).values({
      userSlug: ownerHandle,
      appSlug,
      dbName: "chat",
      accessFnCid: CID,
      updated: new Date().toISOString(),
    });

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
        userSlug: ownerHandle,
        appSlug,
        dbName: "chat",
        docId: "grant-doc",
        fnCid: CID,
        output: JSON.stringify({ grant: { users: { [ownerHandle]: ["general"] } } }),
        hasGrants: 1,
      })
      .onConflictDoUpdate({
        target: [tOutputs.userSlug, tOutputs.appSlug, tOutputs.dbName, tOutputs.docId],
        set: {
          output: JSON.stringify({ grant: { users: { [ownerHandle]: ["general"] } } }),
          hasGrants: 1,
        },
      });

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
        and(eq(tOutputs.userSlug, ownerHandle), eq(tOutputs.appSlug, appSlug), eq(tOutputs.dbName, "chat"), eq(tOutputs.fnCid, CID))
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
});
