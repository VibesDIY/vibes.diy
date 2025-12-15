import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createWrapper, sharedSessionDatabase } from "./setup.js";
import { useSimpleChat } from "~/vibes.diy/app/hooks/useSimpleChat.js";
import { useSession } from "~/vibes.diy/app/hooks/useSession.js";
import { DocResponse } from "@fireproof/use-fireproof";

describe("useSimpleChat", () => {
  it("prioritizes selectedResponseDoc correctly", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSimpleChat("test-session-id"), {
      wrapper,
    });
    const olderDocId = "ai-message-0";
    const pendingId = "pending-ai-id";
    const streamingText = "Streaming message text";

    expect(result.current.selectedResponseDoc?._id).toBe(olderDocId);

    await act(async () => {
      result.current.setSelectedResponseId("ai-message-0");
    });
    expect(result.current.selectedResponseDoc?._id).toBe("ai-message-0");

    await act(async () => {
      result.current.setSelectedResponseId("");
    });
    const mockPendingPut = vi.fn<
      ReturnType<typeof useSession>["sessionDatabase"]["put"]
    >(async () => {
      return Promise.resolve({ id: pendingId } as DocResponse);
    });
    sharedSessionDatabase.put = mockPendingPut;

    act(() => {
      result.current.setInput("trigger pending");
    });
    await act(async () => {
      await result.current.sendMessage();
    });

    const originalPut = vi.fn<
      ReturnType<typeof useSession>["sessionDatabase"]["put"]
    >(async (doc) => {
      const id = doc._id || `ai-message-${Date.now()}`;
      return Promise.resolve({ id } as DocResponse);
    });
    sharedSessionDatabase.put = originalPut;

    await act(async () => {
      result.current.setSelectedResponseId("");
      result.current.setInput("trigger streaming");
      Object.defineProperty(result.current, "aiMessage", {
        get: () => ({
          _id: "",
          type: "ai",
          text: streamingText,
          session_id: "test-session-id",
          timestamp: Date.now(),
        }),
        configurable: true,
      });
    });

    await waitFor(() => {
      /* no-op */
    });

    await act(async () => {
      Object.defineProperty(result.current, "aiMessage", {
        get: () => ({
          _id: "",
          type: "ai",
          text: "",
          session_id: "test-session-id",
          timestamp: Date.now(),
        }),
        configurable: true,
      });
    });

    await waitFor(() => {
      /* no-op */
    });

    await act(async () => {
      result.current.setSelectedResponseId(olderDocId);
    });
    expect(result.current.selectedResponseDoc?._id).toBe(olderDocId);
  });
});
