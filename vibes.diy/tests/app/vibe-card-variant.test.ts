import { describe, it, expect } from "vitest";
import { computeCardVariant } from "../../pkg/app/routes/vibe-card-variant.js";

describe("computeCardVariant", () => {
  it("returns 'request' for req-login.request", () => {
    expect(computeCardVariant("req-login.request")).toBe("request");
  });
  it("returns 'invite' for req-login.invite", () => {
    expect(computeCardVariant("req-login.invite")).toBe("invite");
  });
  it("returns 'invite' for req-login.auto-join (shared visual branch with invite)", () => {
    expect(computeCardVariant("req-login.auto-join")).toBe("invite");
  });
  it("returns 'pending' for pending-request", () => {
    expect(computeCardVariant("pending-request")).toBe("pending");
  });
  it("returns 'revoked' for revoked-access", () => {
    expect(computeCardVariant("revoked-access")).toBe("revoked");
  });
  it("returns 'not-found' for not-found and not-grant", () => {
    expect(computeCardVariant("not-found")).toBe("not-found");
    expect(computeCardVariant("not-grant")).toBe("not-found");
  });
  it("returns 'iframe' for any access-granted state", () => {
    expect(computeCardVariant("granted-access.editor")).toBe("iframe");
    expect(computeCardVariant("granted-access.viewer")).toBe("iframe");
    expect(computeCardVariant("granted-access.submitter")).toBe("iframe");
    expect(computeCardVariant("accepted-email-invite")).toBe("iframe");
    expect(computeCardVariant("public-access")).toBe("iframe");
    expect(computeCardVariant("owner")).toBe("iframe");
  });
  it("returns 'iframe' for undefined (no grant resolved yet)", () => {
    expect(computeCardVariant(undefined)).toBe("iframe");
  });
});
