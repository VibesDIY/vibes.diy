// Slice B5 (#2856) security: the `_api` forward sanitizer. A client `_api` request
// must not be able to invoke a control-plane op (arm/onChange) on the BackendDO, nor
// redirect to another vibe, by smuggling internal headers (Charlie blocker).

import { describe, expect, it } from "vitest";
import {
  sanitizeBackendApiForwardHeaders,
  narrowIsolateDbEgress,
  BACKEND_OP_HEADER,
  BACKEND_OWNER_HEADER,
  BACKEND_SLUG_HEADER,
} from "@vibes.diy/api-svc/intern/backend-do-addr.js";
import { BACKEND_DB_OP_URL } from "@vibes.diy/api-svc/intern/backend-db-op.js";

describe("sanitizeBackendApiForwardHeaders (#2856 B5 security)", () => {
  it("strips a client-supplied x-backend-op so _api traffic can't invoke arm/onChange", () => {
    const h = new Headers({ [BACKEND_OP_HEADER]: "onchange", "content-type": "application/json", "x-keep": "yes" });
    sanitizeBackendApiForwardHeaders(h, { ownerHandle: "real-owner", appSlug: "real-slug" });
    expect(h.get(BACKEND_OP_HEADER)).toBe(null);
    // unrelated headers are preserved — we only strip the internal control header.
    expect(h.get("x-keep")).toBe("yes");
    expect(h.get("content-type")).toBe("application/json");
  });

  it("also strips a client-supplied arm op", () => {
    const h = new Headers({ [BACKEND_OP_HEADER]: "arm" });
    sanitizeBackendApiForwardHeaders(h, { ownerHandle: "o", appSlug: "s" });
    expect(h.get(BACKEND_OP_HEADER)).toBe(null);
  });

  it("overrides client-supplied owner/slug with the resolved target (no cross-vibe redirect)", () => {
    const h = new Headers({ [BACKEND_OWNER_HEADER]: "attacker", [BACKEND_SLUG_HEADER]: "evil" });
    sanitizeBackendApiForwardHeaders(h, { ownerHandle: "real-owner", appSlug: "real-slug" });
    expect(h.get(BACKEND_OWNER_HEADER)).toBe("real-owner");
    expect(h.get(BACKEND_SLUG_HEADER)).toBe("real-slug");
  });
});

// #2856 security review: the isolate's `globalOutbound` self-stub must expose ONLY
// the nonce-gated db-op URL, so untrusted handler code can't reach the DO's
// control-plane ops (arm/onChange) — where it could forge `writerUserId` (identity
// spoof) or reset `depth` (loop-guard bypass / onChange amplification) — nor egress.
describe("narrowIsolateDbEgress (#2856 security)", () => {
  // OK vs FORBIDDEN share one type so the helper's `Res` generic unifies (in real
  // use both legs are a CF `Response`).
  const FORBIDDEN = "FORBIDDEN" as const;
  // A fake raw DO stub: records every forwarded request and echoes an OK sentinel.
  const fakeStub = () => {
    const seen: string[] = [];
    return {
      seen,
      fetch(request: { url: string }): Promise<"OK" | "FORBIDDEN"> {
        seen.push(request.url);
        return Promise.resolve("OK");
      },
    };
  };

  it("forwards a request to the exact db-op URL to the raw stub", async () => {
    const raw = fakeStub();
    const stub = narrowIsolateDbEgress(raw, (): "OK" | "FORBIDDEN" => FORBIDDEN);
    const res = await stub.fetch({ url: BACKEND_DB_OP_URL });
    expect(res).toBe("OK");
    expect(raw.seen).toEqual([BACKEND_DB_OP_URL]);
  });

  it("blocks a forged control-plane poke (arm/onChange) without touching the stub", async () => {
    const raw = fakeStub();
    const stub = narrowIsolateDbEgress(raw, (): "OK" | "FORBIDDEN" => FORBIDDEN);
    // The handler knows its own owner/slug (ctx.appInfo) and could craft this to the
    // DO's `fetch` router — the narrowed stub refuses it before it lands.
    const res = await stub.fetch({ url: "https://internal/__backend_onchange" });
    expect(res).toBe(FORBIDDEN);
    expect(raw.seen).toEqual([]);
  });

  it("blocks arbitrary open-Internet egress", async () => {
    const raw = fakeStub();
    const stub = narrowIsolateDbEgress(raw, (): "OK" | "FORBIDDEN" => FORBIDDEN);
    expect(await stub.fetch({ url: "https://evil.example/steal" })).toBe(FORBIDDEN);
    expect(raw.seen).toEqual([]);
  });

  it("blocks a near-miss URL (prefix/suffix) — only an exact match is the db-op channel", async () => {
    const raw = fakeStub();
    const stub = narrowIsolateDbEgress(raw, (): "OK" | "FORBIDDEN" => FORBIDDEN);
    expect(await stub.fetch({ url: `${BACKEND_DB_OP_URL}/../__backend_arm` })).toBe(FORBIDDEN);
    expect(await stub.fetch({ url: `${BACKEND_DB_OP_URL}?x=1` })).toBe(FORBIDDEN);
    expect(raw.seen).toEqual([]);
  });
});
