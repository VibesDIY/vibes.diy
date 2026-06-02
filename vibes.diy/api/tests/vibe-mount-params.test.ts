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
        viewer: { ownerHandle: "alice", displayName: "Alice", avatarUrl: "https://api.vibes.diy/u/alice/avatar" },
        access: "owner",
        dbAcls: { comments: { write: ["members"] } },
      },
    });
    expect(r instanceof type.errors).toBe(false);
  });

  it("accepts viewerEnv with grants", () => {
    const r = vibeMountParams({
      usrEnv: {},
      viewerEnv: {
        viewer: { ownerHandle: "alice", displayName: "Alice", avatarUrl: "https://api.vibes.diy/u/alice/avatar" },
        access: "owner",
        grants: { chat: { channels: ["general", "random"], roles: ["admin"] } },
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

  it("rejects viewer missing avatarUrl", () => {
    const r = vibeMountParams({
      usrEnv: {},
      viewerEnv: {
        viewer: { ownerHandle: "alice" },
        access: "owner",
      },
    });
    expect(r instanceof type.errors).toBe(true);
  });
});
