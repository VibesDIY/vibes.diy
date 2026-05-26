import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import {
  type EvtRequestGrant,
  isResEnsureAppSlugOk,
  isResHasAccessInviteAccepted,
  isResHasAccessRequestApproved,
  isResRequestAccessApproved,
} from "@vibes.diy/api-types";
import { createApiTestCtx, type ApiTestCtx } from "./api-test-setup.js";

const REQUEST_FLOW_SEQ_BASE = 1_646_100;
const INVITE_FLOW_SEQ_BASE = 1_646_200;

describe("request flow", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
  let ctx: ApiTestCtx;

  beforeAll(async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: REQUEST_FLOW_SEQ_BASE });
  });

  it("owner cannot requestAccess or hasAccessRequest own app", async () => {
    const { appSlug, userSlug } = await ctx.createApp();
    await ctx.api.ensureAppSettings({ appSlug, userSlug, request: { enable: true } });

    const reqResult = await ctx.api.requestAccess({ appSlug, userSlug });
    expect(reqResult.isErr()).toBe(true);
    expect(reqResult.Err().error.code).toBe("owner-error");

    const hasResult = await ctx.api.hasAccessRequest({ appSlug, userSlug });
    expect(hasResult.isErr()).toBe(true);
    expect(hasResult.Err().error.code).toBe("owner-error");
  });

  it("default fixture partition keeps requester distinct from owner", async () => {
    const defaultCtx = await createApiTestCtx();
    const { appSlug, userSlug } = await defaultCtx.createApp();
    await defaultCtx.api.ensureAppSettings({ appSlug, userSlug, request: { enable: true } });

    const rRequested = await defaultCtx.api2.requestAccess({ appSlug, userSlug });
    if (rRequested.isErr()) {
      assert.fail("Expected requestAccess to succeed with default fixture partition, got: " + JSON.stringify(rRequested.Err()));
    }
    expect(rRequested.Ok().state).toBe("pending");
  });

  it("subscribeRequestGrants is owner-only", async () => {
    const { appSlug, userSlug } = await ctx.createApp();

    const rOwner = await ctx.api.subscribeRequestGrants({ appSlug, userSlug });
    expect(rOwner.isOk()).toBe(true);

    const rNonOwner = await ctx.api2.subscribeRequestGrants({ appSlug, userSlug });
    expect(rNonOwner.isErr()).toBe(true);
  });

  it("fires notifyRequestGrantChanged across request/approve/setRole/revoke lifecycle", async () => {
    const events: EvtRequestGrant[] = [];
    const dctx = await createApiTestCtx({
      seqUserIdBase: REQUEST_FLOW_SEQ_BASE + 700,
      apiUrlPort: 18651,
      notifyRequestGrantChanged: async (evt) => {
        events.push(evt);
      },
    });
    const { appSlug, userSlug } = await dctx.createApp();
    await dctx.api.ensureAppSettings({ appSlug, userSlug, request: { enable: true } });

    events.length = 0;
    const rRequested = await dctx.api2.requestAccess({ appSlug, userSlug });
    if (rRequested.isErr()) assert.fail("requestAccess: " + JSON.stringify(rRequested.Err()));
    const requested = rRequested.Ok();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("vibes.diy.evt-request-grant");
    expect(events[0].op).toBe("upsert");
    expect(events[0].grant.userSlug).toBe(userSlug);
    expect(events[0].grant.appSlug).toBe(appSlug);
    expect(events[0].grant.state).toBe("pending");

    const foreignUserId = requested.foreignUserId;
    events.length = 0;
    await dctx.api.approveRequest({ appSlug, userSlug, foreignUserId, role: "viewer" });
    expect(events).toHaveLength(1);
    const approvedGrant = events[0].grant as { state: string; role?: string };
    expect(approvedGrant.state).toBe("approved");
    expect(approvedGrant.role).toBe("viewer");

    events.length = 0;
    await dctx.api.requestSetRole({ appSlug, userSlug, foreignUserId, role: "editor" });
    expect(events).toHaveLength(1);
    expect((events[0].grant as { role?: string }).role).toBe("editor");

    events.length = 0;
    await dctx.api.revokeRequest({ appSlug, userSlug, foreignUserId });
    expect(events).toHaveLength(1);
    expect(events[0].op).toBe("upsert");
    expect(events[0].grant.state).toBe("revoked");

    events.length = 0;
    await dctx.api.revokeRequest({ appSlug, userSlug, foreignUserId, delete: true });
    expect(events).toHaveLength(1);
    expect(events[0].op).toBe("delete");
  });

  it("manual approval lifecycle", async () => {
    const { appSlug, userSlug } = await ctx.createApp();

    const requesterApp = (
      await ctx.api2.ensureAppSlug({
        mode: "dev",
        fileSystem: [
          {
            type: "code-block",
            lang: "jsx",
            filename: "/App.jsx",
            content: "function App(){ return <div>Requester</div>; } App();",
          },
        ],
      })
    ).Ok();
    if (!isResEnsureAppSlugOk(requesterApp)) {
      assert.fail("Expected requester ensureAppSlug to succeed");
    }
    const requesterUserSlug = requesterApp.userSlug;

    // enable request access (no auto-approve)
    await ctx.api.ensureAppSettings({ appSlug, userSlug, request: { enable: true } });

    // api2 requests access → pending
    const rRequested = await ctx.api2.requestAccess({ appSlug, userSlug });
    if (rRequested.isErr()) {
      assert.fail("Expected requestAccess to succeed, got error: " + JSON.stringify(rRequested.Err()));
    }
    const requested = rRequested.Ok();
    expect(requested.state).toBe("pending");
    expect(requested.foreignUserId).toBeTruthy();
    expect((requested.foreignInfo as { claims: { userId: string } }).claims.userId).toBe(requested.foreignUserId);
    const foreignUserId = requested.foreignUserId;

    // api2 checks own access → pending (not yet approved)
    expect((await ctx.api2.hasAccessRequest({ appSlug, userSlug })).Ok().state).toBe("pending");

    // owner lists → 1 pending item with foreignInfo.claims containing userId
    const listPending = (await ctx.api.listRequestGrants({ appSlug, userSlug, pager: {} })).Ok();
    expect(listPending.items).toHaveLength(1);
    expect(listPending.items[0].state).toBe("pending");
    expect(listPending.items[0].foreignUserId).toBe(foreignUserId);
    expect(listPending.items[0].foreignUserSlug).toBe(requesterUserSlug);
    expect((listPending.items[0].foreignInfo as { claims: { userId: string } }).claims.userId).toBe(foreignUserId);

    // owner approves
    const approved = (await ctx.api.approveRequest({ appSlug, userSlug, foreignUserId, role: "viewer" })).Ok();
    expect(approved.state).toBe("approved");
    expect(approved.role).toBe("viewer");

    // owner lists → approved
    const listApproved = (await ctx.api.listRequestGrants({ appSlug, userSlug, pager: {} })).Ok();
    expect(listApproved.items[0].state).toBe("approved");

    // api2 checks own access → approved with role
    const access = (await ctx.api2.hasAccessRequest({ appSlug, userSlug })).Ok();
    if (!isResHasAccessRequestApproved(access)) {
      assert.fail("Expected hasAccessRequest to be approved, got: " + JSON.stringify(access));
    }
    expect(access.state).toBe("approved");
    expect(access.role).toBe("viewer");

    // owner revokes (no delete) → revoked
    expect((await ctx.api.revokeRequest({ appSlug, userSlug, foreignUserId })).Ok().deleted).toBe(false);
    expect((await ctx.api.listRequestGrants({ appSlug, userSlug, pager: {} })).Ok().items[0].state).toBe("revoked");
    expect((await ctx.api2.hasAccessRequest({ appSlug, userSlug })).Ok().state).toBe("revoked");

    // owner revokes with delete → gone
    expect((await ctx.api.revokeRequest({ appSlug, userSlug, foreignUserId, delete: true })).Ok().deleted).toBe(true);
    expect((await ctx.api.listRequestGrants({ appSlug, userSlug, pager: {} })).Ok().items).toEqual([]);
  });

  it("auto-approve lifecycle with role update", async () => {
    const { appSlug, userSlug } = await ctx.createApp();

    // enable request access with auto-approve
    await ctx.api.ensureAppSettings({ appSlug, userSlug, request: { enable: true, autoAcceptRole: "viewer" } });

    // api2 checks before requesting → not-found (request is possible)
    expect((await ctx.api2.hasAccessRequest({ appSlug, userSlug })).Ok().state).toBe("not-found");

    // api2 requests access → auto-approved as viewer
    const requested = (await ctx.api2.requestAccess({ appSlug, userSlug })).Ok();
    if (!isResRequestAccessApproved(requested)) {
      assert.fail("Expected requestAccess to be auto-approved, got: " + JSON.stringify(requested));
    }
    expect(requested.state).toBe("approved");
    expect(requested.role).toBe("viewer");
    const foreignUserId = requested.foreignUserId;

    // owner lists → approved
    const listApproved = (await ctx.api.listRequestGrants({ appSlug, userSlug, pager: {} })).Ok();
    expect(listApproved.items).toHaveLength(1);
    expect(listApproved.items[0].state).toBe("approved");
    expect(listApproved.items[0].role).toBe("viewer");

    // api2 checks own access → approved
    const access = (await ctx.api2.hasAccessRequest({ appSlug, userSlug })).Ok();
    if (!isResHasAccessRequestApproved(access)) {
      assert.fail("Expected hasAccessRequest to be approved, got: " + JSON.stringify(access));
    }
    expect(access.state).toBe("approved");
    expect(access.role).toBe("viewer");

    // owner updates role to editor
    const roleUpdated = (await ctx.api.requestSetRole({ appSlug, userSlug, foreignUserId, role: "editor" })).Ok();
    expect(roleUpdated.role).toBe("editor");

    // owner lists → role is editor
    const listEditor = (await ctx.api.listRequestGrants({ appSlug, userSlug, pager: {} })).Ok();
    expect(listEditor.items[0].role).toBe("editor");
  });

  it("drains pending queue when auto-accept is enabled", async () => {
    const { appSlug, userSlug } = await ctx.createApp();

    await ctx.api.ensureAppSettings({ appSlug, userSlug, request: { enable: true } });

    const pending = (await ctx.api2.requestAccess({ appSlug, userSlug })).Ok();
    expect(pending.state).toBe("pending");

    const before = (await ctx.api.listRequestGrants({ appSlug, userSlug, pager: {} })).Ok();
    expect(before.items).toHaveLength(1);
    expect(before.items[0].state).toBe("pending");

    await ctx.api.ensureAppSettings({
      appSlug,
      userSlug,
      request: { enable: true, autoAcceptRole: "viewer" },
    });

    const after = (await ctx.api.listRequestGrants({ appSlug, userSlug, pager: {} })).Ok();
    expect(after.items).toHaveLength(1);
    expect(after.items[0].state).toBe("approved");
    expect(after.items[0].role).toBe("viewer");

    const access = (await ctx.api2.hasAccessRequest({ appSlug, userSlug })).Ok();
    if (!isResHasAccessRequestApproved(access)) {
      assert.fail("Expected hasAccessRequest to be approved, got: " + JSON.stringify(access));
    }
    expect(access.state).toBe("approved");
    expect(access.role).toBe("viewer");
  });

  it("does not re-approve revoked requests when auto-accept is enabled", async () => {
    const { appSlug, userSlug } = await ctx.createApp();

    await ctx.api.ensureAppSettings({ appSlug, userSlug, request: { enable: true } });

    const requested = (await ctx.api2.requestAccess({ appSlug, userSlug })).Ok();
    const foreignUserId = requested.foreignUserId;

    await ctx.api.approveRequest({ appSlug, userSlug, foreignUserId, role: "viewer" });
    await ctx.api.revokeRequest({ appSlug, userSlug, foreignUserId });

    await ctx.api.ensureAppSettings({
      appSlug,
      userSlug,
      request: { enable: true, autoAcceptRole: "viewer" },
    });

    const after = (await ctx.api.listRequestGrants({ appSlug, userSlug, pager: {} })).Ok();
    expect(after.items).toHaveLength(1);
    expect(after.items[0].state).toBe("revoked");
  });
});

