import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// A `export default function` creates a wildcard ("*") access-fn binding that
// applies to every dbName in the app. With invokeAccessFn stubbed below, the
// source body is not actually executed — the stub decides the descriptor per
// doc.type — but the binding must exist for the write gate to invoke it.
const ACCESS_JS = `export default function (doc, oldDoc, user) {
  if (doc.type === "hat") return { channels: ["cabinet"], grant: { public: ["cabinet"] } };
  return {};
}`;

describe("write gate rejects unreadable (zero-channel) writes", { timeout: 15000 }, () => {
  const sthis = ensureSuperThis();
  let ownerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA, {
      invokeAccessFn: async (params) => {
        const doc = params.doc as { type?: string };
        if (doc.type === "hat") return { channels: ["cabinet"], grant: { public: ["cabinet"] } };
        return {};
      },
    });

    const ownerUser = await createTestUser({ sthis, deviceCA, seqUserId: 100 });

    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
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

    const rSlug = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS },
      ],
    });
    const ok = rSlug.Ok();
    if (!isResEnsureAppSlugOk(ok)) assert.fail("ensureAppSlug failed");
    appSlug = ok.appSlug;
    ownerHandle = ok.ownerHandle;
  });

  it("rejects a write whose access result has no channels", async () => {
    const rRes = await ownerApi.putDoc({
      appSlug,
      ownerHandle,
      dbName: "ImgGen",
      doc: { type: "image", prompt: "a hat" },
    });
    expect(rRes.isErr()).toBe(true);
    expect(rRes.Err().message).toMatch(/no channel|unreadable/i);
    expect(rRes.Err().error.code).toBe("unreadable");
  });

  it("allows a write whose access result has a channel", async () => {
    const rRes = await ownerApi.putDoc({
      appSlug,
      ownerHandle,
      dbName: "hatSmeller",
      doc: { type: "hat", name: "Cumulus Crown" },
    });
    expect(rRes.isOk()).toBe(true);
  });
});

describe("write gate leaves no-access-fn apps untouched", { timeout: 15000 }, () => {
  const sthis = ensureSuperThis();
  let ownerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    // No invokeAccessFn stub and no /access.js → no binding → no channel gating.
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    const ownerUser = await createTestUser({ sthis, deviceCA, seqUserId: 101 });

    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
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

    const rSlug = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    const ok = rSlug.Ok();
    if (!isResEnsureAppSlugOk(ok)) assert.fail("ensureAppSlug failed");
    appSlug = ok.appSlug;
    ownerHandle = ok.ownerHandle;
  });

  it("a channel-less doc still writes fine when there is no access fn", async () => {
    const rRes = await ownerApi.putDoc({
      appSlug,
      ownerHandle,
      dbName: "default",
      doc: { type: "image", prompt: "no access fn here" },
    });
    expect(rRes.isOk()).toBe(true);
  });
});
