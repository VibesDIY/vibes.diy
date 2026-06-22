// Contract test: admin whoAmI and doc ops share one connection.
//
// `who-am-i.ts:211` sets `rawSend.adminMode = adminMode === true` on the
// WSSendProvider when the evento handler processes a `vibe.whoAmI` request.
// `connectionAdminMode(ctx)` in app-documents-write-eventos.ts then reads
// `wsSendProvider.adminMode` to decide whether the owner gets "override"
// access. Both the flag-set and the flag-read happen on the SAME connection
// object. This test encodes that contract:
//
//   1. A fresh connection starts with adminMode === false.
//   2. whoAmI with adminMode:true on that connection sets the sticky flag to true.
//   3. whoAmI WITHOUT adminMode (or with adminMode:false) leaves the flag false.
//   4. putDoc on the same connection succeeds when the flag is true (admin write
//      authorized by connectionAdminMode(ctx)).
//
// Scoping note: the connection-scoped adminMode contract lives entirely on the
// server side (WSSendProvider + event handlers). The client-side repoint of
// refreshViewerFromWhoAmI from chatApi to vibeApi (Task 1.2) is a separate
// concern verified independently.

import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

describe("admin whoAmI + putDoc share one connection", { timeout: 30000 }, () => {
  const sthis = ensureSuperThis();
  let ownerApi: VibesDiyApi;
  let wsSendProvider: WSSendProvider;
  let appSlug: string;
  let ownerHandle: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    const ownerUser = await createTestUser({ sthis, deviceCA, seqUserId: 1 });

    // Single WSSendProvider — the doc-op connection.
    // All tests in this describe share this one connection to verify the
    // connection-scoped contract (adminMode is sticky on the WSSendProvider).
    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);

    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    ownerApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await ownerUser.getDashBoardToken()),
    });

    const rRes = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>Admin Connection Test</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) throw new Error("Failed to create app for admin-connection test");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;
  });

  it("connection starts with adminMode === false", () => {
    expect(wsSendProvider.adminMode).toBe(false);
  });

  it("whoAmI with adminMode:true sets the connection adminMode flag (who-am-i.ts:211)", async () => {
    const rWho = await ownerApi.whoAmI({
      tid: crypto.randomUUID(),
      appSlug,
      ownerHandle,
      adminMode: true,
    });
    assert(rWho.isOk(), `whoAmI should succeed: ${rWho.isErr() ? JSON.stringify(rWho.Err()) : ""}`);

    // who-am-i.ts:211 sets rawSend.adminMode = true on the WSSendProvider
    // when the owner calls whoAmI with adminMode:true.
    expect(wsSendProvider.adminMode).toBe(true);
  });

  it("putDoc on the same connection succeeds when adminMode is set (connection-scoped contract)", async () => {
    // The previous test set wsSendProvider.adminMode = true via whoAmI.
    // putDoc on the same connection must succeed — connectionAdminMode(ctx) returns true,
    // checkDocAccess returns "override" for the owner, and the write is authorized.
    expect(wsSendProvider.adminMode).toBe(true);

    const rPut = await ownerApi.putDoc({
      appSlug,
      ownerHandle,
      dbName: "admin-test",
      doc: { title: "admin write" },
      docId: "admin-doc-1",
    });
    assert(rPut.isOk(), `putDoc should succeed under admin connection: ${rPut.isErr() ? JSON.stringify(rPut.Err()) : ""}`);
    expect(rPut.Ok().status).toBe("ok");
  });

  it("whoAmI with adminMode:false clears the connection adminMode flag", async () => {
    // Confirm the flag can be toggled back off.
    const rWho = await ownerApi.whoAmI({
      tid: crypto.randomUUID(),
      appSlug,
      ownerHandle,
      adminMode: false,
    });
    assert(rWho.isOk(), `whoAmI should succeed: ${rWho.isErr() ? JSON.stringify(rWho.Err()) : ""}`);

    // adminMode === false → rawSend.adminMode = false (who-am-i.ts:211)
    expect(wsSendProvider.adminMode).toBe(false);
  });
});
