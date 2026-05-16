import { describe, expect, it } from "vitest";
import { ClerkClaimSchema } from "@fireproof/core-types-base";

// Regression guard for the "Invalid input" ZodError that blocked brand-new
// Clerk signups from completing their first prompt (see vibes-diy-provider
// getTokenClaims / tokenClaims logs).
//
// Clerk's JWT template populates `params.last` from the user's `last_name`
// attribute. When a user signs up via OAuth (Apple often hides last names,
// Google can be first-name-only) or email with no profile step, the template
// variable resolves to `undefined` rather than `""`, and the upstream
// `ClerkClaimSchema` rejected the otherwise-valid claim with:
//
//   { code: "invalid_type", expected: "string", path: ["params","last"],
//     message: "Invalid input" }
//
// vibes.diy applies a pnpm patch (patches/@fireproof__core-types-base@0.24.19.patch)
// that wraps `first`, `last`, `image_url` in `z.string().catch("")` and `name`
// in `z.string().nullable().catch(null)` so missing template variables fall
// through to safe defaults instead of erroring out. This test pins that
// behavior so a future upstream bump can't silently drop it.

function newUserClaim(omit: ReadonlyArray<string> = []): Record<string, unknown> {
  const params: Record<string, unknown> = {
    email: "newuser@example.com",
    email_verified: true,
    first: "Pat",
    image_url: "https://img.clerk.com/eyJ.../public",
    last: "",
    name: null,
    public_meta: {},
  };
  for (const key of omit) {
    delete params[key];
  }
  return {
    azp: "https://vibes.diy",
    exp: 1_900_000_000,
    iat: 1_899_999_400,
    iss: "https://clerk.vibes.diy",
    jti: "test-jti",
    nbf: 1_899_999_390,
    params,
    role: "user",
    sub: "user_2abc",
    userId: "user_2abc",
  };
}

describe("ClerkClaimSchema — new user signup tolerance", () => {
  it("accepts a claim whose Clerk template left `last` undefined", () => {
    const result = ClerkClaimSchema.safeParse(newUserClaim(["last"]));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.params.last).toBe("");
  });

  it("accepts a claim missing `first`, `last`, and `image_url` (Apple SSO worst case)", () => {
    const result = ClerkClaimSchema.safeParse(newUserClaim(["first", "last", "image_url"]));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.params).toMatchObject({
      first: "",
      last: "",
      image_url: "",
    });
  });

  it("accepts a claim whose `name` is undefined (template var unset)", () => {
    const result = ClerkClaimSchema.safeParse(newUserClaim(["name"]));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.params.name).toBeNull();
  });

  it("still rejects when auth-critical fields are missing", () => {
    const result = ClerkClaimSchema.safeParse(newUserClaim(["email"]));
    expect(result.success).toBe(false);
  });

  it("accepts a fully-populated claim (sanity)", () => {
    const result = ClerkClaimSchema.safeParse(newUserClaim([]));
    expect(result.success).toBe(true);
  });
});
