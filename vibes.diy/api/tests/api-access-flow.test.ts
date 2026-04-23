import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { isResHasAccessInviteAccepted, isResHasAccessRequestApproved, isResRequestAccessApproved } from "@vibes.diy/api-types";
import { createApiTestCtx, type ApiTestCtx } from "./api-test-setup.js";

describe("request flow", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
  let ctx: ApiTestCtx;

  beforeAll(async () => {
    ctx = await createApiTestCtx();
  });

  it("owner cannot requestAccess or hasAccessRequest own app", async () => {
    const { appSlug, userSlug } = await ctx.createApp();
    await ctx.api.ensureAppSettings({ appSlug, userSlug, request: { enable: true } });

    const reqResult = await ctx.api.requestAccess({ appSlug, userSlug });
    expect(reqResult.isErr()).toBe(true);
    expect(reqResult.Err().code).toBe("owner-error");

    const hasResult = await ctx.api.hasAccessRequest({ appSlug, userSlug });
    expect(hasResult.isErr()).toBe(true);
    expect(hasResult.Err().code).toBe("owner-error");
  });

  it("manual approval lifecycle", async () => {
    const { appSlug, userSlug } = await ctx.createApp();

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
    ctx = await createApiTestCtx();
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
