// Device-id payload schema parity gate (de-fireproof Task 6.3).
//
// `device-id-payload.ts` owns the device-id wire schemas verbatim from
// `core-types-base` @ 0.24.19 so the identity package stops importing those
// VALUES from `@fireproof/*`. Two properties are pinned here against FROZEN
// expectations (not a live diff against the mutable upstream schema):
//
//  1. The non-Clerk schemas (Subject / Extensions / FPDeviceIDSession, and the
//     non-`creatingUser` parts of the CSR) are byte-identical to upstream — the
//     patch never touched them, so an upstream oracle is stable and we ALSO assert
//     structural agreement with it as a lift-fidelity check.
//  2. The CSR's optional `creatingUser` clerk claim is parsed through the OWNED
//     lenient `ClerkClaimSchema`, so a CSR carrying a real Clerk claim that omits
//     `first`/`image_url`/`last`/`name` is ACCEPTED — where the now-unpatched
//     upstream schema rejects it. This is the same patch-class leniency frozen by
//     `clerk-claim-parity.test.ts`, asserted here at the CSR-payload boundary.
import { describe, it, expect } from "vitest";
import { SubjectSchema, ExtensionsSchema, FPDeviceIDSessionSchema, FPDeviceIDCSRPayloadSchema } from "./device-id-payload.js";
import {
  SubjectSchema as UpstreamSubject,
  ExtensionsSchema as UpstreamExtensions,
  FPDeviceIDSessionSchema as UpstreamSession,
  FPDeviceIDCSRPayloadSchema as UpstreamCSR,
} from "@fireproof/core-types-base";

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

describe("device-id payload schemas — owned vs upstream parity (non-Clerk parts)", () => {
  it("Subject: owned and upstream agree on accept/reject", () => {
    expect(SubjectSchema.safeParse(subject).success).toBe(true);
    expect(SubjectSchema.safeParse(subject).success).toBe(UpstreamSubject.safeParse(subject).success);
    // commonName is required.
    expect(SubjectSchema.safeParse({}).success).toBe(false);
    expect(SubjectSchema.safeParse({}).success).toBe(UpstreamSubject.safeParse({}).success);
    // countryName must be length 2.
    const badCountry = { commonName: "d", countryName: "USA" };
    expect(SubjectSchema.safeParse(badCountry).success).toBe(false);
    expect(SubjectSchema.safeParse(badCountry).success).toBe(UpstreamSubject.safeParse(badCountry).success);
  });

  it("Extensions: owned and upstream agree", () => {
    const ext = { keyUsage: ["digitalSignature"], extendedKeyUsage: ["serverAuth"] };
    expect(ExtensionsSchema.safeParse(ext).success).toBe(true);
    expect(ExtensionsSchema.safeParse(ext).success).toBe(UpstreamExtensions.safeParse(ext).success);
    const badEnum = { keyUsage: ["notAUsage"] };
    expect(ExtensionsSchema.safeParse(badEnum).success).toBe(false);
    expect(ExtensionsSchema.safeParse(badEnum).success).toBe(UpstreamExtensions.safeParse(badEnum).success);
  });

  it("FPDeviceIDSession: owned and upstream agree (valid + strict + seq bounds)", () => {
    expect(FPDeviceIDSessionSchema.safeParse(validSession).success).toBe(true);
    expect(UpstreamSession.safeParse(validSession).success).toBe(true);
    // .strict() rejects unknown keys.
    const extra = { ...validSession, bogus: 1 };
    expect(FPDeviceIDSessionSchema.safeParse(extra).success).toBe(false);
    expect(FPDeviceIDSessionSchema.safeParse(extra).success).toBe(UpstreamSession.safeParse(extra).success);
    // seq must be a non-negative int.
    const negSeq = { ...validSession, seq: -1 };
    expect(FPDeviceIDSessionSchema.safeParse(negSeq).success).toBe(false);
    expect(FPDeviceIDSessionSchema.safeParse(negSeq).success).toBe(UpstreamSession.safeParse(negSeq).success);
  });

  it("FPDeviceIDCSRPayload: owned and upstream agree on a CSR with no clerk claim", () => {
    expect(FPDeviceIDCSRPayloadSchema.safeParse(csrPayload()).success).toBe(true);
    expect(UpstreamCSR.safeParse(csrPayload()).success).toBe(true);
    // .strict() at the csr level rejects unknown keys.
    const extra = { ...csrPayload(), csr: { ...csrPayload().csr, bogus: 1 } };
    expect(FPDeviceIDCSRPayloadSchema.safeParse(extra).success).toBe(false);
    expect(FPDeviceIDCSRPayloadSchema.safeParse(extra).success).toBe(UpstreamCSR.safeParse(extra).success);
  });
});

describe("device-id CSR payload — owned Clerk-claim leniency (patch-removal gate)", () => {
  it("accepts a CSR whose creatingUser clerk claim omits first/image_url/last/name", () => {
    // The whole point of owning these schemas leniently: the owned schema accepts
    // the lean claim...
    expect(FPDeviceIDCSRPayloadSchema.safeParse(csrPayload({ type: "clerk", claims: leanClerkClaim })).success).toBe(true);
    // ...whereas the now-unpatched upstream schema rejects it. (If this flips, the
    // upstream patch is somehow back — a real regression to investigate.)
    expect(UpstreamCSR.safeParse(csrPayload({ type: "clerk", claims: leanClerkClaim })).success).toBe(false);
  });

  it("accepts a CSR whose creatingUser carries a fully-populated clerk claim", () => {
    expect(FPDeviceIDCSRPayloadSchema.safeParse(csrPayload({ type: "clerk", claims: fullClerkClaim })).success).toBe(true);
  });
});
