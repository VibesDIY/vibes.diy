import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";

type TestUserInstance = Awaited<ReturnType<typeof createTestUser>>;
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import {
  COMMENTS_DB_NAME,
  isResEnsureAppSlugOk,
  isResRequestAccessApproved,
} from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

interface CommentDoc {
  _id: string;
  body?: string;
  authorUserId?: string;
  authorDisplay?: string;
  createdAt?: string;
}

async function setupApp(seqOffset: number) {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

  const ownerUser = await createTestUser({ sthis, deviceCA });
  const viewerUser = await createTestUser({ sthis, deviceCA, seqUserId: 200 + seqOffset });
  const editorUser = await createTestUser({ sthis, deviceCA, seqUserId: 300 + seqOffset });
  const otherUser = await createTestUser({ sthis, deviceCA, seqUserId: 400 + seqOffset });

  const wsPair = TestWSPair.create();
  const wsEvento = vibesMsgEvento();
  const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
  appCtx.vibesCtx.connections.add(wsSendProvider);

  wsPair.p2.onmessage = (event: MessageEvent) => {
    wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  };

  function mkApi(user: TestUserInstance) {
    return new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await user.getDashBoardToken()),
    });
  }

  const ownerApi = mkApi(ownerUser);
  const viewerApi = mkApi(viewerUser);
  const editorApi = mkApi(editorUser);
  const otherApi = mkApi(otherUser);

  const rRes = await ownerApi.ensureAppSlug({
    mode: "dev",
    fileSystem: [
      {
        type: "code-block",
        lang: "jsx",
        filename: "/App.jsx",
        content: `function App() { return <div>Comments Test</div>; } App();`,
      },
    ],
  });
  const res = rRes.Ok();
  if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
  const appSlug = res.appSlug;
  const userSlug = res.userSlug;

  // Trigger comments policy seed (happens on every getAppByFsId)
  await ownerApi.getAppByFsId({ appSlug, userSlug });

  // Grant viewer + editor access (auto-approved)
  await ownerApi.ensureAppSettings({ appSlug, userSlug, request: { enable: true, autoAcceptRole: "viewer" } });
  const rViewer = await viewerApi.requestAccess({ appSlug, userSlug });
  if (!isResRequestAccessApproved(rViewer.Ok())) assert.fail("viewer not auto-approved");

  await ownerApi.ensureAppSettings({ appSlug, userSlug, request: { enable: true, autoAcceptRole: "editor" } });
  const rEditor = await editorApi.requestAccess({ appSlug, userSlug });
  if (!isResRequestAccessApproved(rEditor.Ok())) assert.fail("editor not auto-approved");

  return { ownerApi, viewerApi, editorApi, otherApi, appSlug, userSlug };
}

describe("comments policy: open writes", { timeout: 20000 }, () => {
  let ctx: Awaited<ReturnType<typeof setupApp>>;

  beforeAll(async () => {
    ctx = await setupApp(0);
  });

  it("viewer can post a comment", async () => {
    const res = await ctx.viewerApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      doc: { body: "hello from viewer" },
    });
    expect(res.isOk()).toBe(true);
  });

  it("viewer cannot post to a non-comments dbName (default policy unchanged)", async () => {
    const res = await ctx.viewerApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: "default",
      doc: { body: "should fail" },
    });
    expect(res.isErr()).toBe(true);
  });

  it("server stamps author identity even if client tries to forge it", async () => {
    const putRes = await ctx.viewerApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      doc: { body: "spoof attempt", authorUserId: "FAKE", authorDisplay: "FAKE" },
    });
    expect(putRes.isOk()).toBe(true);
    const docId = putRes.Ok().id;

    const getRes = await ctx.viewerApi.getDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      docId,
    });
    if (!getRes.isOk() || getRes.Ok().status !== "ok") assert.fail("get failed");
    const doc = (getRes.Ok() as unknown as { doc: CommentDoc }).doc;
    expect(doc.authorUserId).not.toBe("FAKE");
    expect(typeof doc.authorUserId).toBe("string");
    expect((doc.authorUserId ?? "").length).toBeGreaterThan(0);
    expect(typeof doc.createdAt).toBe("string");
  });

  it("comment author can delete own comment", async () => {
    const putRes = await ctx.viewerApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      doc: { body: "self-delete" },
    });
    const docId = putRes.Ok().id;
    const delRes = await ctx.viewerApi.deleteDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      docId,
    });
    expect(delRes.isOk()).toBe(true);
  });

  it("non-author viewer cannot delete someone else's comment", async () => {
    const putRes = await ctx.viewerApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      doc: { body: "viewer's comment" },
    });
    const docId = putRes.Ok().id;
    const delRes = await ctx.otherApi.deleteDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      docId,
    });
    expect(delRes.isErr()).toBe(true);
  });

  it("vibe editor can delete anyone's comment", async () => {
    const putRes = await ctx.viewerApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      doc: { body: "viewer's comment for editor to nuke" },
    });
    const docId = putRes.Ok().id;
    const delRes = await ctx.editorApi.deleteDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      docId,
    });
    expect(delRes.isOk()).toBe(true);
  });
});

describe("comments policy: writers-only override", { timeout: 20000 }, () => {
  let ctx: Awaited<ReturnType<typeof setupApp>>;

  beforeAll(async () => {
    ctx = await setupApp(1000);
    // Tighten policy: writers-only
    const setRes = await ctx.ownerApi.setDbPolicy({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      policy: {
        read: "writers",
        write: "writers",
        delete: "author-or-writer",
        stamp: ["authorUserId", "authorDisplay", "createdAt"],
      },
    });
    expect(setRes.isOk()).toBe(true);
  });

  it("viewer cannot post when policy is writers-only", async () => {
    const res = await ctx.viewerApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      doc: { body: "blocked" },
    });
    expect(res.isErr()).toBe(true);
  });

  it("editor can still post", async () => {
    const res = await ctx.editorApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      doc: { body: "editor post" },
    });
    expect(res.isOk()).toBe(true);
  });

  it("non-owner cannot setDbPolicy", async () => {
    const res = await ctx.viewerApi.setDbPolicy({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      policy: {
        read: "writers",
        write: "any-reader",
        delete: "author-or-writer",
      },
    });
    expect(res.isErr()).toBe(true);
  });

  it("getDbPolicy is owner-gated", async () => {
    const ownerRes = await ctx.ownerApi.getDbPolicy({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
    });
    expect(ownerRes.isOk()).toBe(true);
    expect(ownerRes.Ok().policy.write).toBe("writers");

    const viewerRes = await ctx.viewerApi.getDbPolicy({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
    });
    expect(viewerRes.isErr()).toBe(true);
  });
});
