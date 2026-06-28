import { describe, expect, it } from "vitest";
import { chatShardsForMode, SHARD_POLICY, shardsForReq } from "@vibes.diy/api-types";
import { handlerManifest } from "../svc/evento-handler-manifest.js";

// The worker manifest derives its placement from `SHARD_POLICY` (#2714), so the
// two MUST stay 1:1: every handler maps to exactly one policy entry, and every
// policy entry is claimed by exactly one handler. A drift here means either a
// handler with no placement (dispatch gap) or a stale policy key (dead config).

describe("manifest ↔ SHARD_POLICY parity (#2714)", () => {
  it("every manifest reqType has exactly one SHARD_POLICY entry", () => {
    for (const e of handlerManifest) {
      expect(Object.prototype.hasOwnProperty.call(SHARD_POLICY, e.reqType), `no SHARD_POLICY entry for ${e.reqType}`).toBe(true);
    }
    // No two handlers share a reqType (each policy entry has one owner).
    const reqTypes = handlerManifest.map((e) => e.reqType);
    expect(new Set(reqTypes).size, "duplicate reqType in manifest").toBe(reqTypes.length);
  });

  it("every SHARD_POLICY key is used by exactly one manifest handler", () => {
    const reqTypes = new Set(handlerManifest.map((e) => e.reqType));
    for (const key of Object.keys(SHARD_POLICY)) {
      const owners = handlerManifest.filter((e) => e.reqType === key);
      expect(owners.length, `SHARD_POLICY key "${key}" must be claimed by exactly one handler`).toBe(1);
    }
    // Both sets are the same size → strict 1:1.
    expect(Object.keys(SHARD_POLICY).length, "policy/manifest key count mismatch").toBe(reqTypes.size);
  });

  it("doc writes resolve to vibe-only", () => {
    for (const reqType of ["vibes.diy.req-put-doc", "vibes.diy.req-subscribe-docs"]) {
      expect([...shardsForReq(reqType, {})].sort(), `${reqType} must be vibe-only`).toEqual(["vibe"]);
    }
  });

  it("chatShardsForMode refines codegen/img placement", () => {
    expect(chatShardsForMode("codegen")).toEqual(["codegen"]);
    expect([...chatShardsForMode("img")].sort()).toEqual(["codegen", "vibe"]);
  });
});
