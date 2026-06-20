import { describe, it, expect } from "vitest";
import { aclAllows as hostAcl } from "@vibes.diy/api-svc/public/db-acl-resolver.js";
import { aclAllows as clientAcl } from "@vibes.diy/vibe-runtime";

// Host (api-svc) and client (vibe-runtime) ACL evaluation are now a single
// shared implementation in @vibes.diy/vibe-types. This test pins that invariant:
// both package exports must resolve to the *same* function reference, so they can
// never drift. A representative smoke call guards against an accidental rewire to
// some other identical-looking function.
describe("aclAllows host/client are the same shared implementation", () => {
  it("both package exports resolve to the identical function reference", () => {
    expect(clientAcl).toBe(hostAcl);
  });

  it("smoke: the shared impl still evaluates representative cases", () => {
    expect(clientAcl({ write: ["editors"] }, "write", "editor")).toBe(true);
    expect(clientAcl({ write: ["editors"] }, "write", "viewer")).toBe(false);
    expect(clientAcl(undefined, "read", "viewer")).toBe(true);
    expect(clientAcl(undefined, "write", "viewer")).toBe(false);
  });
});
