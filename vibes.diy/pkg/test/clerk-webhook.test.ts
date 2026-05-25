import { Lazy } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { describe, expect, it } from "vitest";
import { buildCapiCompleteRegistration, verifyClerkWebhookSignature } from "../workers/clerk-webhook.js";

const sthis = Lazy(() => ensureSuperThis());

function encodeUtf8(value: string): ArrayBuffer {
  return Uint8Array.from(sthis().txt.encode(value)).buffer as ArrayBuffer;
}

// Computes a valid Svix HMAC-SHA256 signature for use in tests.
// Svix format: signed payload = "{svix-id}.{svix-timestamp}.{body}"
// Secret is raw bytes (the base64-decoded value of a "whsec_..." secret).
async function signSvix(rawSecretBase64: string, svixId: string, svixTimestamp: string, body: string): Promise<string> {
  const secretBytes = Uint8Array.from(atob(rawSecretBase64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const toSign = encodeUtf8(`${svixId}.${svixTimestamp}.${body}`);
  const sig = await crypto.subtle.sign("HMAC", key, toSign);
  return `v1,${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
}

// 32 random bytes base64-encoded — used as the raw signing key
const TEST_SECRET_B64 = "dGVzdC1zZWNyZXQtMzItYnl0ZXMtZm9yLXRlc3Rpbmch";
// "whsec_" prefix form that callers pass to verifyClerkWebhookSignature
const TEST_SECRET = `whsec_${TEST_SECRET_B64}`;

describe("verifyClerkWebhookSignature", () => {
  it("returns Ok with parsed body when signature is valid", async () => {
    const svixId = "msg_test_001";
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ type: "user.created", data: { email_addresses: [{ email_address: "test@example.com" }] } });
    const svixSignature = await signSvix(TEST_SECRET_B64, svixId, svixTimestamp, body);

    const result = await verifyClerkWebhookSignature({ body, svixId, svixTimestamp, svixSignature, secret: TEST_SECRET });

    expect(result.isOk()).toBe(true);
    const evt = result.Ok() as { type: string };
    expect(evt.type).toBe("user.created");
  });

  it("returns Err when signature does not match", async () => {
    const svixId = "msg_test_002";
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ type: "user.created", data: {} });
    const tampered = body + " ";

    const svixSignature = await signSvix(TEST_SECRET_B64, svixId, svixTimestamp, body);

    // Verify the tampered body — signature was computed over original body
    const result = await verifyClerkWebhookSignature({
      body: tampered,
      svixId,
      svixTimestamp,
      svixSignature,
      secret: TEST_SECRET,
    });

    expect(result.isErr()).toBe(true);
  });

  it("returns Err when secret is wrong", async () => {
    const svixId = "msg_test_003";
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ type: "user.created", data: {} });
    const wrongSecretB64 = "d3Jvbmctc2VjcmV0LTMyLWJ5dGVzLXdyb25nIQ==";
    const svixSignature = await signSvix(wrongSecretB64, svixId, svixTimestamp, body);

    const result = await verifyClerkWebhookSignature({ body, svixId, svixTimestamp, svixSignature, secret: TEST_SECRET });

    expect(result.isErr()).toBe(true);
  });

  it("returns Err when svix-signature header is malformed (no v1, prefix)", async () => {
    const result = await verifyClerkWebhookSignature({
      body: "{}",
      svixId: "msg_x",
      svixTimestamp: "1234567890",
      svixSignature: "notvalid",
      secret: TEST_SECRET,
    });
    expect(result.isErr()).toBe(true);
  });

  it("returns Err when svix-timestamp is more than 300s in the past", async () => {
    const svixId = "msg_test_stale";
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 301);
    const body = JSON.stringify({ type: "user.created", data: {} });
    const svixSignature = await signSvix(TEST_SECRET_B64, svixId, staleTimestamp, body);

    const result = await verifyClerkWebhookSignature({
      body,
      svixId,
      svixTimestamp: staleTimestamp,
      svixSignature,
      secret: TEST_SECRET,
    });

    expect(result.isErr()).toBe(true);
  });

  it("returns Err when svix-timestamp is non-numeric", async () => {
    const result = await verifyClerkWebhookSignature({
      body: "{}",
      svixId: "msg_x",
      svixTimestamp: "not-a-number",
      svixSignature: "v1,abc",
      secret: TEST_SECRET,
    });
    expect(result.isErr()).toBe(true);
  });
});

describe("buildCapiCompleteRegistration", () => {
  it("builds a CompleteRegistration event with SHA-256 hashed email", async () => {
    // SHA-256("user@example.com") = b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514
    const result = await buildCapiCompleteRegistration({
      email: "user@example.com",
      capiToken: "tok_reg",
      pixelId: "1310410873948425",
      request: new Request("https://vibes.diy/"),
    });
    const evt = result.data[0];

    expect(evt.event_name).toBe("CompleteRegistration");
    expect(evt.action_source).toBe("website");
    expect(evt.user_data.em).toBe("b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514");
    expect(result.access_token).toBe("tok_reg");
  });

  it("lowercases email before hashing", async () => {
    // "User@Example.COM" → lowercased → "user@example.com" → same hash
    const result = await buildCapiCompleteRegistration({
      email: "User@Example.COM",
      capiToken: "tok",
      pixelId: "1310410873948425",
      request: new Request("https://vibes.diy/"),
    });
    expect(result.data[0].user_data.em).toBe("b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514");
  });

  it("includes event_time and event_source_url", async () => {
    const nowBefore = Math.floor(Date.now() / 1000);
    const result = await buildCapiCompleteRegistration({
      email: "a@b.com",
      capiToken: "tok",
      pixelId: "1310410873948425",
      request: new Request("https://vibes.diy/"),
    });
    const nowAfter = Math.floor(Date.now() / 1000);

    expect(result.data[0].event_time).toBeGreaterThanOrEqual(nowBefore);
    expect(result.data[0].event_time).toBeLessThanOrEqual(nowAfter + 1);
    expect(result.data[0].event_source_url).toBe("https://vibes.diy/");
  });
});
