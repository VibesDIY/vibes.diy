import type { AiChatMessage, ChatMessage } from "@vibes.diy/prompts";
import { parseContent } from "@vibes.diy/prompts";
import { vi } from "vitest";

// Mock the prompts module - use partial mocking to keep real parseContent
vi.mock("@vibes.diy/prompts", async (importOriginal) => {
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
    resolveEffectiveModel: vi
      .fn()
      .mockResolvedValue("anthropic/claude-sonnet-4.5"),
    // Keep the real parseContent function for these tests
    parseContent: actual.parseContent,
  };
});

// Credit checking mocks no longer needed

// Mock the env module
vi.mock("~/vibes.diy/app/config/env", () => ({
  VibesDiyEnv: {
    CALLAI_ENDPOINT: () => "mock-callai-api-key-for-testing",
    SETTINGS_DBNAME: () => "test-chat-history",
  },
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        updateTitle: vi.fn().mockImplementation(async () => Promise.resolve()),
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
                return (
                  (doc as unknown as Record<string, unknown>)[field] === key
                );
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
        effectiveModel: ["anthropic/claude-sonnet-4.5"],
        updateSelectedModel: vi.fn().mockResolvedValue(undefined),
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
                    content: `function HelloWorld() {\n  return <div>Hello, World!</div>;\n}\n\nexport default HelloWorld;`,
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
                    content: `import React, { useEffect } from 'react';\n\nfunction Timer() {\n  useEffect(() => {\n    const timer = setInterval(() => {\n      console.log('Tick');\n    }, 1000);
    
    return () => clearInterval(timer);
  }, []);\n  
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

// Mock @clerk/clerk-react
vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    userId: "test-user-id",
    isLoaded: true,
    isSignedIn: true,
  }),
}));
