import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { VibeContextProvider } from "@vibes.diy/vibe-runtime";
import { useViewer } from "@vibes.diy/use-vibes-base";

/**
 * A small vibe component that uses useViewer to gate its UI.
 * This is the "real consumer" that exercises the full chain:
 *   mountParams.viewerEnv → VibeContextProvider → useViewer → DOM
 */
function App() {
  const { viewer, can } = useViewer();
  if (!viewer) return <div data-testid="state">Sign in</div>;
  return (
    <div data-testid="state">
      <span data-testid="name">{viewer.displayName ?? viewer.userHandle}</span>
      {can("write", "comments") ? <button data-testid="write">Post</button> : null}
    </div>
  );
}

/**
 * Integration tests for useViewer.
 *
 * The unit tests for VibeContextProvider (Task 10) and useViewer (Task 11) both
 * use a "Probe" pattern that captures hook return values — they do NOT assert on
 * rendered DOM or verify that a real component re-renders correctly after an event.
 * These tests cover that seam:
 *   - DOM reflects the correct signed-out/signed-in state
 *   - vibe.evt.viewerChanged causes the component to re-render with updated identity
 */
describe("useViewer integration", () => {
  afterEach(() => {
    cleanup();
  });

  it("anon mount: shows sign-in prompt in DOM", () => {
    render(
      <VibeContextProvider mountParams={{ usrEnv: {} }}>
        <App />
      </VibeContextProvider>
    );
    expect(screen.getByTestId("state")).toHaveTextContent("Sign in");
  });

  it("authed owner mount: DOM shows name and write button", () => {
    render(
      <VibeContextProvider
        mountParams={{
          usrEnv: {},
          viewerEnv: {
            viewer: { userHandle: "alice", displayName: "Alice" },
            access: "override",
          },
        }}
      >
        <App />
      </VibeContextProvider>
    );
    expect(screen.getByTestId("name").textContent).toBe("Alice");
    expect(screen.getByTestId("write")).toBeTruthy();
  });

  it("viewerChanged event causes component to re-render with new identity in DOM", async () => {
    render(
      <VibeContextProvider
        mountParams={{
          usrEnv: {},
          viewerEnv: { viewer: null, access: "none" },
        }}
      >
        <App />
      </VibeContextProvider>
    );
    expect(screen.getByTestId("state")).toHaveTextContent("Sign in");

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "vibe.evt.viewerChanged",
          viewer: { userHandle: "alice", displayName: "Alice" },
          access: "viewer",
        },
      })
    );

    await waitFor(() => {
      expect(screen.queryByTestId("name")?.textContent).toBe("Alice");
    });
    // viewer role — no write button
    expect(screen.queryByTestId("write")).toBeNull();
  });
});
