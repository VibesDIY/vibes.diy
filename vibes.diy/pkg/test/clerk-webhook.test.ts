import { Lazy } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { describe, expect, it } from "vitest";
import { buildSignupEmbed, verifyClerkWebhookSignature, ClerkUserCreatedData } from "../workers/clerk-webhook.js";

const sthis = Lazy(() => ensureSuperThis());

function encodeUtf8(value: string): ArrayBuffer {
  return Uint8Array.from(sthis().txt.encode(value)).buffer as ArrayBuffer;
}

async function signSvix(rawSecretBase64: string, svixId: string, svixTimestamp: string, body: string): Promise<string> {
  const secretBytes = Uint8Array.from(atob(rawSecretBase64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const toSign = encodeUtf8(`${svixId}.${svixTimestamp}.${body}`);
  const sig = await crypto.subtle.sign("HMAC", key, toSign);
  return `v1,${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
}

const TEST_SECRET_B64 = "dGVzdC1zZWNyZXQtMzItYnl0ZXMtZm9yLXRlc3Rpbmch";
const TEST_SECRET = `whsec_${TEST_SECRET_B64}`;

const BASE_USER: ClerkUserCreatedData = {
  id: "user_2abc123",
  username: "jchris",
  first_name: "J",
  last_name: "Chris",
  email_addresses: [{ email_address: "jchris@example.com" }, { email_address: "alt@example.com" }],
  created_at: 1748304000000,
};

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
    const svixSignature = await signSvix(TEST_SECRET_B64, svixId, svixTimestamp, body);

    const result = await verifyClerkWebhookSignature({
      body: body + " ",
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
      svixTimestamp: String(Math.floor(Date.now() / 1000)),
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

describe("buildSignupEmbed", () => {
  it("includes username as display name when set", () => {
    const embed = buildSignupEmbed(BASE_USER);
    expect(embed.content).toContain("**jchris**");
    expect(embed.embeds?.[0]?.title).toBe("jchris");
  });

  it("falls back to first email when username is null", () => {
    const embed = buildSignupEmbed({ ...BASE_USER, username: null });
    expect(embed.content).toContain("**jchris@example.com**");
  });

  it("includes user_id field", () => {
    const embed = buildSignupEmbed(BASE_USER);
    const fields = embed.embeds?.[0]?.fields ?? [];
    const idField = fields.find((f) => f.name === "User ID");
    expect(idField?.value).toBe("user_2abc123");
  });

  it("includes full name from first_name + last_name", () => {
    const embed = buildSignupEmbed(BASE_USER);
    const fields = embed.embeds?.[0]?.fields ?? [];
    const nameField = fields.find((f) => f.name === "Name");
    expect(nameField?.value).toBe("J Chris");
  });

  it("shows (not set) when name parts are null", () => {
    const embed = buildSignupEmbed({ ...BASE_USER, first_name: null, last_name: null });
    const fields = embed.embeds?.[0]?.fields ?? [];
    const nameField = fields.find((f) => f.name === "Name");
    expect(nameField?.value).toBe("(not set)");
  });

  it("includes all email addresses and count in field name", () => {
    const embed = buildSignupEmbed(BASE_USER);
    const fields = embed.embeds?.[0]?.fields ?? [];
    const emailField = fields.find((f) => f.name === "Emails (2)");
    expect(emailField).toBeDefined();
    expect(emailField?.value).toContain("jchris@example.com");
    expect(emailField?.value).toContain("alt@example.com");
  });

  it("uses singular 'email' when count is 1", () => {
    const embed = buildSignupEmbed({ ...BASE_USER, email_addresses: [{ email_address: "solo@example.com" }] });
    expect(embed.content).toContain("1 email)");
  });

  it("uses plural 'emails' when count is 2+", () => {
    const embed = buildSignupEmbed(BASE_USER);
    expect(embed.content).toContain("2 emails)");
  });

  it("includes created_at as ISO string", () => {
    const embed = buildSignupEmbed(BASE_USER);
    const fields = embed.embeds?.[0]?.fields ?? [];
    const tsField = fields.find((f) => f.name === "Signed up");
    expect(tsField?.value).toBe(new Date(1748304000000).toISOString());
  });

  it("includes username field", () => {
    const embed = buildSignupEmbed(BASE_USER);
    const fields = embed.embeds?.[0]?.fields ?? [];
    const usernameField = fields.find((f) => f.name === "Username");
    expect(usernameField?.value).toBe("jchris");
  });

  it("shows (not set) for username when null", () => {
    const embed = buildSignupEmbed({ ...BASE_USER, username: null });
    const fields = embed.embeds?.[0]?.fields ?? [];
    const usernameField = fields.find((f) => f.name === "Username");
    expect(usernameField?.value).toBe("(not set)");
  });
});
