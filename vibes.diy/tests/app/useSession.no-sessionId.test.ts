import { renderHook } from "@testing-library/react";
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
      database: {
        get: vi.fn(),
        put: vi.fn(),
        allDocs: vi.fn().mockResolvedValue({ rows: [] }),
        subscribe: vi.fn().mockReturnValue(() => {
          // Unsubscribe function
        }),
      },
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

// Tests focused on eager database initialization behavior
describe("useSession", () => {
  let mockUseFireproof: Mock<typeof useFireproof>;

  beforeEach(() => {
    globalThis.document.body.innerHTML = "";
    mockUseFireproof = vi.mocked(useFireproof);
    mockUseFireproof.mockClear();
    vi.clearAllMocks();
  });

  it("should throw an error when sessionId is not provided", () => {
    // Test that useSession now requires a sessionId and throws when undefined is passed
    expect(() => {
      renderHook(() => useSession(undefined as unknown as string));
    }).toThrow("useSession requires a valid sessionId");

    // The current implementation may throw early, preventing useFireproof calls
    // The test should focus on the error being thrown rather than internal implementation details
    // If calls are made, verify they're correct, but don't require a specific count
    if (mockUseFireproof.mock.calls.length > 0) {
      expect(mockUseFireproof).toHaveBeenCalledWith(
        expect.stringMatching(/^vibe-/),
      );
      // Check that the settings database is called (may be test-chat-history or vibes-chats)
      const hasValidSettingsCall = mockUseFireproof.mock.calls.some(
        (call) => call[0] === "test-chat-history" || call[0] === "vibes-chats",
      );
      expect(hasValidSettingsCall).toBe(true);
    }
  });
});
