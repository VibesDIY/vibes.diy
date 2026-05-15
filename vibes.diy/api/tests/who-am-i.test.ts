import { describe, it, expect, beforeAll } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk, isResRequestAccessApproved, COMMENTS_DB_NAME, COMMENTS_DEFAULT_ACL } from "@vibes.diy/api-types";
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
    expect(r.viewer?.avatarUrl.includes("//u/")).toBe(false);
  });

  it("strips trailing slashes from apiBaseUrl so the avatar URL never doubles up", async () => {
    const res = await resolveWhoAmI(vibesCtx, {
      auth: makeAuth(aliceUserId, "alice-test"),
      appSlug,
      ownerUserSlug: userSlug,
      apiBaseUrl: "https://api.test/",
    });
    expect(res.isOk()).toBe(true);
    const r = res.Ok();
    expect(r.viewer?.avatarUrl).toBe(`https://api.test/u/${userSlug}/avatar`);
    expect(r.viewer?.avatarUrl.includes("//u/")).toBe(false);
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
    expect(r.viewer?.avatarUrl.includes("//u/")).toBe(false);
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

  it("returns COMMENTS_DEFAULT_ACL for comments when no override is configured", async () => {
    // The outer beforeAll configures an explicit comments override on `appSlug`.
    // We need an app without any dbAcl override. Create a fresh isolated context.
    const freshDeviceCA = await createTestDeviceCA(sthis);
    const freshCtx = await createVibeDiyTestCtx(sthis, freshDeviceCA);
    const freshSession = "who-am-i-no-override";
    const freshUser = await createTestUser({ sthis, deviceCA: freshDeviceCA, session: freshSession, seqUserId: 1 });

    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    freshCtx.vibesCtx.connections.add(wsSendProvider);
    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: freshCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };
    const freshApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await freshUser.getDashBoardToken()),
    });
    const rFresh = await freshApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>No-Override Test</div>; } App();`,
        },
      ],
    });
    const freshRes = rFresh.Ok();
    if (!isResEnsureAppSlugOk(freshRes)) throw new Error("Failed to create no-override app");

    const res = await resolveWhoAmI(freshCtx.vibesCtx, {
      auth: undefined,
      appSlug: freshRes.appSlug,
      ownerUserSlug: freshRes.userSlug,
      apiBaseUrl: "https://api.test",
    });
    expect(res.isOk()).toBe(true);
    // When no explicit comments override is stored, the lazy default is injected.
    expect(res.Ok().dbAcls?.[COMMENTS_DB_NAME]).toEqual(COMMENTS_DEFAULT_ACL);
  });

  it("explicit comments override is returned as-is (not replaced by COMMENTS_DEFAULT_ACL)", async () => {
    // The beforeAll configures { write: ["members"] } for `appSlug` — without a
    // `delete` key. Confirm that the stored value is returned verbatim, not merged
    // with COMMENTS_DEFAULT_ACL (which has both write and delete).
    const res = await resolveWhoAmI(vibesCtx, {
      auth: undefined,
      appSlug,
      ownerUserSlug: userSlug,
      apiBaseUrl: "https://api.test",
    });
    expect(res.isOk()).toBe(true);
    const commentAcl = res.Ok().dbAcls?.[COMMENTS_DB_NAME];
    expect(commentAcl).toBeDefined();
    expect(commentAcl?.write).toEqual(["members"]);
    // delete is absent because the explicit override didn't include it.
    expect(commentAcl?.delete).toBeUndefined();
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
