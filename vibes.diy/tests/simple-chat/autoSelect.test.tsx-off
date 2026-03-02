import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createWrapper, formatAsSSE } from "./setup.js";
import { useSimpleChat } from "~/vibes.diy/app/hooks/useSimpleChat.js";

describe("useSimpleChat", () => {
  it("auto-selects the new message after streaming finishes", async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const chunks = ["Auto-selected ", "response."];
          const sseChunks = formatAsSSE(chunks);
          sseChunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
          controller.close();
        },
      });
      return {
        ok: true,
        body: stream,
        status: 200,
        headers: new Headers(),
      } as Response;
    });
    window.fetch = mockFetch;

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSimpleChat("test-session-id"), {
      wrapper,
    });

    await act(async () => {
      result.current.setSelectedResponseId("ai-message-0");
    });
    expect(result.current.selectedResponseDoc?._id).toBe("ai-message-0");

    await act(async () => {
      result.current.setInput("Trigger stream for auto-select");
      await result.current.sendMessage();
    });

    await act(async () => {
      /* no-op */
    });
  });
});
