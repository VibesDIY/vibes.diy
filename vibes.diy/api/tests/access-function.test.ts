import { describe, expect, it } from "vitest";
import { enforceAllowAnonymous, makeHelpers } from "../svc/public/access-function.js";
import type { AccessDescriptor, UserContext } from "../types/access-function.js";

describe("enforceAllowAnonymous", () => {
  it("rejects write when user is null and result has no allowAnonymous", () => {
    const result: AccessDescriptor = {};
    expect(() => enforceAllowAnonymous(result, null)).toThrow();
  });

  it("rejects write when user is null and allowAnonymous is false", () => {
    const result: AccessDescriptor = { allowAnonymous: false };
    expect(() => enforceAllowAnonymous(result, null)).toThrow();
  });

  it("allows write when user is null and allowAnonymous is true", () => {
    const result: AccessDescriptor = { channels: ["inbound-responses"], allowAnonymous: true };
    expect(() => enforceAllowAnonymous(result, null)).not.toThrow();
  });

  it("allows write when user is non-null regardless of allowAnonymous", () => {
    const user: UserContext = { userHandle: "alice", isOwner: false };
    const result: AccessDescriptor = {};
    expect(() => enforceAllowAnonymous(result, user)).not.toThrow();
  });

  it("allows write when user is non-null with allowAnonymous true (no-op)", () => {
    const user: UserContext = { userHandle: "alice", isOwner: false };
    const result: AccessDescriptor = { allowAnonymous: true };
    expect(() => enforceAllowAnonymous(result, user)).not.toThrow();
  });

  it("thrown error includes forbidden message", () => {
    expect(() => enforceAllowAnonymous({}, null)).toThrowError("authentication required");
  });
});

describe("makeHelpers", () => {
  const user: UserContext = { userHandle: "alice", isOwner: false };

  it("requireAccess throws when user is null", () => {
    const ctx = makeHelpers(null);
    expect(() => ctx.requireAccess("some-channel")).toThrow("not in channel");
  });

  it("requireRole throws when user is null", () => {
    const ctx = makeHelpers(null);
    expect(() => ctx.requireRole("admin")).toThrow("not in role");
  });

  it("requireAccess throws when user has no access to channel", () => {
    const ctx = makeHelpers(user, { members: {}, roleGrants: {}, userGrants: {} });
    expect(() => ctx.requireAccess("secret-channel")).toThrow("not in channel");
  });

  it("requireAccess passes when user has direct channel grant", () => {
    const ctx = makeHelpers(user, { members: {}, roleGrants: {}, userGrants: { alice: ["secret-channel"] } });
    expect(() => ctx.requireAccess("secret-channel")).not.toThrow();
  });

  it("requireAccess passes when user has channel via role", () => {
    const ctx = makeHelpers(user, {
      members: { admin: ["alice"] },
      roleGrants: { admin: ["admin-channel"] },
      userGrants: {},
    });
    expect(() => ctx.requireAccess("admin-channel")).not.toThrow();
  });

  it("requireRole throws when user does not have the role", () => {
    const ctx = makeHelpers(user, { members: { editor: ["bob"] }, roleGrants: {}, userGrants: {} });
    expect(() => ctx.requireRole("editor")).toThrow("not in role");
  });

  it("requireRole passes when user has the role", () => {
    const ctx = makeHelpers(user, { members: { admin: ["alice"] }, roleGrants: {}, userGrants: {} });
    expect(() => ctx.requireRole("admin")).not.toThrow();
  });
});
