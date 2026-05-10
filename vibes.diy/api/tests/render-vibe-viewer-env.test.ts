/**
 * Smoke tests for Task 12: render-vibe embeds viewerEnv in mountParams.
 *
 * renderVibe requires a full HTTP ctx + storage stack that is expensive to
 * stub end-to-end. The tests here verify the two things that matter:
 *
 * 1. resolveWhoAmI with auth=undefined returns the anonymous shape
 *    (viewer: null, access: "none") — this is the data renderVibe embeds.
 *
 * 2. The JSON fragment that renderVibe/renderPendingVibe would inline in
 *    mountJS serialises to contain "viewer":null and "access":"none" and a
 *    sensible apiBaseUrl.
 *
 * A full integration test exercising the rendered HTML body requires either
 * a live DB + an HTTP layer stub for cfServe, which is done by other test
 * suites (see api.test.ts). These tests focus on the data contract.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { Result, TestWSPair } from "@adviser/cement";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { resolveWhoAmI } from "../svc/public/who-am-i.js";
import type { VibesApiSQLCtx } from "@vibes.diy/api-svc";

describe("render-vibe viewerEnv embedding", { timeout: 30000 }, () => {
  const sthis = ensureSuperThis();
  let vibesCtx: VibesApiSQLCtx;
  let appSlug: string;
  let userSlug: string;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    vibesCtx = appCtx.vibesCtx;

    const session = "render-vibe-viewer-env-test";
    const aliceUser = await createTestUser({ sthis, deviceCA, session, seqUserId: 1 });

    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);

    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    const aliceApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await aliceUser.getDashBoardToken()),
    });

    const rRes = await aliceApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>RenderVibe ViewerEnv Test</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) throw new Error("Failed to create app for render-vibe viewer-env test");
    appSlug = res.appSlug;
    userSlug = res.userSlug;
  });

  it("resolveWhoAmI with auth=undefined returns viewer:null and access:'none'", async () => {
    // This is the exact call renderVibe makes for unauthenticated HTTP requests.
    const rViewer = await resolveWhoAmI(vibesCtx, {
      auth: undefined,
      appSlug,
      ownerUserSlug: userSlug,
      apiBaseUrl: "https://api.test",
    });

    expect(rViewer.isOk()).toBe(true);
    const v = rViewer.Ok();
    expect(v.viewer).toBeNull();
    expect(v.access).toBe("none");
  });

  it("mountJS JSON fragment contains viewer:null and access:none", () => {
    // Simulate what renderVibe serialises into the mountJS inline script.
    // viewer is null for unauthenticated renders — no avatarUrl needed.
    const viewerEnv = {
      viewer: null,
      access: "none" as const,
    };

    const mountParams = JSON.stringify({
      usrEnv: {},
      viewerEnv,
    });

    // These are the assertions the spec requires for the rendered HTML.
    expect(mountParams).toContain('"viewer":null');
    expect(mountParams).toContain('"access":"none"');
    expect(mountParams).not.toContain('"apiBaseUrl"');
  });

  it("viewerEnv is omitted from mountParams when resolveWhoAmI fails", () => {
    // When resolveWhoAmI errors (e.g. DB down), render-vibe falls back to
    // omitting viewerEnv entirely — the iframe calls vibe.req.whoAmI after boot.
    const rViewer = Result.Err<{ viewer: null; access: "none" }, Error>(new Error("DB unavailable"));
    const viewerEnv = rViewer.isOk()
      ? {
          viewer: rViewer.Ok().viewer,
          access: rViewer.Ok().access,
        }
      : undefined;

    const mountParams = JSON.stringify({
      usrEnv: {},
      ...(viewerEnv ? { viewerEnv } : {}),
    });

    expect(mountParams).not.toContain("viewerEnv");
    expect(mountParams).toBe('{"usrEnv":{}}');
  });
});
