import { renderHook, waitFor } from "@testing-library/react";
import { useSession } from "~/vibes.diy/app/hooks/useSession.js";
import { vi, describe, it, expect, beforeEach, Mock } from "vitest";
import { VibesDiyEnv } from "~/vibes.diy/app/config/env.js";

// Mock all required dependencies
VibesDiyEnv.env().sets({
  SETTINGS_DBNAME: "test-chat-history",
});

vi.mock("@fireproof/use-fireproof", async (original) => {
  const originalModule =
    (await original()) as typeof import("@fireproof/use-fireproof");
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

import { useFireproof } from "@fireproof/use-fireproof";

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
   * NEW BEHAVIOR: Eager database initialization for observable side effects
   *
   * This test ensures our new behavior: databases are created eagerly to make
   * storage side effects observable during testing and initialization.
   * This is the opposite of the previous lazy loading behavior.
   */
  it("should follow eager database initialization pattern for observable side effects", async () => {
    const { result } = renderHook(() => useSession("test-session-id"));

    await waitFor(() => {
      expect(result.current.sessionDatabase).toBeDefined();
      // expect(result.current.loading).toBe(false);
    });

    // console.log(mockUseFireproof.mock.calls.length, mockUseFireproof.mock.calls);

    // Step 1: Database should be initialized immediately on first render
    // At least one call for the session DB and one for the settings DB
    expect(mockUseFireproof.mock.calls.length).toBe(2);

    // Step 2: Session document and functions should be available
    expect(result.current.session._id).toBeTruthy();
    expect(result.current.submitUserMessage).toBeTruthy();

    // Step 3: User actions should work normally with the already-initialized database
    await result.current.submitUserMessage();

    // The submitUserMessage should have been called once
    // (we can't easily test the mock submit function from inside the closure)
  });
});
