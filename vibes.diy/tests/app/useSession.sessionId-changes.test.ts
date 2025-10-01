import { renderHook, waitFor } from "@testing-library/react";
import { useSession } from "~/vibes.diy/app/hooks/useSession.js";
import { vi, describe, it, expect, beforeEach, Mock } from "vitest";
import { VibesDiyEnv } from "~/vibes.diy/app/config/env.js";

// Mock all required dependencies
VibesDiyEnv.env().sets({
  SETTINGS_DBNAME: "test-chat-history",
});

vi.mock("use-fireproof", async (original) => {
  const originalModule = (await original()) as typeof import("use-fireproof");
  // const mockFireproof = vi.fn().mockImplementation(() => {
  //   console.log("Mock fireproof called");
  // });
  const mockSubmitUserMessage = vi.fn().mockResolvedValue({ ok: true });
  const id = Math.random().toString(36).substring(2, 15);
  const mockUseFireproof = vi.fn().mockImplementation((name) => {
    // console.log("Mock fireproof called", name);
    if (!name) {
      console.trace("missing name");
      throw new Error("missing NAME");
    }
    return {
      id,
      useDocument: () => ({
        doc: { _id: "test-id", type: "user" },
        merge: vi.fn(),
        submit: mockSubmitUserMessage,
        save: vi.fn(),
      }),
      useLiveQuery: () => ({ docs: [] }),
      database: { get: vi.fn(), put: vi.fn() },
    } as unknown as ReturnType<typeof useFireproof>;
  });
  return {
    ...originalModule,
    // fireproof: mockFireproof,
    useFireproof: mockUseFireproof,
  };
});

// vi.mock("~/vibes.diy/app/utils/databaseManager.js", () => ({
//   getSessionDatabaseName: vi
//     .fn()
//     .mockImplementation((id) => `vibe-${id || "default"}`),
// }));

import { useFireproof } from "use-fireproof";

vi.mock("~/vibes.diy/app/contexts/AuthContext", () => ({
  useAuth: () => ({
    userPayload: null,
    isAuthenticated: false,
    isLoading: false,
    token: null,
    needsLogin: false,
    setNeedsLogin: vi.fn(),
    checkAuthStatus: vi.fn(),
    processToken: vi.fn(),
  }),
}));

// Need to mock useUserSettings since useSession now uses it
vi.mock("~/vibes.diy/app/hooks/useUserSettings", () => ({
  useUserSettings: () => ({
    isEnableSyncEnabled: false,
  }),
}));

// Need to mock useLocation since useSession now uses it
vi.mock("react-router", () => ({
  useLocation: () => ({
    pathname: "/test",
  }),
}));

// Tests focused on eager database initialization behavior
describe("useSession", () => {
  let mockUseFireproof: Mock<typeof useFireproof>;

  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    mockUseFireproof = vi.mocked(useFireproof);
    mockUseFireproof.mockClear();
    vi.clearAllMocks();
  });

  /**
   * This test verifies session ID transition behavior with eager initialization
   * When the sessionId changes, a new database should be initialized with the new name
   */
  it("should initialize new database when sessionId changes", async () => {
    // Start with first session ID
    const { rerender, result } = renderHook(
      ({ id }: { id: string }) => useSession(id),
      {
        initialProps: { id: "test-session-1" } as { id: string },
      },
    );

    await waitFor(() => {
      expect(result.current.sessionDatabase).toBeDefined();
      // expect(result.current.loading).toBe(false);
    });

    // Get the initial call count
    const initialCallCount = mockUseFireproof.mock.calls.length;
    const initialCall = mockUseFireproof.mock.calls[0][0];
    expect(initialCall).toMatch(/^vibe-/);

    // Simulate URL update with new session ID (after first message response)
    rerender({ id: "new-session-id" });

    // Verify new database is initialized with the new session ID
    // The call count should have increased
    expect(mockUseFireproof.mock.calls.length).toBeGreaterThan(
      initialCallCount,
    );
    expect(mockUseFireproof).toHaveBeenCalledWith("vibe-new-session-id", {});
  });
});
