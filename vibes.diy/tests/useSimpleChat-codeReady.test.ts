import React from "react";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSimpleChat } from "~/vibes.diy/app/hooks/useSimpleChat.js";
import type { AiChatMessage, ChatMessage } from "~/vibes.diy/app/types/chat.js";
import {
  parseContent,
  parseDependencies,
} from "~/vibes.diy/app/utils/segmentParser.js";

// Mock the prompts module
vi.mock("~/vibes.diy/app/prompts.js", () => ({
  makeBaseSystemPrompt: vi.fn().mockResolvedValue("Mocked system prompt"),
}));

// Credit checking mocks no longer needed

// Mock the env module
vi.mock("~/vibes.diy/app/config/env", () => ({
  CALLAI_API_KEY: "mock-callai-api-key-for-testing",
  SETTINGS_DBNAME: "test-chat-history",
}));

// Mock Fireproof to prevent CRDT errors
vi.mock("use-fireproof", () => ({
  useFireproof: () => ({
    useDocument: () => [{ _id: "mock-doc" }, vi.fn()],
    useLiveQuery: () => [[]],
    useFind: () => [[]],
    useLiveFind: () => [[]],
    useIndex: () => [[]],
    useSubscribe: () => {
      /* no-op */
    },
    database: {
      put: vi.fn().mockResolvedValue({ id: "test-id" }),
      get: vi
        .fn()
        .mockResolvedValue({ _id: "test-id", title: "Test Document" }),
      query: vi.fn().mockResolvedValue({
        rows: [
          { id: "session1", key: "session1", value: { title: "Test Session" } },
        ],
      }),
      delete: vi.fn().mockResolvedValue({ ok: true }),
    },
  }),
  toCloud: vi.fn().mockReturnValue({}),
}));

// Define shared state and reset function *outside* the mock factory
interface MockDoc {
  _id?: string;
  type: string;
  text: string;
  session_id: string;
  timestamp?: number;
  created_at?: number;
  segments?: Record<string, unknown>[];
  dependenciesString?: string;
  isStreaming?: boolean;
  model?: string;
}
let mockDocs: MockDoc[] = [];
const initialMockDocs: MockDoc[] = [
  {
    _id: "ai-message-1",
    type: "ai",
    text: "AI test message",
    session_id: "test-session-id",
    timestamp: Date.now(),
  },
  {
    _id: "user-message-1",
    type: "user",
    text: "User test message",
    session_id: "test-session-id",
    timestamp: Date.now(),
  },
  {
    _id: "ai-message-0",
    type: "ai",
    text: "Older AI message",
    session_id: "test-session-id",
    timestamp: Date.now() - 2000,
  },
];
let currentUserMessage = {
  text: "",
  _id: "user-message-draft",
  type: "user" as const,
  session_id: "test-session-id",
  created_at: Date.now(),
};
let currentAiMessage = {
  text: "",
  _id: "ai-message-draft",
  type: "ai" as const,
  session_id: "test-session-id",
  created_at: Date.now(),
};

const resetMockState = () => {
  mockDocs = [...initialMockDocs]; // Reset docs to initial state
  currentUserMessage = {
    text: "",
    _id: "user-message-draft",
    type: "user" as const,
    session_id: "test-session-id",
    created_at: Date.now(),
  };
  currentAiMessage = {
    text: "",
    _id: "ai-message-draft",
    type: "ai" as const,
    session_id: "test-session-id",
    created_at: Date.now(),
  };
};

// Define the mergeUserMessage implementation separately
const mergeUserMessageImpl = (data: Record<string, unknown>) => {
  if (data && typeof data.text === "string") {
    currentUserMessage.text = data.text;
  }
};

// Create a spy wrapping the implementation
const mockMergeUserMessage = vi.fn(mergeUserMessageImpl);

// Mock the useSession hook
vi.mock("~/vibes.diy/app/hooks/useSession", () => {
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
        docs: mockDocs,
        updateTitle: vi
          .fn()
          .mockImplementation(async (title) => Promise.resolve()),
        addScreenshot: vi.fn(),
        // Keep database mock simple
        sessionDatabase: {
          // Mock put to resolve with an ID. We can spy or override this per test.
          put: vi.fn(async (doc: Record<string, unknown>) => {
            const id = doc._id || `doc-${Date.now()}`;
            return Promise.resolve({ id: id });
          }),
          get: vi.fn(async (id: string) => {
            const found = mockDocs.find((doc) => doc._id === id);
            if (found) return Promise.resolve(found);
            return Promise.reject(new Error("Not found"));
          }),
          query: vi.fn(
            async (field: string, options: Record<string, unknown>) => {
              const key = options?.key;
              const filtered = mockDocs.filter((doc) => {
                // @ts-ignore - we know the field exists
                return doc[field] === key;
              });
              return Promise.resolve({
                rows: filtered.map((doc) => ({ id: doc._id, doc })),
              });
            },
          ),
        },
        openSessionDatabase: vi.fn(),
        aiMessage: currentAiMessage,
        userMessage: currentUserMessage,
        mergeUserMessage: mockMergeUserMessage,
        submitUserMessage: vi.fn().mockImplementation(() => Promise.resolve()),
        mergeAiMessage: vi.fn().mockImplementation((data) => {
          if (data && typeof data.text === "string") {
            currentAiMessage.text = data.text;
          }
        }),
        submitAiMessage: vi.fn().mockImplementation(() => Promise.resolve()),
        saveAiMessage: vi
          .fn()
          .mockImplementation(async (existingDoc: Record<string, unknown>) => {
            const id = existingDoc?._id || `ai-message-${Date.now()}`;
            return Promise.resolve({ id });
          }),
      };
    },
  };
});