describe("invite flow", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
  let ctx: ApiTestCtx;

  beforeAll(async () => {
    ctx = await createApiTestCtx({ seqUserIdBase: INVITE_FLOW_SEQ_BASE });
  });

  it("full invite lifecycle", async () => {
    const now = ctx.sthis.nextId(8).str;
    const appSlug = `test-app-invite-${now}`;
    const userSlug = `test-user-invite-${now}`;
    const invitedEmail = `Test.User+alias@Gmail.com`;
    const canonicalEmail = `testuser@gmail.com`;

    // list is empty
    const rListEmpty = await ctx.api.listInviteGrants({ appSlug, userSlug, pager: {} });
    if (rListEmpty.isErr()) {
      assert.fail("Expected listInviteGrants to succeed, got error: " + JSON.stringify(rListEmpty.Err()));
    }
    expect(rListEmpty.Ok().items).toEqual([]);

    // revoke on non-existent → deleted:false
    expect((await ctx.api.revokeInvite({ appSlug, userSlug, emailKey: canonicalEmail })).Ok().deleted).toBe(false);

    // create invite
    const created = (await ctx.api.createInvite({ appSlug, userSlug, invitedEmail, role: "viewer" })).Ok();
    expect(created.emailKey).toBe(canonicalEmail);
    expect(created.state).toBe("pending");
    expect(created.role).toBe("viewer");
    expect(created.tokenOrGrantUserId).toBeTruthy();
    expect(created.foreignInfo).toEqual({ givenEmail: invitedEmail });
    const token = created.tokenOrGrantUserId;

    // list shows pending with token
    const listPending = (await ctx.api.listInviteGrants({ appSlug, userSlug, pager: {} })).Ok();
    expect(listPending.items).toHaveLength(1);
    expect(listPending.items[0].state).toBe("pending");
    expect(listPending.items[0].tokenOrGrantUserId).toBe(token);

    // hasAccess before redeem → not-found
    expect((await ctx.api2.hasAccessInvite({ appSlug, userSlug })).Ok().state).toBe("not-found");

    // set role to editor
    expect((await ctx.api.inviteSetRole({ appSlug, userSlug, emailKey: canonicalEmail, role: "editor" })).Ok().role).toBe("editor");

    // owner cannot redeem own invite
    expect((await ctx.api.redeemInvite({ token })).isErr()).toBe(true);

    // other user redeems
    const redeemed = (await ctx.api2.redeemInvite({ token })).Ok();
    expect(redeemed.state).toBe("accepted");
    expect(redeemed.role).toBe("editor");
    expect(redeemed.appSlug).toBe(appSlug);
    expect(redeemed.userSlug).toBe(userSlug);

    // list shows accepted with redeemer userId and claims
    const listAccepted = (await ctx.api.listInviteGrants({ appSlug, userSlug, pager: {} })).Ok();
    expect(listAccepted.items).toHaveLength(1);
    expect(listAccepted.items[0].state).toBe("accepted");
    expect(listAccepted.items[0].tokenOrGrantUserId).not.toBe(token);
    expect((listAccepted.items[0].foreignInfo as { claims: unknown }).claims).toBeTruthy();

    // hasAccess → accepted with role
    const access = (await ctx.api2.hasAccessInvite({ appSlug, userSlug })).Ok();
    if (!isResHasAccessInviteAccepted(access)) {
      assert.fail("Expected hasAccessRequest to be approved, got: " + JSON.stringify(access));
    }
    expect(access.state).toBe("accepted");
    expect(access.role).toBe("editor");

    // revoke (state → revoked, no delete)
    expect((await ctx.api.revokeInvite({ appSlug, userSlug, emailKey: canonicalEmail })).Ok().deleted).toBe(false);
    expect((await ctx.api.listInviteGrants({ appSlug, userSlug, pager: {} })).Ok().items[0].state).toBe("revoked");
    expect((await ctx.api2.hasAccessInvite({ appSlug, userSlug })).Ok().state).toBe("revoked");

    // revoke with delete
    expect((await ctx.api.revokeInvite({ appSlug, userSlug, emailKey: canonicalEmail, delete: true })).Ok().deleted).toBe(true);
    expect((await ctx.api.listInviteGrants({ appSlug, userSlug, pager: {} })).Ok().items).toEqual([]);
    expect((await ctx.api2.hasAccessInvite({ appSlug, userSlug })).Ok().state).toBe("not-found");
  });
});
