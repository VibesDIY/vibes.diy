import { act, renderHook } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import { createWrapper } from "./setup.js";
import { useSimpleChat } from "~/vibes.diy/app/hooks/useSimpleChat.js";

describe("useSimpleChat", () => {
  it("extracts dependencies from response", async () => {
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

    const mockMessages = [
      {
        type: "user",
        text: "Create a timer component",
        timestamp: Date.now() - 1000,
      },
      {
        type: "ai",
        text: `{"react": "^18.2.0", "react-dom": "^18.2.0"}}\n\nHere's a React component that uses useEffect:\n\n\`\`\`jsx\nimport React, { useEffect } from 'react';\n\nfunction Timer() {\n  useEffect(() => {\n    const timer = setInterval(() => {\n      console.log('Tick');\n    }, 1000);\n\n    return () => clearInterval(timer);\n  }, []);\n\n  return <div>Timer Running</div>;\n}\n\nexport default Timer;\n\`\`\``,
        segments: [
          {
            type: "markdown" as const,
            content: "Here's a React component that uses useEffect:",
          },
          {
            type: "code" as const,
            content: `import React, { useEffect } from 'react';\n\nfunction Timer() {\n  useEffect(() => {\n    const timer = setInterval(() => {\n      console.log('Tick');\n    }, 1000);\n\n    return () => clearInterval(timer);\n  }, []);\n\n  return <div>Timer Running</div>;\n}\n\nexport default Timer;`,
          },
        ],
        dependenciesString: '{"react": "^18.2.0", "react-dom": "^18.2.0"}}',
        isStreaming: false,
        timestamp: Date.now(),
      },
    ];

    Object.defineProperty(result.current, "docs", {
      get: () => mockMessages,
      configurable: true,
    });

    Object.defineProperty(result.current, "selectedResponseDoc", {
      get: () => mockMessages[1],
      configurable: true,
    });

    act(() => {
      result.current.setInput("");
    });
  });
});
