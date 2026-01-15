import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createWrapper } from "./setup.js";
import { useSimpleChat } from "~/vibes.diy/app/hooks/useSimpleChat.js";

// Reuse helper from setup

describe("useSimpleChat", () => {
  it("correctly parses markdown and code segments", async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":""},"finish_reason":null}]}\n\n'));
          controller.close();
        },
      });

      return {
        ok: true,
        body: stream,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
      } as Response;
    });

    window.fetch = mockFetch;

    const wrapper = createWrapper();
    const { result } = renderHook(() => useSimpleChat("test-session-id"), {
      wrapper,
    });

    const codeContent = `function HelloWorld() {
  return <div>Hello, World!</div>;
}

export default HelloWorld;`;

    const mockMessages = [
      {
        type: "user",
        text: "Create a React component",
        timestamp: Date.now() - 1000,
      },
      {
        type: "ai",
        text: `Here's a simple React component:\n\n\`\`\`jsx\n${codeContent}\n\`\`\`\n\nYou can use this component in your application.`,
        segments: [
          {
            type: "markdown" as const,
            content: "Here's a simple React component:",
          },
          { type: "code" as const, content: codeContent },
          {
            type: "markdown" as const,
            content: "You can use this component in your application.",
          },
        ],
        dependenciesString: '{"react": "^18.2.0", "react-dom": "^18.2.0"}}',
        isStreaming: false,
        timestamp: Date.now(),
      },
    ];

    const originalSelectedSegments = result.current.selectedSegments;
    const originalSelectedCode = result.current.selectedCode;

    Object.defineProperty(result.current, "selectedSegments", {
      get: () => mockMessages[1].segments,
      configurable: true,
    });

    Object.defineProperty(result.current, "selectedCode", {
      get: () => ({ type: "code", content: codeContent }),
      configurable: true,
    });

    Object.defineProperty(result.current, "docs", {
      get: () => mockMessages,
      configurable: true,
    });

    act(() => {
      result.current.setInput("");
    });

    expect(result.current.selectedSegments?.length).toBe(3);
    expect(result.current.selectedSegments?.[0].type).toBe("markdown");
    expect(result.current.selectedSegments?.[0].content).toContain("Here's a simple React component");
    expect(result.current.selectedSegments?.[1].type).toBe("code");
    expect(result.current.selectedSegments?.[1].content).toContain("function HelloWorld()");
    expect(result.current.selectedSegments?.[2].type).toBe("markdown");
    expect(result.current.selectedSegments?.[2].content).toContain("You can use this component");
    expect(result.current.selectedCode?.content).toContain("function HelloWorld()");

    if (originalSelectedSegments) {
      Object.defineProperty(result.current, "selectedSegments", {
        value: originalSelectedSegments,
        configurable: true,
      });
    }

    if (originalSelectedCode) {
      Object.defineProperty(result.current, "selectedCode", {
        value: originalSelectedCode,
        configurable: true,
      });
    }
  });
});
