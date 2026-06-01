import { act, renderHook, waitFor } from "@testing-library/react";
import type { ResRecentVibesItem } from "@vibes.diy/api-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRecentVibes } from "~/vibes.diy/app/hooks/useRecentVibes.js";

const mockAuth = { isLoaded: true, isSignedIn: true };
const mockUser = { id: "user-1" };
const mockListRecentVibes = vi.fn();
const mockVibeDiyApi = {
  listRecentVibes: mockListRecentVibes,
};

vi.mock("@clerk/react", () => ({
  useAuth: () => mockAuth,
  useUser: () => ({ user: mockUser }),
}));

vi.mock("~/vibes.diy/app/vibes-diy-provider.js", () => ({
  useVibesDiy: () => ({
    vibeDiyApi: mockVibeDiyApi,
  }),
}));

function okRecentVibes(items: ResRecentVibesItem[], nextCursor?: string) {
  return {
    isOk: () => true,
    isErr: () => false,
    Ok: () => ({ items, nextCursor }),
    Err: () => ({ message: "unexpected error" }),
  };
}

function makeItem(appSlug: string): ResRecentVibesItem {
  return {
    ownerHandle: "alice",
    appSlug,
    title: appSlug,
    updated: "2026-01-01T00:00:00.000Z",
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("useRecentVibes ensureAllLoaded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.isLoaded = true;
    mockAuth.isSignedIn = true;
    mockUser.id = "user-1";
  });

  it("loads all cursor pages when requested for search", async () => {
    mockListRecentVibes.mockImplementation(async ({ cursor }: { cursor?: string }) => {
      if (!cursor) return okRecentVibes([makeItem("first")], "cursor-1");
      if (cursor === "cursor-1") return okRecentVibes([makeItem("second")], "cursor-2");
      if (cursor === "cursor-2") return okRecentVibes([makeItem("third")], undefined);
      throw new Error(`unexpected cursor: ${cursor}`);
    });

    const { result } = renderHook(() => useRecentVibes(1));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.nextCursor).toBe("cursor-1");
    });

    await act(async () => {
      await result.current.ensureAllLoaded();
    });

    expect(mockListRecentVibes).toHaveBeenCalledWith({ limit: 1 });
    expect(mockListRecentVibes).toHaveBeenCalledWith({ limit: 1, cursor: "cursor-1" });
    expect(mockListRecentVibes).toHaveBeenCalledWith({ limit: 1, cursor: "cursor-2" });
    expect(result.current.items.map((item) => item.appSlug)).toEqual(["first", "second", "third"]);
    expect(result.current.nextCursor).toBeUndefined();
    expect(result.current.isLoadingAll).toBe(false);
  });

  it("exposes loading-all state while exhausting pages", async () => {
    const page2 = deferred<ReturnType<typeof okRecentVibes>>();

    mockListRecentVibes
      .mockImplementation(async ({ cursor }: { cursor?: string }) => {
        if (!cursor) return okRecentVibes([makeItem("first")], "cursor-1");
        if (cursor === "cursor-1") return page2.promise;
        throw new Error(`unexpected cursor: ${cursor}`);
      });

    const { result } = renderHook(() => useRecentVibes(1));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.nextCursor).toBe("cursor-1");
    });

    let loadAllPromise: Promise<void> | undefined;
    act(() => {
      loadAllPromise = result.current.ensureAllLoaded();
    });

    await waitFor(() => {
      expect(result.current.isLoadingAll).toBe(true);
    });

    page2.resolve(okRecentVibes([makeItem("second")], undefined));

    await act(async () => {
      await loadAllPromise;
    });

    expect(result.current.isLoadingAll).toBe(false);
    expect(result.current.items.map((item) => item.appSlug)).toEqual(["first", "second"]);
  });
});
