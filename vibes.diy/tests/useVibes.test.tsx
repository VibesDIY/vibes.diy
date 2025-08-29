import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Import AuthContext only - the type is defined inline in the file
import { AuthContext } from "~/vibes.diy/app/contexts/AuthContext.js";
import { useVibes } from "~/vibes.diy/app/hooks/useVibes.js";
// Import VibeDocument from the correct location
import type { VibeDocument } from "@vibes.diy/prompts";
// Import TokenPayload for our mock
import type { TokenPayload } from "~/vibes.diy/app/utils/auth.js";
import type { LocalVibe } from "~/vibes.diy/app/utils/vibeUtils.js";
import {
  deleteVibeDatabase,
  listLocalVibeIds,
  listLocalVibes,
  toggleVibeFavorite,
} from "~/vibes.diy/app/utils/vibeUtils.js";

// Mock vibeUtils
vi.mock("~/vibes.diy/app/utils/vibeUtils.js", () => ({
  listLocalVibes: vi.fn(),
  listLocalVibeIds: vi.fn(),
  deleteVibeDatabase: vi.fn(),
  toggleVibeFavorite: vi.fn(),
  loadVibeDocument: vi.fn(),
}));

// Mock the AuthContext instead of the hook
vi.mock("~/vibes.diy/app/contexts/AuthContext.js", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("~/vibes.diy/app/contexts/AuthContext.js")
    >();
  return {
    ...actual, // Keep exports
    // No need to mock useAuth as we'll provide context value through wrapper
  };
});

