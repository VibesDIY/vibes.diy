import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// #2265 A2b: a doc bound to an access function must fail CLOSED when no
// invokeAccessFn is available — never silently write (which would bypass access
// enforcement). Here the ctx is built WITHOUT an invokeAccessFn override (env
// default removed), so the binding exists but no invoker does.

const ACCESS_JS = `export default function(doc, oldDoc, user) {
  return { allowAnonymous: true };
}`;

describe("putDoc fails closed without an access invoker (#2265 A2b)", { timeout: 30000 }, () => {
  let ownerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;

  beforeAll(async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    // No invokeAccessFn passed — vibe-diy-test-ctx leaves it undefined.
    const ctx = await createVibeDiyTestCtx(sthis, deviceCA, {});
    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    ctx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: ctx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    const user = await createTestUser({ sthis, deviceCA, seqUserId: 970 });
    ownerApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await user.getDashBoardToken()),
    });

    // Creating the app with /access.js registers an AccessFunctionBindings row.
    // Backfill no-ops here (no invoker), but the binding still exists — which is
    // exactly the condition the guard must catch on a subsequent write.
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS },
      ],
    });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;
  }, 30000);

  it("rejects an access-bound write when no invoker is available (does not write)", async () => {
    const res = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "default",
      doc: { title: "should be rejected — no invoker" },
    });
    expect(res.isErr()).toBe(true);
    expect(res.Err().error?.message).toBe("Access function unavailable");
  });
});
