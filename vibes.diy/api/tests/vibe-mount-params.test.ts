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
      },
    });
    expect(r instanceof type.errors).toBe(false);
  });

  it("accepts viewerEnv with viewer + dbAcls", () => {
    const r = vibeMountParams({
      usrEnv: {},
      viewerEnv: {
        viewer: { userHandle: "alice", displayName: "Alice" },
        access: "override",
        dbAcls: { comments: { write: ["members"] } },
      },
    });
    expect(r instanceof type.errors).toBe(false);
  });

  it("accepts viewerEnv with grants", () => {
    const r = vibeMountParams({
      usrEnv: {},
      viewerEnv: {
        viewer: { userHandle: "alice", displayName: "Alice" },
        access: "override",
        grants: { chat: { channels: ["general", "random"], publicChannels: ["announcements"], roles: ["admin"] } },
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
      },
    });
    expect(r instanceof type.errors).toBe(true);
  });

  it("rejects viewer missing userHandle", () => {
    const r = vibeMountParams({
      usrEnv: {},
      viewerEnv: {
        viewer: { ownerHandle: "alice" },
        access: "override",
      },
    });
    expect(r instanceof type.errors).toBe(true);
  });
});
