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
import { ensureSuperThis } from "@vibes.diy/identity";
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

    // Fixed session string so userId is deterministic per seqUserId.
    const session = "admin-connection-test";
    const ownerUser = await createTestUser({ sthis, deviceCA, session, seqUserId: 1 });

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
    // Set adminMode:true explicitly so this test is self-contained and not
    // dependent on the ordering of previous tests.
    const rWho = await ownerApi.whoAmI({
      tid: crypto.randomUUID(),
      appSlug,
      ownerHandle,
      adminMode: true,
    });
    assert(rWho.isOk(), `whoAmI should succeed: ${rWho.isErr() ? JSON.stringify(rWho.Err()) : ""}`);
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
    // First set adminMode:true so this test is self-contained and not
    // dependent on the ordering of previous tests.
    const rWhoTrue = await ownerApi.whoAmI({
      tid: crypto.randomUUID(),
      appSlug,
      ownerHandle,
      adminMode: true,
    });
    assert(rWhoTrue.isOk(), `whoAmI(true) should succeed: ${rWhoTrue.isErr() ? JSON.stringify(rWhoTrue.Err()) : ""}`);
    expect(wsSendProvider.adminMode).toBe(true);

    // Now confirm the flag can be toggled back off.
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

  // Regression tests for the "plain whoAmI omits adminMode" fix (who-am-i.ts).
  //
  // Before the fix, `rawSend.adminMode = adminMode === true` was unconditional —
  // a plain whoAmI (no adminMode field, so adminMode === undefined) would evaluate
  // `undefined === true` → false and STOMP the flag. After the fix, the write is
  // gated on `adminMode !== undefined` so an omitted field preserves prior state.

  it("plain whoAmI (no adminMode field) preserves a previously-set adminMode:true flag", async () => {
    // Set the flag to true first.
    const rSet = await ownerApi.whoAmI({
      tid: crypto.randomUUID(),
      appSlug,
      ownerHandle,
      adminMode: true,
    });
    assert(rSet.isOk(), `whoAmI(true) should succeed: ${rSet.isErr() ? JSON.stringify(rSet.Err()) : ""}`);
    expect(wsSendProvider.adminMode).toBe(true);

    // Plain whoAmI — adminMode field absent entirely.
    // Before the fix this would set adminMode = false (stomping the flag).
    // After the fix, the flag must remain true.
    const rPlain = await ownerApi.whoAmI({
      tid: crypto.randomUUID(),
      appSlug,
      ownerHandle,
      // adminMode intentionally omitted
    });
    assert(rPlain.isOk(), `plain whoAmI should succeed: ${rPlain.isErr() ? JSON.stringify(rPlain.Err()) : ""}`);

    expect(wsSendProvider.adminMode).toBe(true); // must NOT be cleared
  });

  it("explicit adminMode:false after plain whoAmI still clears the flag", async () => {
    // Set the flag to true.
    const rSet = await ownerApi.whoAmI({ tid: crypto.randomUUID(), appSlug, ownerHandle, adminMode: true });
    assert(rSet.isOk());
    expect(wsSendProvider.adminMode).toBe(true);

    // Plain whoAmI preserves it.
    const rPlain = await ownerApi.whoAmI({ tid: crypto.randomUUID(), appSlug, ownerHandle });
    assert(rPlain.isOk());
    expect(wsSendProvider.adminMode).toBe(true);

    // Explicit false must still clear it.
    const rClear = await ownerApi.whoAmI({ tid: crypto.randomUUID(), appSlug, ownerHandle, adminMode: false });
    assert(rClear.isOk());
    expect(wsSendProvider.adminMode).toBe(false);
  });
});
