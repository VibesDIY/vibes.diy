import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";

type TestUserInstance = Awaited<ReturnType<typeof createTestUser>>;
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { COMMENTS_DB_NAME, isResEnsureAppSlugOk, isResRequestAccessApproved } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

interface CommentDoc {
  _id: string;
  body?: string;
}

async function setupApp(seqOffset: number) {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);

  const ownerUser = await createTestUser({ sthis, deviceCA });
  const viewerUser = await createTestUser({ sthis, deviceCA, seqUserId: 200 + seqOffset });
  const editorUser = await createTestUser({ sthis, deviceCA, seqUserId: 300 + seqOffset });
  const otherUser = await createTestUser({ sthis, deviceCA, seqUserId: 400 + seqOffset });
  const submitterUser = await createTestUser({ sthis, deviceCA, seqUserId: 500 + seqOffset });

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
  const submitterApi = mkApi(submitterUser);

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

  // Grant viewer + editor + submitter access (auto-approved). No explicit
  // dbAcl setup needed — the resolver lazy-defaults the `comments` dbName to
  // COMMENTS_DEFAULT_ACL ({ write: ["members"], delete: ["members"] }) when
  // no entry exists in AppSettings.
  await ownerApi.ensureAppSettings({ appSlug, userSlug, request: { enable: true, autoAcceptRole: "viewer" } });
  const rViewer = await viewerApi.requestAccess({ appSlug, userSlug });
  if (!isResRequestAccessApproved(rViewer.Ok())) assert.fail("viewer not auto-approved");

  await ownerApi.ensureAppSettings({ appSlug, userSlug, request: { enable: true, autoAcceptRole: "editor" } });
  const rEditor = await editorApi.requestAccess({ appSlug, userSlug });
  if (!isResRequestAccessApproved(rEditor.Ok())) assert.fail("editor not auto-approved");

  await ownerApi.ensureAppSettings({ appSlug, userSlug, request: { enable: true, autoAcceptRole: "submitter" } });
  const rSubmitter = await submitterApi.requestAccess({ appSlug, userSlug });
  if (!isResRequestAccessApproved(rSubmitter.Ok())) assert.fail("submitter not auto-approved");

  return { ownerApi, viewerApi, editorApi, otherApi, submitterApi, appSlug, userSlug };
}

describe("comments ACL: lazy default (members can write/delete)", { timeout: 20000 }, () => {
  let ctx: Awaited<ReturnType<typeof setupApp>>;

  beforeAll(async () => {
    ctx = await setupApp(0);
  });

  it("viewer (a member) can post a comment", async () => {
    const res = await ctx.viewerApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      doc: { body: "hello from viewer" },
    });
    expect(res.isOk()).toBe(true);
  });

  it("submitter (a member) can post a comment", async () => {
    const res = await ctx.submitterApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      doc: { body: "submitter post" },
    });
    expect(res.isOk()).toBe(true);
  });

  it("non-member authed user cannot post", async () => {
    const res = await ctx.otherApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      doc: { body: "intruder" },
    });
    expect(res.isErr()).toBe(true);
  });

  it("doc is written through verbatim — no server stamping", async () => {
    const putRes = await ctx.viewerApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      doc: { body: "raw" },
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
    const doc = (getRes.Ok() as unknown as { doc: CommentDoc & Record<string, unknown> }).doc;
    expect(doc.body).toBe("raw");
    expect(doc.authorUserId).toBeUndefined();
    expect(doc.authorDisplay).toBeUndefined();
    expect(doc.createdAt).toBeUndefined();
  });

  it("any member can delete any other member's comment (members are trusted)", async () => {
    const putRes = await ctx.viewerApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      doc: { body: "viewer's comment" },
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

  it("non-member cannot delete a comment", async () => {
    const putRes = await ctx.viewerApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      doc: { body: "another viewer comment" },
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
});

describe("comments ACL: 'Only collaborators' (editors-only write/delete)", { timeout: 20000 }, () => {
  let ctx: Awaited<ReturnType<typeof setupApp>>;

  beforeAll(async () => {
    ctx = await setupApp(1000);
    const setRes = await ctx.ownerApi.ensureAppSettings({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbAcl: {
        dbName: COMMENTS_DB_NAME,
        acl: { write: ["editors"], delete: ["editors"] },
      },
    });
    expect(setRes.isOk()).toBe(true);
    const stored = setRes.Ok().settings.entry.dbAcls?.[COMMENTS_DB_NAME];
    expect(stored?.write).toEqual(["editors"]);
  });

  it("viewer cannot post (not in editors)", async () => {
    const res = await ctx.viewerApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      doc: { body: "blocked" },
    });
    expect(res.isErr()).toBe(true);
  });

  it("submitter cannot post (not in editors)", async () => {
    const res = await ctx.submitterApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      doc: { body: "blocked submitter" },
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

  it("owner can still post (implicit member of every group)", async () => {
    const res = await ctx.ownerApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      doc: { body: "owner post" },
    });
    expect(res.isOk()).toBe(true);
  });

  it("non-owner cannot change the dbAcl via ensureAppSettings", async () => {
    // Non-owner ensureAppSettings calls are treated as read-only; the dbAcl
    // mutation is silently ignored (existing pattern for every other
    // settings mutation). Confirm the stored ACL is unchanged.
    await ctx.viewerApi.ensureAppSettings({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbAcl: {
        dbName: COMMENTS_DB_NAME,
        acl: { write: ["members"], delete: ["members"] },
      },
    });
    const ownerRes = await ctx.ownerApi.ensureAppSettings({ appSlug: ctx.appSlug, userSlug: ctx.userSlug });
    expect(ownerRes.Ok().settings.entry.dbAcls?.[COMMENTS_DB_NAME]?.write).toEqual(["editors"]);
  });

  it("removing the dbAcl reverts to lazy default — viewer can post again", async () => {
    const removeRes = await ctx.ownerApi.ensureAppSettings({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbAclRemove: { dbName: COMMENTS_DB_NAME },
    });
    expect(removeRes.isOk()).toBe(true);
    expect(removeRes.Ok().settings.entry.dbAcls?.[COMMENTS_DB_NAME]).toBeUndefined();

    const postRes = await ctx.viewerApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: COMMENTS_DB_NAME,
      doc: { body: "back to default" },
    });
    expect(postRes.isOk()).toBe(true);
  });
});

describe("default db (no ACL): unchanged from today", { timeout: 20000 }, () => {
  let ctx: Awaited<ReturnType<typeof setupApp>>;

  beforeAll(async () => {
    ctx = await setupApp(2000);
  });

  it("viewer cannot write to the default db", async () => {
    const res = await ctx.viewerApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: "default",
      doc: { body: "should fail" },
    });
    expect(res.isErr()).toBe(true);
  });

  it("editor can write to the default db", async () => {
    const res = await ctx.editorApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: "default",
      doc: { body: "editor doc" },
    });
    expect(res.isOk()).toBe(true);
  });

  it("submitter can write to the default db", async () => {
    const res = await ctx.submitterApi.putDoc({
      appSlug: ctx.appSlug,
      userSlug: ctx.userSlug,
      dbName: "default",
      doc: { body: "submitter doc" },
    });
    expect(res.isOk()).toBe(true);
  });
});
