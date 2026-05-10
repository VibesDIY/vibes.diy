import { describe, it, expect, beforeAll } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk, isResRequestAccessApproved } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { resolveWhoAmI } from "../svc/public/who-am-i.js";
import type { VibesApiSQLCtx } from "@vibes.diy/api-svc";

describe("resolveWhoAmI", { timeout: 30000 }, () => {
  const sthis = ensureSuperThis();
  let vibesCtx: VibesApiSQLCtx;
  let appSlug: string;
  let userSlug: string; // alice's slug
  let aliceUserId: string;
  let bobUserId: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    vibesCtx = appCtx.vibesCtx;

    // Fixed session string so userIds are deterministic per seqUserId.
    const session = "who-am-i-test";
    const aliceUser = await createTestUser({ sthis, deviceCA, session, seqUserId: 1 });
    const bobUser = await createTestUser({ sthis, deviceCA, session, seqUserId: 2 });

    aliceUserId = `user-id-${session}-1`;
    bobUserId = `user-id-${session}-2`;

    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);

    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    function mkApi(user: Awaited<ReturnType<typeof createTestUser>>) {
      return new VibesDiyApi({
        apiUrl: "http://localhost:8787/api",
        ws: wsPair.p1 as unknown as WebSocket,
        timeoutMs: 10000,
        getToken: async () => Result.Ok(await user.getDashBoardToken()),
      });
    }

    const aliceApi = mkApi(aliceUser);
    const bobApi = mkApi(bobUser);

    // Alice creates an app
    const rRes = await aliceApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>WhoAmI Test</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) throw new Error("Failed to create app for who-am-i test");
    appSlug = res.appSlug;
    userSlug = res.userSlug; // alice's userSlug

    // Set alice's profile with displayName override
    await aliceApi.ensureUserSettings({
      settings: [
        { type: "profile", displayName: "Alice the Great" },
        { type: "defaultUserSlug", userSlug },
      ],
    });

    // Set bob's defaultUserSlug (bob's userSlug will be auto-assigned by the API)
    // Grant bob editor access via request + autoAccept
    await aliceApi.ensureAppSettings({ appSlug, userSlug, request: { enable: true, autoAcceptRole: "editor" } });
    const rBob = await bobApi.requestAccess({ appSlug, userSlug });
    if (!isResRequestAccessApproved(rBob.Ok())) throw new Error("Bob not auto-approved");

    // Read bob's actual userSlug so we can set his defaultUserSlug
    const bobInfoRes = await bobApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>Bob App</div>; } App();`,
        },
      ],
    });
    const bobInfo = bobInfoRes.Ok();
    if (!isResEnsureAppSlugOk(bobInfo)) throw new Error("Failed to create bob app");
    const bobUserSlug = bobInfo.userSlug;

    await bobApi.ensureUserSettings({
      settings: [{ type: "defaultUserSlug", userSlug: bobUserSlug }],
    });

    // Configure app settings with a dbAcl override for "comments"
    await aliceApi.ensureAppSettings({
      appSlug,
      userSlug,
      dbAcl: {
        dbName: "comments",
        acl: { write: ["members"] },
      },
    });
  });

  it("returns null viewer for unauthenticated request", async () => {
    const res = await resolveWhoAmI(vibesCtx, {
      auth: undefined,
      appSlug,
      ownerUserSlug: userSlug,
      apiBaseUrl: "https://api.test",
    });
    expect(res.isOk()).toBe(true);
    const r = res.Ok();
    expect(r.viewer).toBeNull();
    expect(r.access).toBe("none");
  });

  it("returns owner identity + access for the owner", async () => {
    const res = await resolveWhoAmI(vibesCtx, {
      auth: makeAuth(aliceUserId, "alice-test"),
      appSlug,
      ownerUserSlug: userSlug,
      apiBaseUrl: "https://api.test",
    });
    expect(res.isOk()).toBe(true);
    const r = res.Ok();
    expect(r.viewer?.userSlug).toBe(userSlug);
    expect(r.access).toBe("owner");
    expect(r.viewer?.avatarUrl).toBe(`https://api.test/u/${userSlug}/avatar`);
  });

  it("returns viewer userSlug + 'editor' access for an invited editor", async () => {
    const res = await resolveWhoAmI(vibesCtx, {
      auth: makeAuth(bobUserId, "bob-test"),
      appSlug,
      ownerUserSlug: userSlug,
      apiBaseUrl: "https://api.test",
    });
    expect(res.isOk()).toBe(true);
    const r = res.Ok();
    expect(typeof r.viewer?.userSlug).toBe("string");
    expect(r.access).toBe("editor");
    expect(r.viewer?.avatarUrl).toBe(`https://api.test/u/${r.viewer?.userSlug}/avatar`);
  });

  it("returns dbAcls map when the app has configured overrides", async () => {
    const res = await resolveWhoAmI(vibesCtx, {
      auth: makeAuth(aliceUserId, "alice-test"),
      appSlug,
      ownerUserSlug: userSlug,
      apiBaseUrl: "https://api.test",
    });
    expect(res.isOk()).toBe(true);
    expect(res.Ok().dbAcls?.comments?.write).toEqual(["members"]);
  });

  it("uses settings.displayName override when set", async () => {
    const res = await resolveWhoAmI(vibesCtx, {
      auth: makeAuth(aliceUserId, "alice-test"),
      appSlug,
      ownerUserSlug: userSlug,
      apiBaseUrl: "https://api.test",
    });
    expect(res.isOk()).toBe(true);
    expect(res.Ok().viewer?.displayName).toBe("Alice the Great");
  });
});

// Build a minimal VerifiedResult that resolveWhoAmI accepts, using a known userId.
function makeAuth(userId: string, nick: string) {
  return {
    type: "VerifiedAuthResult" as const,
    inDashAuth: { type: "device-id" as const, token: "fake" },
    verifiedAuth: {
      type: "clerk" as const,
      claims: {
        userId,
        role: "user",
        sub: `sub-${userId}`,
        params: {
          email: `${nick}@example.com`,
          email_verified: true,
          first: nick,
          last: "Test",
          name: `${nick} Test`,
          image_url: "",
          public_meta: undefined,
          nick,
        },
      },
    },
  };
}
