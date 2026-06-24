import { act, renderHook as rtlRenderHook, waitFor } from "@testing-library/react";
import type { NotificationRow } from "@vibes.diy/api-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNotifications } from "~/vibes.diy/app/hooks/useNotifications.js";
import { setTestAuth, setTestUser } from "./clerk-test-mock.js";
import { vibesWrapper } from "./vibes-provider-harness.js";

const mockListNotifications = vi.fn();
const mockMarkNotificationsRead = vi.fn();
const mockVibeDiyApi = {
  listNotifications: mockListNotifications,
  markNotificationsRead: mockMarkNotificationsRead,
};

const renderHook: typeof rtlRenderHook = (cb, options) =>
  rtlRenderHook(cb, { wrapper: vibesWrapper({ chatApi: mockVibeDiyApi }), ...(options as object) });

function okList(items: NotificationRow[], unreadCount: number, nextCursor?: string) {
  return {
    isOk: () => true,
    isErr: () => false,
    Ok: () => ({ items, unreadCount, nextCursor }),
    Err: () => ({ message: "unexpected error" }),
  };
}

function okMark(ok: number) {
  return {
    isOk: () => true,
    isErr: () => false,
    Ok: () => ({ ok }),
    Err: () => ({ message: "unexpected error" }),
  };
}

function makeRow(id: string, overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id,
    userId: "user-1",
    notificationType: "vibe-remixed",
    ownerHandle: "alice",
    appSlug: "cool-app",
    body: `notification ${id}`,
    dedupeKey: `dk-${id}`,
    created: "2026-01-01T00:00:00.000Z",
    readAt: null,
    ...overrides,
  };
}

describe("useNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTestAuth({ isLoaded: true, isSignedIn: true });
    setTestUser({ id: "user-1" });
  });

  it("loads items + unreadCount on mount", async () => {
    mockListNotifications.mockResolvedValue(okList([makeRow("a"), makeRow("b")], 2));

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(result.current.unreadCount).toBe(2);
    expect(mockListNotifications).toHaveBeenCalledWith({});
  });

  it("passes notificationType + appSlug filters through", async () => {
    mockListNotifications.mockResolvedValue(okList([makeRow("a")], 1));

    const { result } = renderHook(() => useNotifications({ notificationType: "vibe-remixed", appSlug: "cool-app" }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockListNotifications).toHaveBeenCalledWith({ notificationType: "vibe-remixed", appSlug: "cool-app" });
  });

  it("appends pages via loadMore using the cursor", async () => {
    mockListNotifications.mockImplementation(async ({ cursor }: { cursor?: string }) => {
      if (!cursor) return okList([makeRow("a")], 1, "cursor-1");
      if (cursor === "cursor-1") return okList([makeRow("b")], 1, undefined);
      throw new Error(`unexpected cursor: ${cursor}`);
    });

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(result.current.nextCursor).toBe("cursor-1"));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockListNotifications).toHaveBeenCalledWith({ cursor: "cursor-1" });
    expect(result.current.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(result.current.nextCursor).toBeUndefined();
  });

  it("markRead(ids) calls markNotificationsRead then refreshes", async () => {
    mockListNotifications
      .mockResolvedValueOnce(okList([makeRow("a")], 1))
      .mockResolvedValueOnce(okList([makeRow("a", { readAt: "2026-01-02T00:00:00.000Z" })], 0));
    mockMarkNotificationsRead.mockResolvedValue(okMark(1));

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.unreadCount).toBe(1));

    await act(async () => {
      await result.current.markRead(["a"]);
    });

    expect(mockMarkNotificationsRead).toHaveBeenCalledWith({ ids: ["a"] });
    expect(result.current.unreadCount).toBe(0);
  });

  it("markRead() with no ids marks all", async () => {
    mockListNotifications.mockResolvedValue(okList([makeRow("a")], 1));
    mockMarkNotificationsRead.mockResolvedValue(okMark(1));

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.markRead();
    });

    expect(mockMarkNotificationsRead).toHaveBeenCalledWith({});
  });

  it("surfaces list errors", async () => {
    mockListNotifications.mockResolvedValue({
      isOk: () => false,
      isErr: () => true,
      Ok: () => ({ items: [], unreadCount: 0 }),
      Err: () => ({ message: "boom" }),
    });

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.error).toBe("boom"));
  });

  it("clears state when signed out", async () => {
    setTestAuth({ isLoaded: true, isSignedIn: false });
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(mockListNotifications).not.toHaveBeenCalled();
  });
});
