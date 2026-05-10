import React from "react";
import { describe, it, expect } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { VibeContextProvider, useVibeContext, type Vibe } from "@vibes.diy/vibe-runtime";

function Probe({ onCtx }: { onCtx: (ctx: ReturnType<typeof useVibeContext>) => void }) {
  const ctx = useVibeContext();
  onCtx(ctx);
  return null;
}

describe("VibeContextProvider", () => {
  it("exposes mountParams.viewerEnv on the context", () => {
    let captured: Vibe | undefined;
    render(
      <VibeContextProvider
        mountParams={{
          usrEnv: {},
          viewerEnv: {
            viewer: { userSlug: "alice", avatarUrl: "https://api.example.com/u/alice/avatar" },
            access: "owner",
          },
        }}
      >
        <Probe onCtx={(c) => (captured = c)} />
      </VibeContextProvider>
    );
    expect(captured?.mountParams.viewerEnv?.viewer?.userSlug).toBe("alice");
    expect(captured?.mountParams.viewerEnv?.access).toBe("owner");
  });

  it("updates viewerEnv when vibe.evt.viewerChanged fires", async () => {
    let captured: Vibe | undefined;
    render(
      <VibeContextProvider
        mountParams={{
          usrEnv: {},
          viewerEnv: { viewer: null, access: "none" },
        }}
      >
        <Probe onCtx={(c) => (captured = c)} />
      </VibeContextProvider>
    );
    expect(captured?.mountParams.viewerEnv?.viewer).toBeNull();

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "vibe.evt.viewerChanged",
          viewer: { userSlug: "alice", displayName: "Alice", avatarUrl: "https://api.example.com/u/alice/avatar" },
          access: "viewer",
        },
      })
    );

    // Wait for React state update to propagate.
    await waitFor(() => {
      expect(captured?.mountParams.viewerEnv?.viewer?.userSlug).toBe("alice");
    });
    expect(captured?.mountParams.viewerEnv?.access).toBe("viewer");
    // avatarUrl is on the viewer object, not in viewerEnv root.
    expect(captured?.mountParams.viewerEnv?.viewer?.avatarUrl).toBe("https://api.example.com/u/alice/avatar");
  });
});
