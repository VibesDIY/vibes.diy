import { describe, it, expect } from "vitest";
import { type } from "arktype";
import { vibeMountParams } from "@vibes.diy/vibe-runtime";

describe("vibeMountParams", () => {
  it("accepts minimal params (legacy)", () => {
    expect(vibeMountParams({ usrEnv: {} }) instanceof type.errors).toBe(false);
  });

  it("accepts viewerEnv with anon viewer", () => {
    const r = vibeMountParams({
      usrEnv: {},
      viewerEnv: {
        viewer: null,
        access: "none",
        apiBaseUrl: "https://api.vibes.diy",
      },
    });
    expect(r instanceof type.errors).toBe(false);
  });

  it("accepts viewerEnv with viewer + dbAcls", () => {
    const r = vibeMountParams({
      usrEnv: {},
      viewerEnv: {
        viewer: { userSlug: "alice", displayName: "Alice" },
        access: "owner",
        dbAcls: { comments: { write: ["members"] } },
        apiBaseUrl: "https://api.vibes.diy",
      },
    });
    expect(r instanceof type.errors).toBe(false);
  });

  it("rejects bad access value", () => {
    const r = vibeMountParams({
      usrEnv: {},
      viewerEnv: {
        viewer: null,
        access: "superadmin",
        apiBaseUrl: "https://api",
      },
    });
    expect(r instanceof type.errors).toBe(true);
  });
});
