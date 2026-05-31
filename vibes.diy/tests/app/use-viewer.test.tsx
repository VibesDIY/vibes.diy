import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { VibeContextProvider, type ViewerEnv } from "@vibes.diy/vibe-runtime";
import { useViewer, type UseViewerResult } from "@vibes.diy/use-vibes-base";

function Probe({ onR }: { onR: (r: ReturnType<typeof useViewer>) => void }) {
  const r = useViewer();
  onR(r);
  return null;
}

const baseEnv = {
  viewer: { userHandle: "alice", displayName: "Alice", avatarUrl: "https://api.example.com/u/alice/avatar" },
  access: "owner" as const,
};

function renderWith(env: ViewerEnv | undefined): UseViewerResult {
  let captured: UseViewerResult = {
    viewer: null,
    access: "none",
    dbAcls: {},
    can: () => false,
    isViewerPending: true,
    ViewerTag: () => null,
  };
  render(
    <VibeContextProvider mountParams={{ usrEnv: {}, ...(env ? { viewerEnv: env } : {}) }}>
      <Probe onR={(r) => (captured = r)} />
    </VibeContextProvider>
  );
  return captured;
}

describe("useViewer", () => {
  it("exposes viewer + access + dbAcls", () => {
    const r = renderWith({ ...baseEnv, dbAcls: { comments: { write: ["members"] } } });
    expect(r.viewer?.userHandle).toBe("alice");
    expect(r.access).toBe("owner");
    expect(r.dbAcls.comments.write).toEqual(["members"]);
  });

  it("returns sensible defaults when no viewerEnv was provided", () => {
    const r = renderWith(undefined);
    expect(r.viewer).toBeNull();
    expect(r.access).toBe("none");
    expect(r.dbAcls).toEqual({});
  });

  it("can(write, dbName) consults the per-db ACL", () => {
    const r = renderWith({
      viewer: { userHandle: "bob", avatarUrl: "https://api/u/bob/avatar" },
      access: "viewer" as const,
      dbAcls: { comments: { write: ["members"] } },
    });
    expect(r.can("write", "comments")).toBe(true); // viewer is in members
    expect(r.can("write", "other")).toBe(false); // viewer cannot write by role
  });

  it("can(write) without dbName collapses for single-db case", () => {
    const r = renderWith({ viewer: { userHandle: "bob", avatarUrl: "https://api/u/bob/avatar" }, access: "owner" as const });
    expect(r.can("write")).toBe(true);
    const r2 = renderWith({ viewer: null, access: "none" as const });
    expect(r2.can("write")).toBe(false);
  });

  it("can(action) returns false if any configured override denies", () => {
    const r = renderWith({
      viewer: { userHandle: "bob", avatarUrl: "https://api/u/bob/avatar" },
      access: "editor" as const,
      // "submitters"-only write means editors cannot write to lockedDb
      dbAcls: { lockedDb: { write: ["submitters"] } },
    });
    // Editor can write at the role-fallback level for "any other db", but
    // the lockedDb override is submitters-only — so global can("write") is false.
    expect(r.can("write")).toBe(false);
  });

  it("viewer.avatarUrl is exposed as an opaque string", () => {
    const r = renderWith(baseEnv);
    expect(r.viewer?.avatarUrl).toBe("https://api.example.com/u/alice/avatar");
  });

  it("isViewerPending is true when viewerEnv is undefined, false when set", () => {
    expect(renderWith(undefined).isViewerPending).toBe(true);
    expect(renderWith(baseEnv).isViewerPending).toBe(false);
  });
});
