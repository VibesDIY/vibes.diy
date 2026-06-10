import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

const ACCESS_JS = `export default function(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  return { channels: [doc._id], allowAnonymous: true };
}`;

interface NotifyRec {
  evt: { ownerHandle: string; appSlug: string; dbName: string; docId: string; channel?: string };
  senderConnId: string;
}

describe("doc-changed channel fan-out carries real dbName (#2301)", { timeout: 30000 }, () => {
  let ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let ownerHandle: string;
  let appSlug: string;
  const notifies: NotifyRec[] = [];
  const access = { result: { channels: ["x"], allowAnonymous: true } as unknown };

  beforeAll(async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    ctx = await createVibeDiyTestCtx(sthis, deviceCA, {
      invokeAccessFn: async () => access.result as never,
      notifyDocChanged: async (evt, senderConnId) => {
        notifies.push({ evt, senderConnId });
      },
    });
    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSend = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    ctx.vibesCtx.connections.add(wsSend);
    wsPair.p2.onmessage = (event: MessageEvent) =>
      wsEvento.trigger({ ctx: ctx.appCtx, request: { type: "MessageEvent", event }, send: wsSend });

    const user = await createTestUser({ sthis, deviceCA, seqUserId: 900 });
    ownerApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await user.getDashBoardToken()),
    });
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: "function App(){return null} App();" },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS },
      ],
    });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("app create failed");
    ownerHandle = res.ownerHandle;
    appSlug = res.appSlug;
  }, 30000);

  it("edit on an access-fn vibe notifies per channel with the real dbName", async () => {
    notifies.length = 0;
    access.result = { channels: ["chan-A", "chan-B"], allowAnonymous: true };
    const res = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "default", docId: "d1", doc: { n: 1 } });
    expect(res.Ok().status).toBe("ok");
    expect(notifies.map((n) => n.evt.channel).sort()).toEqual(["chan-A", "chan-B"]);
    for (const n of notifies) {
      expect(n.evt.dbName).toBe("default");
      expect(n.evt.docId).toBe("d1");
    }
  });

  it("all-empty channels fall back to a single dbName notify", async () => {
    notifies.length = 0;
    access.result = { channels: ["", "   "], allowAnonymous: true };
    const res = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "default", docId: "d2", doc: { n: 2 } });
    expect(res.Ok().status).toBe("ok");
    expect(notifies).toHaveLength(1);
    expect(notifies[0].evt.dbName).toBe("default");
    expect(notifies[0].evt.channel).toBeUndefined();
  });

  it("delete on an access-fn vibe fans out per stored channel with real dbName", async () => {
    access.result = { channels: ["del-chan"], allowAnonymous: true };
    await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "default", docId: "d3", doc: { _id: "d3", n: 3 } });

    notifies.length = 0;
    const res = await ownerApi.deleteDoc({ ownerHandle, appSlug, dbName: "default", docId: "d3" });
    expect(res.Ok().status).toBe("ok");
    expect(notifies).toHaveLength(1);
    expect(notifies[0].evt.dbName).toBe("default");
    expect(notifies[0].evt.channel).toBe("del-chan");
    expect(notifies[0].evt.docId).toBe("d3");
  });

  it("delete with no stored output row falls back to a single dbName notify", async () => {
    notifies.length = 0;
    const res = await ownerApi.deleteDoc({ ownerHandle, appSlug, dbName: "default", docId: "d4-never-written" });
    expect(res.Ok().status).toBe("ok");
    expect(notifies).toHaveLength(1);
    expect(notifies[0].evt.dbName).toBe("default");
    expect(notifies[0].evt.channel).toBeUndefined();
  });
});
