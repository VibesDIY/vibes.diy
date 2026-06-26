// Auth compat-matrix — patch-removal safety gate (de-fireproof Task 5).
//
// The `core-types-base` patch relaxes the Clerk claim `params` sub-schema
// (`.catch("")` on first/image_url/last, `.catch(null)` on name) so real Clerk
// JWTs — which omit those profile fields — validate. Our owned ClerkClaimSchema
// (clerk-claim.ts) reproduces that leniency. Before the patch can be dropped, our
// owned schema MUST accept/reject AND normalize byte-for-byte identically to the
// upstream PATCHED schema across the matrix of cases the patch affects. This test
// is that proof obligation; it must stay green when the patch is removed (at which
// point the upstream import below validates against the now-unpatched schema, and
// any divergence in our owned copy surfaces here).
import { describe, it, expect } from "vitest";
import { ClerkClaimSchema as Owned } from "./clerk-claim.js";
import { ClerkClaimSchema as Upstream } from "@fireproof/core-types-base";

const baseClaim = (params: Record<string, unknown>) => ({
  role: "member",
  sub: "user_123",
  userId: "user_123",
  params,
});

const fullParams = {
  nick: "nick",
  email: "a@b.c",
  email_verified: true,
  first: "First",
  image_url: "http://x/y.png",
  last: "Last",
  name: "Full Name",
  public_meta: { role: "tester" },
};

// Each row: a payload + a human label. We assert owned and upstream agree on
// BOTH the success flag and (on success) the normalized output.
const matrix: ReadonlyArray<readonly [string, unknown]> = [
  ["fully-populated params", baseClaim(fullParams)],
  // The case the patch exists for: a real Clerk JWT omitting profile fields.
  ["params omitting first/image_url/last/name", baseClaim({ email: "a@b.c", email_verified: true, public_meta: {} })],
  ["name explicitly null", baseClaim({ ...fullParams, name: null })],
  ["first/last wrong type (number) — .catch coerces", baseClaim({ ...fullParams, first: 123, last: true })],
  ["image_url missing only", baseClaim({ ...fullParams, image_url: undefined })],
  // Genuinely invalid — required email absent: both must reject.
  ["params missing required email", baseClaim({ email_verified: true, public_meta: {} })],
  ["top-level missing userId", { role: "member", sub: "user_123", params: fullParams }],
];

describe("Clerk claim schema parity (owned vs upstream patched) — patch-removal gate", () => {
  for (const [label, payload] of matrix) {
    it(`agrees with upstream: ${label}`, () => {
      const o = Owned.safeParse(payload);
      const u = Upstream.safeParse(payload);
      expect(o.success).toBe(u.success);
      if (o.success && u.success) {
        // Normalized output (incl. the .catch defaults) must be identical.
        expect(o.data).toEqual(u.data);
      }
    });
  }
});
