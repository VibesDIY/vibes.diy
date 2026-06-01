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
    const user: UserContext = { userHandle: "alice" };
    const result: AccessDescriptor = {};
    expect(() => enforceAllowAnonymous(result, user)).not.toThrow();
  });

  it("allows write when user is non-null with allowAnonymous true (no-op)", () => {
    const user: UserContext = { userHandle: "alice" };
    const result: AccessDescriptor = { allowAnonymous: true };
    expect(() => enforceAllowAnonymous(result, user)).not.toThrow();
  });

  it("thrown error includes forbidden message", () => {
    expect(() => enforceAllowAnonymous({}, null)).toThrowError("authentication required");
  });
});

describe("makeHelpers", () => {
  it("requireAccess throws forbidden when user is null", () => {
    const ctx = makeHelpers(null);
    expect(() => ctx.requireAccess("some-channel")).toThrow("not in channel");
  });

  it("requireAccess does not throw when user is authenticated", () => {
    const user: UserContext = { userHandle: "alice" };
    const ctx = makeHelpers(user);
    expect(() => ctx.requireAccess("some-channel")).not.toThrow();
  });

  it("requireRole throws forbidden when user is null", () => {
    const ctx = makeHelpers(null);
    expect(() => ctx.requireRole("admin")).toThrow("not in role");
  });

  it("requireRole does not throw when user is authenticated", () => {
    const user: UserContext = { userHandle: "alice" };
    const ctx = makeHelpers(user);
    expect(() => ctx.requireRole("admin")).not.toThrow();
  });
});
