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
  viewer: { userHandle: "alice", displayName: "Alice" },
  access: "override" as const,
};

function renderWith(env: ViewerEnv | undefined): UseViewerResult {
  let captured: UseViewerResult = {
    viewer: null,
    access: "none",
    isOwner: false,
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
    expect(r.access).toBe("override");
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
      viewer: { userHandle: "bob" },
      access: "viewer" as const,
      dbAcls: { comments: { write: ["members"] } },
    });
    expect(r.can("write", "comments")).toBe(true); // viewer is in members
    expect(r.can("write", "other")).toBe(false); // viewer cannot write by role
  });

  it("can(write) without dbName collapses for single-db case", () => {
    const r = renderWith({ viewer: { userHandle: "bob" }, access: "override" as const });
    expect(r.can("write")).toBe(true);
    const r2 = renderWith({ viewer: null, access: "none" as const });
    expect(r2.can("write")).toBe(false);
  });

  it("can(action) returns false if any configured override denies", () => {
    const r = renderWith({
      viewer: { userHandle: "bob" },
      access: "editor" as const,
      // "submitters"-only write means editors cannot write to lockedDb
      dbAcls: { lockedDb: { write: ["submitters"] } },
    });
    // Editor can write at the role-fallback level for "any other db", but
    // the lockedDb override is submitters-only — so global can("write") is false.
    expect(r.can("write")).toBe(false);
  });

  it("isViewerPending is true when viewerEnv is undefined, false when set", () => {
    expect(renderWith(undefined).isViewerPending).toBe(true);
    expect(renderWith(baseEnv).isViewerPending).toBe(false);
  });

  it("isOwner is true when viewerEnv.isOwner is true", () => {
    const r = renderWith({ ...baseEnv, access: "editor" as const, isOwner: true });
    expect(r.isOwner).toBe(true);
    expect(r.access).toBe("editor");
  });

  it("isOwner is false by default", () => {
    const r = renderWith({ ...baseEnv, access: "editor" as const });
    expect(r.isOwner).toBe(false);
  });

  it("owner with admin off: access is editor, can() evaluates as editor", () => {
    const r = renderWith({
      ...baseEnv,
      access: "editor" as const,
      isOwner: true,
      dbAcls: { restrictedDb: { write: ["submitters"] } },
    });
    expect(r.access).toBe("editor");
    expect(r.isOwner).toBe(true);
    expect(r.can("write", "restrictedDb")).toBe(false);
  });

  it("owner with admin on: access is owner, can() bypasses", () => {
    const r = renderWith({
      ...baseEnv,
      access: "override" as const,
      isOwner: true,
      dbAcls: { restrictedDb: { write: ["submitters"] } },
    });
    expect(r.access).toBe("override");
    expect(r.isOwner).toBe(true);
    expect(r.can("write", "restrictedDb")).toBe(true);
  });
});