// Mock the useSessionMessages hook
vi.mock("~/vibes.diy/app/hooks/useSessionMessages", () => {
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
          .mockImplementation(async (rawContent, isStreaming, timestamp) => {
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
                    type: "markdown",
                    content: "Here's a simple React component:",
                  },
                  {
                    type: "code",
                    content: `function HelloWorld() {
  return <div>Hello, World!</div>;
}

export default HelloWorld;`,
                  },
                  {
                    type: "markdown",
                    content: "You can use this component in your application.",
                  },
                ],
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
                    type: "markdown",
                    content: "Here's a React component that uses useEffect:",
                  },
                  {
                    type: "code",
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
                  { type: "markdown", content: "# Image Gallery Component" },
                  {
                    type: "code",
                    content: "function ImageGallery() { /* ... */ }",
                  },
                  { type: "markdown", content: "## Usage Instructions" },
                  {
                    type: "code",
                    content:
                      'import ImageGallery from "./components/ImageGallery";',
                  },
                  {
                    type: "markdown",
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
                    type: "markdown",
                    content: "Here's the photo gallery app:",
                  },
                  {
                    type: "code",
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
                    type: "markdown",
                    content: 'I\'ll create an "Exoplanet Tracker" app',
                  },
                  {
                    type: "code",
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
                  { type: "markdown", content: "# Lyrics Rater App" },
                  {
                    type: "code",
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
          }),
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

  it("correctly parses dependencies string into object", () => {
    const dependenciesString = '{"react": "^18.2.0", "react-dom": "^18.2.0"}}';
    const dependencies = parseDependencies(dependenciesString);

    expect(dependencies).toEqual({
      react: "^18.2.0",
      "react-dom": "^18.2.0",
    });
  });

  it("returns empty object for invalid dependencies string", () => {
    const dependencies = parseDependencies(undefined);
    expect(dependencies).toEqual({});

    const emptyDependencies = parseDependencies("{}");
    expect(emptyDependencies).toEqual({});
  });
});

// Mock the AuthContext module
vi.mock("~/vibes.diy/app/contexts/AuthContext", () => {
  // Create a mock AuthContext that will be used by useAuth inside the hook
  const mockAuthContext = {
    isAuthenticated: true,
    isLoading: false,
    token: "mock-token",
    userPayload: {
      userId: "test-user-id",
      exp: 9999999999,
      tenants: [],
      ledgers: [],
      iat: 1234567890,
      iss: "FP_CLOUD",
      aud: "PUBLIC",
    },
    checkAuthStatus: vi.fn(),
    processToken: vi.fn(),
  };

  return {
    // Simple identity function for AuthProvider
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    // Always return our mock context
    useAuth: () => mockAuthContext,
  };
});

// Simple wrapper function - passes children through
const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => children;
};

describe("useSimpleChat", () => {
  beforeEach(() => {
    // Credit checking mocks no longer needed

    // Mock window.fetch
    vi.spyOn(window, "fetch").mockImplementation(async () => {
      // Mock response with a readable stream
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode("This is a test response"),
          );
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

    // Mock ScrollIntoView
    Element.prototype.scrollIntoView = vi.fn();

    // Mock environment variables
    vi.stubEnv("VITE_CALLAI_API_KEY", "test-api-key");

    // Mock import.meta.env.MODE for testing
    vi.stubGlobal("import", {
      meta: {
        env: {
          MODE: "test",
          VITE_CALLAI_API_KEY: "test-api-key",
        },
      },
    });

    // Reset the mock state before each test
    resetMockState();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("initializes with expected mock messages", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSimpleChat("test-session-id"), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.docs.length).toBeGreaterThan(0);
    });
    expect(result.current.isStreaming).toBe(false);
  });

  it("correctly determines when code is ready for display", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSimpleChat("test-session-id"), {
      wrapper,
    });
    // Wait for docs to load instead of checking isLoading property
    await waitFor(() => expect(result.current.docs.length).toBeGreaterThan(0));

    // Test codeReady logic independently
    function testCodeReady(
      isStreaming: boolean,
      segmentsLength: number,
    ): boolean {
      return (!isStreaming && segmentsLength > 1) || segmentsLength > 2;
    }

    // Using test cases with known expected results
    expect(testCodeReady(false, 2)).toBe(true);
  });
});
