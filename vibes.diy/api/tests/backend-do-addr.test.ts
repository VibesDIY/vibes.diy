// Slice B5 (#2856) security: the `_api` forward sanitizer. A client `_api` request
// must not be able to invoke a control-plane op (arm/onChange) on the BackendDO, nor
// redirect to another vibe, by smuggling internal headers (Charlie blocker).

import { describe, expect, it } from "vitest";
import {
  sanitizeBackendApiForwardHeaders,
  isControlPlaneAuthorized,
  BACKEND_OP_HEADER,
  BACKEND_OWNER_HEADER,
  BACKEND_SLUG_HEADER,
  BACKEND_INTERNAL_AUTH_HEADER,
} from "@vibes.diy/api-svc/intern/backend-do-addr.js";

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

  it("strips a client-supplied internal-auth header so _api can't smuggle a forged control-plane credential", () => {
    const h = new Headers({ [BACKEND_INTERNAL_AUTH_HEADER]: "guessed-secret", "x-keep": "yes" });
    sanitizeBackendApiForwardHeaders(h, { ownerHandle: "o", appSlug: "s" });
    expect(h.get(BACKEND_INTERNAL_AUTH_HEADER)).toBe(null);
    expect(h.get("x-keep")).toBe("yes");
  });
});

// #2856 security: the BackendDO control-plane ops (arm/onChange) are reachable via
// the isolate's globalOutbound self-stub (it can forge op + owner/slug from
// ctx.appInfo), so they're gated on a secret the isolate can't produce.
describe("isControlPlaneAuthorized (#2856 security)", () => {
  it("is permissive (merge-safe) when no secret is configured", () => {
    // Unconfigured env ⇒ unchanged pre-secret behavior, whatever header is present.
    expect(isControlPlaneAuthorized(undefined, null)).toBe(true);
    expect(isControlPlaneAuthorized(undefined, "anything")).toBe(true);
    expect(isControlPlaneAuthorized("", "anything")).toBe(true);
  });

  it("requires the exact secret once configured", () => {
    expect(isControlPlaneAuthorized("s3cret", "s3cret")).toBe(true);
  });

  it("rejects a missing or mismatched credential once configured (the isolate has no env)", () => {
    expect(isControlPlaneAuthorized("s3cret", null)).toBe(false);
    expect(isControlPlaneAuthorized("s3cret", "")).toBe(false);
    expect(isControlPlaneAuthorized("s3cret", "wrong")).toBe(false);
  });
});
