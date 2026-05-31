import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VibeContextProvider, type ViewerEnv } from "@vibes.diy/vibe-runtime";
import { useViewer } from "@vibes.diy/use-vibes-base";

// Wrap in provider and render the component via useViewer to get ViewerTag
function renderViewerTag(env: ViewerEnv | undefined, props: Record<string, unknown> = {}) {
  function Inner() {
    const { ViewerTag } = useViewer();
    return <ViewerTag {...(props as Parameters<typeof ViewerTag>[0])} />;
  }
  render(
    <VibeContextProvider mountParams={{ usrEnv: {}, ...(env ? { viewerEnv: env } : {}) }}>
      <Inner />
    </VibeContextProvider>
  );
}

const aliceEnv: ViewerEnv = {
  viewer: { userHandle: "alice", displayName: "Alice", avatarUrl: "https://api.test/u/alice/avatar" },
  access: "owner",
};

describe("ViewerTag", () => {
  it("renders the viewer slug in a pill when no props given", () => {
    renderViewerTag(aliceEnv);
    expect(screen.getByText("alice")).toBeTruthy();
  });

  it("renders another user's slug when ownerHandle prop is given", () => {
    renderViewerTag(aliceEnv, { ownerHandle: "bob" });
    expect(screen.getByText("bob")).toBeTruthy();
  });

  it("renders fallback when ownerHandle prop is present but undefined", () => {
    renderViewerTag(aliceEnv, { ownerHandle: undefined });
    expect(screen.getByText("no user handle provided")).toBeTruthy();
  });

  it("renders fallback when user prop has no ownerHandle", () => {
    renderViewerTag(aliceEnv, { user: { ownerHandle: "" } });
    expect(screen.getByText("no user handle provided")).toBeTruthy();
  });

  it("does not show edit ring for another user", () => {
    renderViewerTag(aliceEnv, { ownerHandle: "bob" });
    // file input should not be present
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("shows edit affordance (file input) when viewing self", () => {
    renderViewerTag(aliceEnv);
    expect(document.querySelector('input[type="file"]')).toBeTruthy();
  });

  it("shows a sign-in button when viewer is anonymous and no props given", () => {
    renderViewerTag(undefined);
    expect(screen.getByText("Sign in")).toBeTruthy();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("does not show edit ring when ownerHandle matches viewer but viewer is null", () => {
    renderViewerTag(undefined, { ownerHandle: undefined });
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("uses user.avatarUrl when provided via object prop", () => {
    renderViewerTag(aliceEnv, {
      user: { ownerHandle: "bob", avatarUrl: "https://custom.test/bob.png" },
    });
    const img = document.querySelector("img") as HTMLImageElement;
    expect(img?.src).toBe("https://custom.test/bob.png");
  });
});
