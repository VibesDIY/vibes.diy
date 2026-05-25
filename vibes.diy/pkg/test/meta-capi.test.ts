import { describe, expect, it } from "vitest";
import type { CapiPayload } from "../workers/meta-capi.js";
import { buildCapiPayload, sendCapiPageView } from "../workers/meta-capi.js";

function expectCapiPayload(result: CapiPayload | undefined): CapiPayload {
  expect(result).toBeDefined();
  if (result === undefined) {
    throw new Error("Expected CAPI payload");
  }
  return result;
}

describe("buildCapiPayload", () => {
  it("returns undefined when no fbclid in URL", () => {
    const req = new Request("https://vibes.diy/");
    const result = buildCapiPayload(req, "tok_test");
    expect(result).toBeUndefined();
  });

  it("returns defined when fbclid is empty string (still fires)", () => {
    const req = new Request("https://vibes.diy/?fbclid=");
    const result = buildCapiPayload(req, "tok_test");
    // empty fbclid is still present — should still fire
    // (Meta's CAPI will reject it, but we send what we have)
    expect(result).toBeDefined();
  });

  it("builds a PageView event with fbc, ip, ua, and source url", () => {
    const req = new Request("https://vibes.diy/?fbclid=AbCdEfGh123", {
      headers: {
        "CF-Connecting-IP": "1.2.3.4",
        "User-Agent": "Mozilla/5.0 TestAgent",
      },
    });
    const nowBefore = Math.floor(Date.now() / 1000);
    const payload = expectCapiPayload(buildCapiPayload(req, "tok_test_secret"));
    const nowAfter = Math.floor(Date.now() / 1000);
    const evt = payload.data[0];

    expect(evt.event_name).toBe("PageView");
    expect(evt.action_source).toBe("website");
    expect(evt.event_time).toBeGreaterThanOrEqual(nowBefore);
    expect(evt.event_time).toBeLessThanOrEqual(nowAfter + 1);
    expect(evt.event_source_url).toBe("https://vibes.diy/");
    expect(evt.user_data.client_ip_address).toBe("1.2.3.4");
    expect(evt.user_data.client_user_agent).toBe("Mozilla/5.0 TestAgent");
    expect(evt.user_data.fbc).toMatch(/^fb\.1\.\d+\.AbCdEfGh123$/);
    expect(payload.access_token).toBe("tok_test_secret");
  });

  it("strips fbclid from event_source_url but keeps other params", () => {
    const req = new Request("https://vibes.diy/?utm_source=meta&fbclid=XYZ123");
    const payload = expectCapiPayload(buildCapiPayload(req, "tok_test"));

    expect(payload.data[0].event_source_url).toContain("utm_source=meta");
    expect(payload.data[0].event_source_url).not.toContain("fbclid");
  });

  it("falls back to empty string for missing IP and UA headers", () => {
    const req = new Request("https://vibes.diy/?fbclid=Test456");
    const payload = expectCapiPayload(buildCapiPayload(req, "tok_test"));

    expect(payload.data[0].user_data.client_ip_address).toBe("");
    expect(payload.data[0].user_data.client_user_agent).toBe("");
  });

  it("fbc timestamp is in milliseconds (not seconds)", () => {
    const req = new Request("https://vibes.diy/?fbclid=TimestampTest");
    const nowMs = Date.now();
    const payload = expectCapiPayload(buildCapiPayload(req, "tok_test"));
    const fbc = payload.data[0].user_data.fbc;
    // fbc format: fb.1.<ms-timestamp>.<fbclid>
    const parts = fbc.split(".");
    expect(parts).toHaveLength(4);
    const fbcMs = parseInt(parts[2], 10);
    // timestamp should be within 1 second of now
    expect(fbcMs).toBeGreaterThanOrEqual(nowMs - 1000);
    expect(fbcMs).toBeLessThanOrEqual(nowMs + 1000);
  });
});

describe("sendCapiPageView", () => {
  it("returns without error when no fbclid in URL (no network call)", async () => {
    // No fbclid → buildCapiPayload returns undefined → early return before fetch
    const req = new Request("https://vibes.diy/");
    await expect(sendCapiPageView(req, "tok_test")).resolves.toBeUndefined();
  });
});
