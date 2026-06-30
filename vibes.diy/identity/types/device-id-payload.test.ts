// Device-id payload schema parity gate (de-fireproof Task 6.3).
//
// `device-id-payload.ts` owns the device-id wire schemas verbatim from
// `core-types-base` @ 0.24.19 so the identity package stops importing those
// VALUES from `@fireproof/*`. Two properties are pinned here against FROZEN
// expectations (not a live diff against the mutable upstream schema):
//
//  1. The non-Clerk schemas (Subject / Extensions / FPDeviceIDSession, and the
//     non-`creatingUser` parts of the CSR) are byte-identical to upstream — the
//     patch never touched them. #2937 dropped the `@fireproof/core-types-base`
//     dependency, so these are now pinned against FROZEN accept/reject
//     expectations (the upstream oracle's answers at 0.24.19) rather than a live
//     diff against the removed schema.
//  2. The CSR's optional `creatingUser` clerk claim is parsed through the OWNED
//     lenient `ClerkClaimSchema`, so a CSR carrying a real Clerk claim that omits
//     `first`/`image_url`/`last`/`name` is ACCEPTED — where the now-unpatched
//     upstream schema rejected it. This is the same patch-class leniency frozen by
//     `clerk-claim-parity.test.ts`, asserted here at the CSR-payload boundary.
import { describe, it, expect } from "vitest";
import { SubjectSchema, ExtensionsSchema, FPDeviceIDSessionSchema, FPDeviceIDCSRPayloadSchema } from "./device-id-payload.js";

const publicKey = { kty: "EC", crv: "P-256", x: "abc", y: "def" } as const;
const subject = { commonName: "device-1" } as const;
const fullClerkClaim = {
  role: "member",
  sub: "u_1",
  userId: "u_1",
  params: {
    email: "a@b.c",
    email_verified: true,
    first: "First",
    image_url: "http://x/y.png",
    last: "Last",
    name: "Full Name",
    public_meta: {},
  },
};
// A real Clerk JWT omits these profile fields — the patch-class case.
const leanClerkClaim = {
  role: "member",
  sub: "u_1",
  userId: "u_1",
  params: { email: "a@b.c", email_verified: true, public_meta: {} },
};

const now = 1_700_000_000;
const validSession = { iss: "x", sub: "device-id", deviceId: "dev", seq: 1, exp: now + 120, nbf: now - 2, iat: now, jti: "j" };
const csrPayload = (creatingUser?: unknown) => ({
  sub: "device-1",
  iss: "csr-client",
  aud: "certificate-authority",
  iat: now,
  exp: now + 3600,
  jti: "j",
  ...(creatingUser ? { creatingUser } : {}),
  csr: {
    subject,
    publicKey,
    extensions: { subjectAltName: [], keyUsage: ["digitalSignature"], extendedKeyUsage: ["serverAuth"] },
  },
});

describe("device-id payload schemas — owned (frozen at core-types-base 0.24.19)", () => {
  it("Subject: accepts a valid subject, rejects missing commonName / bad countryName", () => {
    expect(SubjectSchema.safeParse(subject).success).toBe(true);
    // commonName is required.
    expect(SubjectSchema.safeParse({}).success).toBe(false);
    // countryName must be length 2.
    const badCountry = { commonName: "d", countryName: "USA" };
    expect(SubjectSchema.safeParse(badCountry).success).toBe(false);
  });

  it("Extensions: accepts known usages, rejects an unknown enum member", () => {
    const ext = { keyUsage: ["digitalSignature"], extendedKeyUsage: ["serverAuth"] };
    expect(ExtensionsSchema.safeParse(ext).success).toBe(true);
    const badEnum = { keyUsage: ["notAUsage"] };
    expect(ExtensionsSchema.safeParse(badEnum).success).toBe(false);
  });

  it("FPDeviceIDSession: valid passes; .strict() + seq bounds reject", () => {
    expect(FPDeviceIDSessionSchema.safeParse(validSession).success).toBe(true);
    // .strict() rejects unknown keys.
    const extra = { ...validSession, bogus: 1 };
    expect(FPDeviceIDSessionSchema.safeParse(extra).success).toBe(false);
    // seq must be a non-negative int.
    const negSeq = { ...validSession, seq: -1 };
    expect(FPDeviceIDSessionSchema.safeParse(negSeq).success).toBe(false);
  });

  it("FPDeviceIDCSRPayload: a CSR with no clerk claim passes; .strict() rejects unknown keys", () => {
    expect(FPDeviceIDCSRPayloadSchema.safeParse(csrPayload()).success).toBe(true);
    // .strict() at the csr level rejects unknown keys.
    const extra = { ...csrPayload(), csr: { ...csrPayload().csr, bogus: 1 } };
    expect(FPDeviceIDCSRPayloadSchema.safeParse(extra).success).toBe(false);
  });
});

describe("device-id CSR payload — owned Clerk-claim leniency (patch-removal gate)", () => {
  it("accepts a CSR whose creatingUser clerk claim omits first/image_url/last/name", () => {
    // The whole point of owning these schemas leniently: the owned schema accepts
    // the lean claim (a real Clerk JWT shape), where the now-unpatched upstream
    // schema rejected it — the patch-class leniency frozen by clerk-claim-parity.
    expect(FPDeviceIDCSRPayloadSchema.safeParse(csrPayload({ type: "clerk", claims: leanClerkClaim })).success).toBe(true);
  });

  it("accepts a CSR whose creatingUser carries a fully-populated clerk claim", () => {
    expect(FPDeviceIDCSRPayloadSchema.safeParse(csrPayload({ type: "clerk", claims: fullClerkClaim })).success).toBe(true);
  });
});