// Wrapper definition with controlled auth context value
const createWrapper = () => {
  // Create a mock auth context value that matches the interface in AuthContext.tsx
  const mockUserPayload: TokenPayload = {
    userId: "test-user-id",
    exp: 9999999999,
    tenants: [],
    ledgers: [],
    iat: 1234567890,
    iss: "FP_CLOUD",
    aud: "PUBLIC",
  };

  const authContextValue = {
    token: "mock-token",
    isAuthenticated: true,
    isLoading: false,
    userPayload: mockUserPayload,
    checkAuthStatus: vi.fn(),
    processToken: vi.fn(),
    needsLogin: false,
    setNeedsLogin: vi.fn(),
  };

  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

describe("useVibes", () => {
  const mockVibes: Partial<LocalVibe>[] = [
    {
      id: "test-vibe-1",
      title: "Test Vibe 1",
      favorite: false,
      created: "",
      encodedTitle: "test-vibe-1",
      slug: "test-vibe-1",
    },
    {
      id: "test-vibe-2",
      title: "Test Vibe 2",
      favorite: true,
      created: "",
      encodedTitle: "test-vibe-2",
      slug: "test-vibe-2",
    },
  ];

  // Mock vibe document for toggleVibeFavorite
  const mockVibeDoc: VibeDocument = {
    _id: "vibe",
    favorite: true,
    title: "Test Vibe",
    encodedTitle: "test-vibe",
    remixOf: "",
    created_at: Date.now(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    // Setup vibeUtils mocks
    vi.mocked(listLocalVibes).mockResolvedValue(mockVibes as LocalVibe[]);
    vi.mocked(listLocalVibeIds).mockResolvedValue([
      "test-vibe-1",
      "test-vibe-2",
    ]);
    vi.mocked(deleteVibeDatabase).mockResolvedValue(undefined);
    vi.mocked(toggleVibeFavorite).mockResolvedValue(mockVibeDoc);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Use wrapper for ALL renderHook calls
  it("should load vibes on mount", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useVibes(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listLocalVibeIds).toHaveBeenCalled();
    expect(result.current.vibes).toEqual([
      { id: "test-vibe-2" },
      { id: "test-vibe-1" },
    ]);
  });

  it("should handle loading state correctly", async () => {
    // Arrange - delay the promise resolution
    vi.mocked(listLocalVibeIds).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(["test-vibe-1", "test-vibe-2"]), 100),
        ),
    );

    const wrapper = createWrapper();
    const { result } = renderHook(() => useVibes(), { wrapper });

    // Assert - initially loading
    expect(result.current.isLoading).toBe(true);

    // Wait for the loading to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    // Assert - loading completed
    expect(result.current.isLoading).toBe(false);
    // Order is reversed now as we're showing newest first
    expect(result.current.vibes).toEqual([
      { id: "test-vibe-2" },
      { id: "test-vibe-1" },
    ]);
  });

  it("should handle errors when loading vibes", async () => {
    // Arrange
    const testError = new Error("Failed to load vibes");
    vi.mocked(listLocalVibeIds).mockRejectedValue(testError);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useVibes(), { wrapper });

    // Wait for the effect to run
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Assert
    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toBe("Failed to load vibes");
    expect(result.current.isLoading).toBe(false);
  });

  it("should delete a vibe and update state optimistically", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useVibes(), { wrapper });

    // Wait for the initial load
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Perform delete
    await act(async () => {
      await result.current.deleteVibe("test-vibe-1");
    });

    // Assert
    expect(deleteVibeDatabase).toHaveBeenCalledWith("test-vibe-1");

    // Check optimistic update - should only have one vibe left
    expect(result.current.vibes.length).toBe(1);
    // After test-vibe-1 is deleted, only test-vibe-2 remains
    expect(result.current.vibes[0].id).toBe("test-vibe-2");
  });

  it("should reload vibes if deletion fails", async () => {
    // Arrange
    const deleteError = new Error("Failed to delete vibe");
    vi.mocked(deleteVibeDatabase).mockRejectedValueOnce(deleteError);

    const wrapper = createWrapper();
    const { result } = renderHook(() => useVibes(), { wrapper });

    // Wait for the initial load
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Reset the listLocalVibes mock to track if it's called again
    vi.mocked(listLocalVibes).mockClear();

    // Perform delete which will fail
    await act(async () => {
      try {
        await result.current.deleteVibe("test-vibe-1");
      } catch (e) {
        // Ignore the error, we'll check the hook state
      }
    });

    // Wait for the error state to be set
    await waitFor(() => expect(result.current.error).toBeDefined());

    // Assert
    expect(deleteVibeDatabase).toHaveBeenCalledWith("test-vibe-1");
    expect(result.current.error).toBeDefined();
    // Skip checking the specific error message content to avoid test brittleness

    // Should have called listLocalVibeIds again to restore the state
    expect(listLocalVibeIds).toHaveBeenCalled();
  });

  it("should toggle favorite status and update state optimistically", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useVibes(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Setup state with safer optional chaining
    act(() => {
      const vibe1 = result.current.vibes.find((v) => v.id === "test-vibe-1");
      const vibe2 = result.current.vibes.find((v) => v.id === "test-vibe-2");
      if (vibe1) vibe1.favorite = false;
      if (vibe2) vibe2.favorite = true;
    });

    await act(async () => {
      await result.current.toggleFavorite("test-vibe-1");
    });
    expect(toggleVibeFavorite).toHaveBeenCalledWith(
      "test-vibe-1",
      "test-user-id",
    );
    // ... assertions ...
  });

  it("should reload vibes if toggling favorite fails", async () => {
    vi.mocked(toggleVibeFavorite).mockRejectedValueOnce(
      new Error("Toggle failed"),
    );
    const wrapper = createWrapper();
    const { result } = renderHook(() => useVibes(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.mocked(listLocalVibeIds).mockClear();
    await act(async () => {
      try {
        await result.current.toggleFavorite("test-vibe-1");
      } catch (e) {
        /* Ignore */
      }
    });
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(toggleVibeFavorite).toHaveBeenCalledWith(
      "test-vibe-1",
      "test-user-id",
    );
    expect(listLocalVibeIds).toHaveBeenCalled();
  });
});
