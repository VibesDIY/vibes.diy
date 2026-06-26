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
  it("exposes viewer + access", () => {
    const r = renderWith(baseEnv);
    expect(r.viewer?.userHandle).toBe("alice");
    expect(r.access).toBe("override");
  });

  it("returns sensible defaults when no viewerEnv was provided", () => {
    const r = renderWith(undefined);
    expect(r.viewer).toBeNull();
    expect(r.access).toBe("none");
  });

  it("can() is a membership check driven by access level", () => {
    // editor — read + write member
    const editor = renderWith({ viewer: { userHandle: "bob" }, access: "editor" as const });
    expect(editor.can("read")).toBe(true);
    expect(editor.can("write")).toBe(true);
    expect(editor.can("delete")).toBe(true);

    // viewer — read-only member
    const viewer = renderWith({ viewer: { userHandle: "carol" }, access: "viewer" as const });
    expect(viewer.can("read")).toBe(true);
    expect(viewer.can("write")).toBe(false);

    // submitter — write-only member
    const submitter = renderWith({ viewer: { userHandle: "dave" }, access: "submitter" as const });
    expect(submitter.can("read")).toBe(false);
    expect(submitter.can("write")).toBe(true);

    // not a member — through neither read nor write
    const none = renderWith({ viewer: null, access: "none" as const });
    expect(none.can("read")).toBe(false);
    expect(none.can("write")).toBe(false);
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

  it("owner with admin off: access is editor, can() evaluates as editor member", () => {
    const r = renderWith({ ...baseEnv, access: "editor" as const, isOwner: true });
    expect(r.access).toBe("editor");
    expect(r.isOwner).toBe(true);
    expect(r.can("write")).toBe(true);
  });

  it("owner with admin on: access is override, can() evaluates as member", () => {
    const r = renderWith({ ...baseEnv, access: "override" as const, isOwner: true });
    expect(r.access).toBe("override");
    expect(r.isOwner).toBe(true);
    expect(r.can("write")).toBe(true);
  });
});
