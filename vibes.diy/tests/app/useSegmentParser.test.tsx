import type { AiChatMessage, ChatMessage } from "@vibes.diy/prompts";
import { parseContent } from "@vibes.diy/prompts";
import { describe, expect, it, vi } from "vitest";

// Define shared state using vi.hoisted
const mockState = vi.hoisted(() => {
  const mockDocs: (ChatMessage | AiChatMessage)[] = [];
  const currentUserMessage: Partial<ChatMessage | AiChatMessage> = {};
  const currentAiMessage: Partial<ChatMessage | AiChatMessage> = {};

  const mergeUserMessageImpl = (data: Partial<ChatMessage>) => {
    if (data && typeof data.text === "string") {
      currentUserMessage.text = data.text;
    }
  };

  return {
    mockDocs,
    currentUserMessage,
    currentAiMessage,
    mockMergeUserMessage: vi.fn(mergeUserMessageImpl),
  };
});

// Mock the prompts module - we'll unmock parseContent for these tests
vi.mock("@vibes.diy/prompts", async (importOriginal) => {
  const { vi } = await import("vitest");
  const actual = await importOriginal<typeof import("@vibes.diy/prompts")>();
  return {
    ...actual,
    makeBaseSystemPrompt: vi.fn().mockResolvedValue({
      systemPrompt: "Mocked system prompt",
      dependencies: ["useFireproof"],
      instructionalText: true,
      demoData: false,
      model: "anthropic/claude-sonnet-4.5",
    }),
    // Keep the real parseContent function for these tests
    parseContent: actual.parseContent,
  };
});

// Mock the provisioning module
vi.mock("~/vibes.diy/app/config/provisioning");

// Mock the env module
vi.mock("~/vibes.diy/app/config/env", () => ({
  CALLAI_API_KEY: "mock-callai-api-key-for-testing",
  SETTINGS_DBNAME: "test-chat-history",
}));

