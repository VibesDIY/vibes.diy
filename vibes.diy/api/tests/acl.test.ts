import { describe, expect, it } from "vitest";
import { ensureACLEntry } from "@vibes.diy/api-svc";

describe("ACL tests", () => {
  const def = {
    appSlug: "appSlug",
    userSlug: "userSlug",
  };
  it("test if something", () => {
    const r = ensureACLEntry({
      ...def,
      activeEntries: [],
      crud: "upsert",
      entry: {
        type: "app.acl.enable.public.access",
        tick: { count: 4, last: new Date() },
      },
    });
    expect(r.isOk()).toBe(true);
    const result = r.unwrap().appSettings;
    expect(result.entries).toHaveLength(1);
    expect(result.entry.publicAccess).toBeDefined();
    expect(result.entry.publicAccess?.tick?.count).toBe(4);

    const r0 = ensureACLEntry({
      ...def,
      activeEntries: result.entries,
      crud: "upsert",
      entry: {
        type: "app.acl.enable.public.access",
        tick: { count: 33, last: new Date() },
      },
    });
    expect(r0.isOk()).toBe(true);
    const result0 = r0.unwrap().appSettings;
    expect(result0.entries).toHaveLength(1);
    expect(result0.entry.publicAccess).toBeDefined();
    expect(result0.entry.publicAccess?.tick?.count).toBe(37);

    const r1 = ensureACLEntry({
      ...def,
      activeEntries: [],
      entry: {
        type: "app.acl.enable.public.access",
        tick: { count: 0, last: new Date() },
      },
      crud: "delete",
    });
    expect(r1.isOk()).toBe(true);
    const result1 = r1.unwrap().appSettings;
    expect(result1.entries).toHaveLength(0);
  });

  it("crud request", () => {
    const r0 = ensureACLEntry({
      ...def,
      crud: "upsert",
      activeEntries: [],
      entry: {
        type: "app.acl.active.request",
        state: "pending",
        role: "viewer",
        request: {
          key: "test@example.com",
          provider: "google",
          userId: "string",
          created: new Date(),
        },
      },
    });
    const result0 = r0.unwrap().appSettings;
    expect(result0.entries).toHaveLength(1);
    expect(result0.entry.request.pending[0].request.key).toBe("test@example.com");

    const r1 = ensureACLEntry({
      ...def,
      activeEntries: result0.entries,
      crud: "upsert",
      entry: {
        type: "app.acl.active.request",
        state: "pending",
        role: "viewer",
        request: {
          key: "test@example.com",
          provider: "google",
          userId: "string",
          created: new Date(),
        },
      },
    });
    const result1 = r1.unwrap().appSettings;
    expect(result1.entries).toHaveLength(1);
    expect(result1.entry.request.pending[0].request.key).toBe("test@example.com");

    const r2 = ensureACLEntry({
      ...def,
      activeEntries: result1.entries,
      crud: "upsert",
      entry: {
        ...result1.entry.request.pending[0],
        state: "rejected",
        grant: {
          ownerId: "string",
          on: new Date(),
        },
      },
    });
    const result2 = r2.unwrap().appSettings;
    expect(result2.entries).toHaveLength(1);
    expect(result2.entry.request.rejected[0]).toEqual({
      grant: {
        on: expect.any(Date),
        ownerId: "string",
      },
      request: {
        created: expect.any(Date),
        key: "test@example.com",
        provider: "google",
        userId: "string",
      },
      role: "viewer",
      state: "rejected",
      type: "app.acl.active.request",
    });

    const r3 = ensureACLEntry({
      ...def,
      crud: "upsert",
      activeEntries: result2.entries,
      entry: {
        ...result2.entry.request.rejected[0],
        role: "viewer",
        state: "pending",
      },
    });
    const result3 = r3.unwrap().appSettings;
    expect(result3.entries).toHaveLength(1);
    expect(result3.entry.request.pending[0].state).toBe("pending");
    expect(result3.entry.request.pending[0].request.key).toBe("test@example.com");
    expect(result3.entry.request.pending[0].request.provider).toBe("google");

    const r4 = ensureACLEntry({
      ...def,
      crud: "delete",
      activeEntries: result3.entries,
      entry: {
        ...result3.entry.request.pending[0],
        state: "pending",
      },
    });
    const result4 = r4.unwrap().appSettings;
    expect(result4.entries).toHaveLength(0);
  });

  it("crud invite", () => {
    const r0 = ensureACLEntry({
      ...def,
      crud: "upsert",
      activeEntries: [],
      entry: {
        type: "app.acl.active.invite",
        state: "pending",
        role: "editor",
        invite: {
          email: "test@example.com",
          created: new Date(),
        },
        token: "token-1",
      },
      token: () => "real-token",
    });
    const result0 = r0.unwrap().appSettings;
    expect(result0.entries).toHaveLength(1);
    expect(result0.entry.invite.editors.pending[0].invite.email).toBe("test@example.com");
    expect(result0.entry.invite.editors.pending[0].token).toBe("real-token");

    const r1 = ensureACLEntry({
      ...def,
      activeEntries: result0.entries,
      crud: "upsert",
      entry: {
        type: "app.acl.active.invite",
        state: "pending",
        role: "editor",
        invite: {
          email: "test@example.com",
          created: new Date(),
        },
        token: "token-1",
      },
      token: () => "real-token",
    });
    const result1 = r1.unwrap().appSettings;
    expect(result1.entries).toHaveLength(1);
    expect(result1.entry.invite.editors.pending[0].invite.email).toBe("test@example.com");

    const r2 = ensureACLEntry({
      ...def,
      activeEntries: result1.entries,
      crud: "upsert",
      entry: {
        ...result1.entry.invite.editors.pending[0],
        state: "accepted",
        grant: {
          ownerId: "owner-1",
          on: new Date(),
        },
        tick: {
          count: 1,
          last: new Date(),
        },
      },
    });
    const result2 = r2.unwrap().appSettings;
    expect(result2.entries).toHaveLength(1);
    expect(result2.entry.invite.editors.accepted[0]).toEqual({
      grant: {
        on: expect.any(Date),
        ownerId: "owner-1",
      },
      tick: {
        count: 1,
        last: expect.any(Date),
      },
      invite: {
        created: expect.any(Date),
        email: "test@example.com",
      },
      role: "editor",
      state: "accepted",
      token: "real-token",
      type: "app.acl.active.invite",
    });

    const r3 = ensureACLEntry({
      ...def,
      crud: "upsert",
      activeEntries: result2.entries,
      entry: {
        ...result2.entry.invite.editors.accepted[0],
        state: "pending",
        token: "token-1",
      },
      token: () => "realer-fact-token",
    });
    const result3 = r3.unwrap().appSettings;
    expect(result3.entries).toHaveLength(1);
    expect(result3.entry.invite.editors.pending[0].state).toBe("pending");
    expect(result3.entry.invite.editors.pending[0].invite.email).toBe("test@example.com");

    const r4 = ensureACLEntry({
      ...def,
      crud: "delete",
      activeEntries: result3.entries,
      entry: {
        ...result3.entry.invite.editors.pending[0],
      },
    });
    const result4 = r4.unwrap().appSettings;
    expect(result4.entries).toHaveLength(0);
  });
});
