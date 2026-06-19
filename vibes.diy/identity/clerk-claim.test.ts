import { describe, it, expect } from "vitest";
import { ClerkClaimSchema } from "./clerk-claim.js";

// The patched (`.catch()`) parity behavior: a real Clerk JWT that omits the
// optional display fields must still parse, defaulting them rather than failing.
const baseParams = { email: "user@example.com", email_verified: true, public_meta: {} };
const baseClaim = { role: "member", sub: "user_123", userId: "user_123" };

describe("ClerkClaimSchema parity (patched .catch semantics)", () => {
  it("defaults missing display fields instead of rejecting", () => {
    const r = ClerkClaimSchema.safeParse({ ...baseClaim, params: { ...baseParams } });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.params.first).toBe("");
    expect(r.data.params.image_url).toBe("");
    expect(r.data.params.last).toBe("");
    expect(r.data.params.name).toBe(null);
  });

  it("preserves provided display fields", () => {
    const r = ClerkClaimSchema.safeParse({
      ...baseClaim,
      params: { ...baseParams, first: "Ada", last: "Lovelace", image_url: "https://x/y.png", name: "Ada Lovelace" },
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.params.first).toBe("Ada");
    expect(r.data.params.name).toBe("Ada Lovelace");
  });

  it("still requires the structurally load-bearing fields", () => {
    const r = ClerkClaimSchema.safeParse({ params: { ...baseParams } }); // missing role/sub/userId
    expect(r.success).toBe(false);
  });
});