// Mock the useSession hook
vi.mock("~/vibes.diy/app/hooks/useSession", async () => {
  const { vi } = await import("vitest");
  const { parseContent } = await import("@vibes.diy/prompts");
  return {
    useSession: () => {
      // Don't reset here, reset is done in beforeEach
      return {
        session: {
          _id: "test-session-id",
          title: "",
          type: "session" as const,
          created_at: Date.now(),
        },
        docs: mockState.mockDocs,
        updateTitle: vi.fn().mockImplementation(async () => Promise.resolve()),
        addScreenshot: vi.fn(),
        sessionDatabase: {
          put: vi.fn(async (doc) => {
            const id = doc._id || `doc-${Date.now()}`;
            return Promise.resolve({ id: id });
          }),
          get: vi.fn(async (id: string) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const found = mockState.mockDocs.find((doc: any) => doc._id === id);
            if (found) return Promise.resolve(found);
            return Promise.reject(new Error("Not found"));
          }),
          query: vi.fn(async (field: string, options?: { key: string }) => {
            const key = options?.key;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const filtered = mockState.mockDocs.filter((doc: any) => {
              return (doc as unknown as Record<string, string>)[field] === key;
            });
            return Promise.resolve({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rows: filtered.map((doc: any) => ({
                id: doc._id,
                doc,
              })),
            });
          }),
        },
        openSessionDatabase: vi.fn(),
        userMessage: mockState.currentUserMessage,
        mergeUserMessage: mockState.mockMergeUserMessage,
        submitUserMessage: vi.fn().mockImplementation(async () => {
          const id = `user-message-${Date.now()}`;
          const newDoc = {
            ...mockState.currentUserMessage,
            _id: id,
          } as ChatMessage | AiChatMessage;
          mockState.mockDocs.push(newDoc);
          return Promise.resolve({ id });
        }),
        aiMessage: mockState.currentAiMessage,
        mergeAiMessage: vi.fn((data) => {
          if (data && typeof data.text === "string") {
            mockState.currentAiMessage.text = data.text;
          }
        }),
        submitAiMessage: vi.fn().mockImplementation(async () => {
          const id = `ai-message-${Date.now()}`;
          const newDoc = {
            ...mockState.currentAiMessage,
            _id: id,
          } as ChatMessage | AiChatMessage;
          mockState.mockDocs.push(newDoc);
          return Promise.resolve({ id });
        }),
        saveAiMessage: vi.fn().mockImplementation(async (existingDoc) => {
          const id = existingDoc?._id || `ai-message-${Date.now()}`;
          const newDoc = {
            ...mockState.currentAiMessage,
            ...existingDoc,
            _id: id,
          };
          mockState.mockDocs.push(newDoc);
          return Promise.resolve({ id });
        }),
        // Mock message handling
        addUserMessage: vi.fn().mockImplementation(async (text) => {
          const created_at = Date.now();
          mockState.mockDocs.push({
            _id: `user-${created_at}`,
            type: "user",
            text,
            session_id: "test-session-id",
            created_at,
          });
          return created_at;
        }),
        addAiMessage: vi
          .fn()
          .mockImplementation(async (rawContent, timestamp) => {
            const created_at = timestamp || Date.now();
            parseContent(rawContent); // Call parseContent but don't use the result

            mockState.mockDocs.push({
              _id: `ai-${created_at}`,
              type: "ai",
              text: rawContent,
              session_id: "test-session-id",
              created_at,
            });
            return created_at;
          }),
        updateAiMessage: vi
          .fn()
          .mockImplementation(
            async (rawContent, isStreaming = false, timestamp) => {
              const now = timestamp || Date.now();

              // Find existing message with this timestamp or create a new index for it
              const existingIndex = mockState.mockDocs.findIndex(
                (msg) => msg.type === "ai" && msg.timestamp === now,
              );

              let aiMessage: AiChatMessage;

              // Special case for the markdown and code segments test
              if (
                rawContent.includes("function HelloWorld()") &&
                rawContent.includes("Hello, World!")
              ) {
                aiMessage = {
                  type: "ai",
                  text: rawContent,
                  session_id: "test-session-id",
                  created_at: now,
                  segments: [
                    {
                      type: "markdown" as const,
                      content: "Here's a simple React component:",
                    },
                    {
                      type: "code" as const,
                      content: `function HelloWorld() {
  return <div>Hello, World!</div>;
}

export default HelloWorld;`,
                    },
                    {
                      type: "markdown" as const,
                      content:
                        "You can use this component in your application.",
                    },
                  ],
                  dependenciesString:
                    '{"react": "^18.2.0", "react-dom": "^18.2.0"}}',
                  isStreaming,
                  timestamp: now,
                };
              }
              // Special case for the dependencies test
              else if (
                rawContent.includes("function Timer()") &&
                rawContent.includes("useEffect")
              ) {
                aiMessage = {
                  type: "ai",
                  text: rawContent,
                  session_id: "test-session-id",
                  created_at: now,
                  segments: [
                    {
                      type: "markdown" as const,
                      content: "Here's a React component that uses useEffect:",
                    },
                    {
                      type: "code" as const,
                      content: `import React, { useEffect } from 'react';

function Timer() {
  useEffect(() => {
    const timer = setInterval(() => {
      console.log('Tick');
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  return <div>Timer Running</div>;
}

export default Timer;`,
                    },
                  ],
                  isStreaming,
                  timestamp: now,
                };
              }
              // Special case for the complex response test
              else if (
                rawContent.includes("ImageGallery") &&
                rawContent.includes("react-router-dom")
              ) {
                aiMessage = {
                  type: "ai",
                  text: rawContent,
                  session_id: "test-session-id",
                  created_at: now,
                  segments: [
                    {
                      type: "markdown" as const,
                      content: "# Image Gallery Component",
                    },
                    {
                      type: "code" as const,
                      content: "function ImageGallery() { /* ... */ }",
                    },
                    {
                      type: "markdown" as const,
                      content: "## Usage Instructions",
                    },
                    {
                      type: "code" as const,
                      content:
                        'import ImageGallery from "./components/ImageGallery";',
                    },
                    {
                      type: "markdown" as const,
                      content:
                        "You can customize the API endpoint and items per page.",
                    },
                  ],
                  isStreaming,
                  timestamp: now,
                };
              }
              // Gallery app
              else if (
                rawContent.includes("photo gallery") ||
                rawContent.includes("Photo Gallery")
              ) {
                aiMessage = {
                  type: "ai",
                  text: rawContent,
                  session_id: "test-session-id",
                  created_at: now,
                  segments: [
                    {
                      type: "markdown" as const,
                      content: "Here's the photo gallery app:",
                    },
                    {
                      type: "code" as const,
                      content:
                        "import React from 'react';\nexport default function App() { /* ... */ }",
                    },
                  ],
                  isStreaming,
                  timestamp: now,
                };
              }
              // Exoplanet Tracker
              else if (
                rawContent.includes("ExoplanetTracker") ||
                rawContent.includes("Exoplanet Tracker")
              ) {
                aiMessage = {
                  type: "ai",
                  text: rawContent,
                  session_id: "test-session-id",
                  created_at: now,
                  segments: [
                    {
                      type: "markdown" as const,
                      content: 'I\'ll create an "Exoplanet Tracker" app',
                    },
                    {
                      type: "code" as const,
                      content:
                        "import React from 'react';\nexport default function ExoplanetTracker() { /* ... */ }",
                    },
                  ],
                  isStreaming,
                  timestamp: now,
                };
              }
              // Lyrics Rater
              else if (
                rawContent.includes("LyricsRaterApp") ||
                rawContent.includes("Lyrics Rater")
              ) {
                aiMessage = {
                  type: "ai",
                  text: rawContent,
                  session_id: "test-session-id",
                  created_at: now,
                  segments: [
                    {
                      type: "markdown" as const,
                      content: "# Lyrics Rater App",
                    },
                    {
                      type: "code" as const,
                      content:
                        "import React from 'react';\nexport default function LyricsRaterApp() { /* ... */ }",
                    },
                  ],
                  isStreaming,
                  timestamp: now,
                };
              }
              // Default case
              else {
                const { segments } = parseContent(rawContent);
                aiMessage = {
                  type: "ai",
                  text: rawContent,
                  session_id: "test-session-id",
                  created_at: now,
                  segments,
                  isStreaming,
                  timestamp: now,
                };
              }

              if (existingIndex >= 0) {
                mockState.mockDocs[existingIndex] = aiMessage;
              } else {
                mockState.mockDocs.push(aiMessage);
              }

              return Promise.resolve(aiMessage);
            },
          ),
      };
    },
  };
});

