// Slice B5 (#2856) security: the `_api` forward sanitizer. A client `_api` request
// must not be able to invoke a control-plane op (arm/onChange) on the BackendDO, nor
// redirect to another vibe, by smuggling internal headers (Charlie blocker).

import { describe, expect, it } from "vitest";
import {
  sanitizeBackendApiForwardHeaders,
  BACKEND_OP_HEADER,
  BACKEND_OWNER_HEADER,
  BACKEND_SLUG_HEADER,
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
});
