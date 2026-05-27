// vibes.diy/api/tests/dm-acl.test.ts
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { describe, it, expect } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { directChannelUserSlug, isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

type TestUserInstance = Awaited<ReturnType<typeof createTestUser>>;

async function mkUser(seqUserId: number) {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

  const user = await createTestUser({ sthis, deviceCA, seqUserId });

  const wsPair = TestWSPair.create();
  const wsEvento = vibesMsgEvento();
  const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
  appCtx.vibesCtx.connections.add(wsSendProvider);
  wsPair.p2.onmessage = (event: MessageEvent) => {
    wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  };

  const api = new VibesDiyApi({
    apiUrl: "http://localhost:8787/api",
    ws: wsPair.p1 as unknown as WebSocket,
    timeoutMs: 10000,
    getToken: async () => Result.Ok(await user.getDashBoardToken()),
  });

  // Create a vibe to bind a userSlug
  const rEnsure = await api.ensureAppSlug({
    mode: "dev",
    fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
  });
  if (rEnsure.isErr()) throw new Error(`ensureAppSlug failed: ${rEnsure.Err().message}`);
  const res = rEnsure.Ok();
  if (!isResEnsureAppSlugOk(res)) throw new Error("ensureAppSlug not ok");
  const userSlug = res.userSlug;

  return { api, appCtx, userSlug };
}

describe("DM ACL", { timeout: 20000 }, () => {
  it("non-participant cannot putDoc to a direct channel", async () => {
    const alice = await mkUser(1001);
    const bob = await mkUser(1002);
    const mallory = await mkUser(1003);

    const channel = directChannelUserSlug(alice.userSlug, bob.userSlug);

    const result = await mallory.api.putDoc({
      userSlug: channel,
      appSlug: "dm",
      dbName: "messages",
      doc: { body: "hi", createdAt: new Date().toISOString() },
    });

    expect(result.isErr()).toBe(true);
  });

  it("participant can putDoc to their direct channel", async () => {
    const alice = await mkUser(1010);
    const bob = await mkUser(1020);

    const channel = directChannelUserSlug(alice.userSlug, bob.userSlug);
    const result = await alice.api.putDoc({
      userSlug: channel,
      appSlug: "dm",
      dbName: "messages",
      doc: { body: "hello bob", createdAt: new Date().toISOString() },
    });

    expect(result.isErr()).toBe(false);
    expect(result.Ok().status).toBe("ok");
  });
});