// Mock the useSessionMessages hook
vi.mock("~/vibes.diy/app/hooks/useSessionMessages", async () => {
  const { vi } = await import("vitest");
  const { parseContent } = await import("@vibes.diy/prompts");
  // Track messages across test runs
  const messagesStore: Record<string, ChatMessage[]> = {};

  return {
    useSessionMessages: () => {
      // Create session if it doesn't exist
      const sessionKey = "test-session-id";
      if (!messagesStore[sessionKey]) {
        messagesStore[sessionKey] = [];
      }

      return {
        messages: messagesStore[sessionKey],
        isLoading: false,
        addUserMessage: vi.fn().mockImplementation(async (text) => {
          const created_at = Date.now();
          messagesStore[sessionKey].push({
            _id: `user-${created_at}`,
            type: "user",
            text,
            session_id: sessionKey,
            created_at,
          });
          return created_at;
        }),
        addAiMessage: vi
          .fn()
          .mockImplementation(async (rawContent, timestamp) => {
            const created_at = timestamp || Date.now();
            parseContent(rawContent); // Call parseContent but don't use the result

            messagesStore[sessionKey].push({
              _id: `ai-${created_at}`,
              type: "ai",
              text: rawContent,
              session_id: sessionKey,
              created_at,
            });
            return created_at;
          }),
        updateAiMessage: vi
          .fn()
          .mockImplementation(
            async (rawContent, isStreaming = false, timestamp) => {
              const now = timestamp || Date.now();

              // Find existing message with this timestamp or create a new index for it
              const existingIndex = messagesStore[sessionKey].findIndex(
                (msg) => msg.type === "ai" && msg.timestamp === now,
              );

              let aiMessage: AiChatMessage;

              // Special case for the markdown and code segments test
              if (
                rawContent.includes("function HelloWorld()") &&
                rawContent.includes("Hello, World!")
              ) {
                aiMessage = {
                  type: "ai",
                  text: rawContent,
                  session_id: "test-session-id",
                  created_at: now,
                  segments: [
                    {
                      type: "markdown" as const,
                      content: "Here's a simple React component:",
                    },
                    {
                      type: "code" as const,
                      content: `function HelloWorld() {
  return <div>Hello, World!</div>;
}

export default HelloWorld;`,
                    },
                    {
                      type: "markdown" as const,
                      content:
                        "You can use this component in your application.",
                    },
                  ],
                  dependenciesString:
                    '{"react": "^18.2.0", "react-dom": "^18.2.0"}}',
                  isStreaming,
                  timestamp: now,
                };
              }
              // Special case for the dependencies test
              else if (
                rawContent.includes("function Timer()") &&
                rawContent.includes("useEffect")
              ) {
                aiMessage = {
                  type: "ai",
                  text: rawContent,
                  session_id: "test-session-id",
                  created_at: now,
                  segments: [
                    {
                      type: "markdown" as const,
                      content: "Here's a React component that uses useEffect:",
                    },
                    {
                      type: "code" as const,
                      content: `import React, { useEffect } from 'react';

function Timer() {
  useEffect(() => {
    const timer = setInterval(() => {
      console.log('Tick');
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  return <div>Timer Running</div>;
}

export default Timer;`,
                    },
                  ],
                  isStreaming,
                  timestamp: now,
                };
              }
              // Special case for the complex response test
              else if (
                rawContent.includes("ImageGallery") &&
                rawContent.includes("react-router-dom")
              ) {
                aiMessage = {
                  type: "ai",
                  text: rawContent,
                  session_id: "test-session-id",
                  created_at: now,
                  segments: [
                    {
                      type: "markdown" as const,
                      content: "# Image Gallery Component",
                    },
                    {
                      type: "code" as const,
                      content: "function ImageGallery() { /* ... */ }",
                    },
                    {
                      type: "markdown" as const,
                      content: "## Usage Instructions",
                    },
                    {
                      type: "code" as const,
                      content:
                        'import ImageGallery from "./components/ImageGallery";',
                    },
                    {
                      type: "markdown" as const,
                      content:
                        "You can customize the API endpoint and items per page.",
                    },
                  ],
                  isStreaming,
                  timestamp: now,
                };
              }
              // Gallery app
              else if (
                rawContent.includes("photo gallery") ||
                rawContent.includes("Photo Gallery")
              ) {
                aiMessage = {
                  type: "ai",
                  text: rawContent,
                  session_id: "test-session-id",
                  created_at: now,
                  segments: [
                    {
                      type: "markdown" as const,
                      content: "Here's the photo gallery app:",
                    },
                    {
                      type: "code" as const,
                      content:
                        "import React from 'react';\nexport default function App() { /* ... */ }",
                    },
                  ],
                  isStreaming,
                  timestamp: now,
                };
              }
              // Exoplanet Tracker
              else if (
                rawContent.includes("ExoplanetTracker") ||
                rawContent.includes("Exoplanet Tracker")
              ) {
                aiMessage = {
                  type: "ai",
                  text: rawContent,
                  session_id: "test-session-id",
                  created_at: now,
                  segments: [
                    {
                      type: "markdown" as const,
                      content: 'I\'ll create an "Exoplanet Tracker" app',
                    },
                    {
                      type: "code" as const,
                      content:
                        "import React from 'react';\nexport default function ExoplanetTracker() { /* ... */ }",
                    },
                  ],
                  isStreaming,
                  timestamp: now,
                };
              }
              // Lyrics Rater
              else if (
                rawContent.includes("LyricsRaterApp") ||
                rawContent.includes("Lyrics Rater")
              ) {
                aiMessage = {
                  type: "ai",
                  text: rawContent,
                  session_id: "test-session-id",
                  created_at: now,
                  segments: [
                    {
                      type: "markdown" as const,
                      content: "# Lyrics Rater App",
                    },
                    {
                      type: "code" as const,
                      content:
                        "import React from 'react';\nexport default function LyricsRaterApp() { /* ... */ }",
                    },
                  ],
                  isStreaming,
                  timestamp: now,
                };
              }
              // Default case
              else {
                const { segments } = parseContent(rawContent);
                aiMessage = {
                  type: "ai",
                  text: rawContent,
                  session_id: "test-session-id",
                  created_at: now,
                  segments,
                  isStreaming,
                  timestamp: now,
                };
              }

              if (existingIndex >= 0) {
                messagesStore[sessionKey][existingIndex] = aiMessage;
              } else {
                messagesStore[sessionKey].push(aiMessage);
              }

              return now;
            },
          ),
        // Expose the messagesStore for testing
        _getMessagesStore: () => messagesStore,
      };
    },
  };
});

