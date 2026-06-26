// Auth compat-matrix — patch-removal safety gate (de-fireproof Task 5).
//
// The `core-types-base` patch relaxes the Clerk claim `params` sub-schema
// (`.catch("")` on first/image_url/last, `.catch(null)` on name) so real Clerk
// JWTs — which omit those profile fields — validate. Our owned ClerkClaimSchema
// (clerk-claim.ts) reproduces that leniency.
//
// This gate pins our owned schema against FROZEN expectations that capture the
// patched behavior — deliberately NOT against the live upstream schema. The
// upstream schema is mutable: the patch-removal PR deletes
// `patches/@fireproof__core-types-base@0.24.19.patch`, after which an
// `Upstream.safeParse` oracle would flip (it would start rejecting the
// omitted-profile-field rows) and this gate would go red during exactly the PR it
// must protect. Freezing the expectations here means the gate stays green through
// the patch removal and fails only if OUR owned leniency regresses.
//
// (Equivalence to the upstream PATCHED schema was confirmed when this suite was
// written — owned and patched-upstream agreed on every row — so these frozen
// expectations are the patched behavior, now owned independently of upstream.)
import { describe, it, expect } from "vitest";
import { ClerkClaimSchema as Owned } from "./clerk-claim.js";

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

// Frozen oracle: the normalized values of the patch-affected fields after a
// successful parse, or `success: false` for genuinely invalid claims.
type Expect =
  | { readonly success: false }
  | {
      readonly success: true;
      readonly first: string;
      readonly image_url: string;
      readonly last: string;
      readonly name: string | null;
    };

const matrix: readonly (readonly [string, unknown, Expect])[] = [
  [
    "fully-populated params",
    baseClaim(fullParams),
    { success: true, first: "First", image_url: "http://x/y.png", last: "Last", name: "Full Name" },
  ],
  // The case the patch exists for: a real Clerk JWT omitting profile fields.
  [
    "params omitting first/image_url/last/name",
    baseClaim({ email: "a@b.c", email_verified: true, public_meta: {} }),
    { success: true, first: "", image_url: "", last: "", name: null },
  ],
  [
    "name explicitly null",
    baseClaim({ ...fullParams, name: null }),
    { success: true, first: "First", image_url: "http://x/y.png", last: "Last", name: null },
  ],
  [
    "first/last wrong type — .catch coerces to defaults",
    baseClaim({ ...fullParams, first: 123, last: true }),
    { success: true, first: "", image_url: "http://x/y.png", last: "", name: "Full Name" },
  ],
  [
    "image_url missing only",
    baseClaim({ ...fullParams, image_url: undefined }),
    { success: true, first: "First", image_url: "", last: "Last", name: "Full Name" },
  ],
  // Genuinely invalid — required field absent: must reject regardless of the patch.
  ["params missing required email", baseClaim({ email_verified: true, public_meta: {} }), { success: false }],
  ["top-level missing userId", { role: "member", sub: "user_123", params: fullParams }, { success: false }],
];

describe("Clerk claim schema parity (owned, frozen patched-behavior oracle) — patch-removal gate", () => {
  for (const [label, payload, want] of matrix) {
    it(`owned schema matches frozen patched behavior: ${label}`, () => {
      const got = Owned.safeParse(payload);
      expect(got.success).toBe(want.success);
      if (want.success && got.success) {
        const p = got.data.params as { first: unknown; image_url: unknown; last: unknown; name: unknown };
        expect(p.first).toBe(want.first);
        expect(p.image_url).toBe(want.image_url);
        expect(p.last).toBe(want.last);
        expect(p.name).toBe(want.name);
      }
    });
  }
});
