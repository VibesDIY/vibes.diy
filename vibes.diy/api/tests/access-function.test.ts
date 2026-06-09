import { describe, expect, it } from "vitest";
import { enforceAllowAnonymous, isReadableResult, makeHelpers } from "../svc/public/access-function.js";
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

describe("isReadableResult", () => {
  it("false for empty descriptor (the {} catch-all)", () => {
    expect(isReadableResult({})).toBe(false);
  });

  it("false when channels is an empty array", () => {
    expect(isReadableResult({ channels: [] })).toBe(false);
  });

  it("false when only a grant is present but no channel (grant alone is not readability)", () => {
    expect(isReadableResult({ grant: { public: ["ch"] } })).toBe(false);
  });

  it("false when only members/expiry/allowAnonymous are present (no channel)", () => {
    expect(isReadableResult({ members: { editor: ["alice"] } })).toBe(false);
    expect(isReadableResult({ expiry: null })).toBe(false);
    expect(isReadableResult({ allowAnonymous: true })).toBe(false);
  });

  it("true when at least one channel is declared", () => {
    expect(isReadableResult({ channels: ["cabinet"] })).toBe(true);
  });

  it("true with the documented private-to-author pattern", () => {
    expect(isReadableResult({ channels: ["doc-1"], grant: { users: { alice: ["doc-1"] } } })).toBe(true);
  });
});