describe("segmentParser utilities", () => {
  it("correctly parses markdown content with no code blocks", () => {
    const text = "This is a simple markdown text with no code blocks.";
    const result = parseContent(text);

    expect(result.segments.length).toBe(1);
    expect(result.segments[0].type).toBe("markdown");
    expect(result.segments[0].content).toBe(text);
  });

  it("correctly parses content with code blocks", () => {
    const text = `
Here's a React component:

\`\`\`jsx
function Button() {
  return <button>Click me</button>;
}
\`\`\`

You can use it in your app.
    `.trim();

    const result = parseContent(text);

    expect(result.segments.length).toBe(3);
    expect(result.segments[0].type).toBe("markdown");
    expect(result.segments[0].content).toContain("Here's a React component:");
    expect(result.segments[1].type).toBe("code");
    expect(result.segments[1].content).toContain("function Button()");
    expect(result.segments[2].type).toBe("markdown");
    expect(result.segments[2].content).toContain("You can use it in your app.");
  });

  it("correctly extracts dependencies from content", () => {
    const text = `{"react": "^18.2.0", "react-dom": "^18.2.0"}}

Here's how to use React.
    `.trim();

    const result = parseContent(text);

    expect(result.segments.length).toBe(1);
    expect(result.segments[0].type).toBe("markdown");
    expect(result.segments[0].content.trim()).toBe("Here's how to use React.");
  });
});
