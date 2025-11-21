import React from "react";
import { cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, vi } from "vitest";
import { VibesDiyEnv } from "~/vibes.diy/app/config/env.js";

// IMPORTANT: Mock call-ai BEFORE any modules that might import it
let callCount = 0;
vi.mock("call-ai", async () => {
  const al = await vi.importActual("call-ai");
  return {
    ...al,
    callAI: vi.fn(async () => {
      // Return a different value on subsequent calls to simulate state change
      callCount += 1;
      return callCount === 1 ? "Mock Title" : "Updated Mock Title";
    }),
  };
});

// Mock Clerk to avoid requiring ClerkProvider during tests
vi.mock("@clerk/clerk-react", () => {
  return {
    useAuth: () => ({
      isSignedIn: true,
      isLoaded: true,
      userId: "test-user-id",
      getToken: vi.fn().mockResolvedValue("mock-clerk-token"),
    }),
    useUser: () => ({
      user: { id: "test-user-id" },
      isLoaded: true,
      isSignedIn: true,
    }),
    useSignIn: () => ({
      signIn: { authenticateWithRedirect: vi.fn() },
    }),
  };
});
import type {
  AiChatMessage,
  ChatMessage,
  UserChatMessage,
} from "@vibes.diy/prompts";
import type { DocResponse } from "use-fireproof";
import { parseContent } from "@vibes.diy/prompts";

// Helper function to convert chunks into SSE format
function formatAsSSE(chunks: string[]): string[] {
  return chunks.map((chunk) => {
    return `data: ${JSON.stringify({
      id: `gen-${Date.now()}`,
      provider: "Anthropic",
      model: "anthropic/claude-3.7-sonnet",
      object: "chat.completion.chunk",
      created: Date.now(),
      choices: [
        {
          index: 0,
          delta: {
            role: "assistant",
            content: chunk,
          },
          finish_reason: null,
          native_finish_reason: null,
          logprobs: null,
        },
      ],
    })}\n\n`;
  });
}

// Mock the prompts module
vi.mock("@vibes.diy/prompts", async (improve) => {
  const all = (await improve()) as typeof import("@vibes.diy/prompts");
  return {
    ...all,
    makeBaseSystemPrompt: vi.fn().mockResolvedValue("Mocked system prompt"),
  };
});

// Credit checking mocks no longer needed

// Mock the utils/streamHandler to avoid real streaming and loops
vi.mock("~/vibes.diy/app/utils/streamHandler", () => ({
  streamAI: vi.fn(
    async (
      _model: string,
      _sys: string,
      _hist: unknown[],
      _user: string,
      onContent: (c: string) => void,
    ) => {
      // simulate streaming updates
      onContent("Mock stream part 1");
      onContent("Mock stream part 2");
      return "Mock stream part 1Mock stream part 2";
    },
  ),
}));

// Mock the env module

VibesDiyEnv.env().sets({
  CALLAI_API_KEY: "mock-callai-api-key-for-testing",
  CALLAI_ENDPOINT: "https://mock-callai-endpoint.com",
  SETTINGS_DBNAME: "test-chat-history",
  GA_TRACKING_ID: "mock-ga-tracking-id",
  APP_MODE: "test", // Added mock APP_MODE
  // callAiEnv.set("CALLAI_API_KEY", "test-api-key");
});

// Mock Fireproof to prevent CRDT errors
vi.mock("use-fireproof", async (original) => {
  const all = (await original()) as typeof import("use-fireproof");
  return {
    ...all,
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
            {
              id: "session1",
              key: "session1",
              value: { title: "Test Session" },
            },
          ],
        }),
        delete: vi.fn().mockResolvedValue({ ok: true }),
      },
    }),
  };
});

// Define shared state and reset function *outside* the mock factory
// interface MockDoc {
//   _id?: string;
//   type: string;
//   text: string;
//   session_id: string;
//   timestamp?: number;
//   created_at?: number;
//   segments?: unknown[];
//   dependenciesString?: string;
//   isStreaming?: boolean;
//   model?: string;
//   dataUrl?: string; // For screenshot docs
// }

type MockDoc = AiChatMessage | UserChatMessage;

let mockDocs: MockDoc[] = [];
const initialMockDocs: MockDoc[] = [
  {
    _id: "ai-message-1",
    type: "ai",
    text: "AI test message",
    session_id: "test-session-id",
    timestamp: Date.now(),
    created_at: Date.now(),
  },
  {
    _id: "user-message-1",
    type: "user",
    text: "User test message",
    session_id: "test-session-id",
    timestamp: Date.now(),
    created_at: Date.now(),
  },
  {
    _id: "ai-message-0",
    type: "ai",
    text: 'Older AI message with code:\n\n```javascript\nfunction example() {\n  return "This is a code example";\n}\n```\n\nThe above function returns a string.',
    session_id: "test-session-id",
    timestamp: Date.now() - 2000,
    created_at: Date.now(),
  },
];
let currentUserMessage: MockDoc;
let currentAiMessage: MockDoc;

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
const mergeUserMessageImpl = (data?: { text: string }) => {
  if (data && typeof data.text === "string") {
    currentUserMessage.text = data.text;
  }
};

// Create a spy wrapping the implementation
const mockMergeUserMessage = vi.fn(mergeUserMessageImpl);

// A single shared sessionDatabase instance used by the mocked useSession hook.
// Tests can override these methods at runtime to affect the hook under test.
type AnyChatMessage = AiChatMessage | UserChatMessage;
interface SessionDatabase {
  put: (
    doc: Partial<AnyChatMessage> & { _id?: string },
  ) => Promise<DocResponse>;
  get: (id: string) => Promise<AnyChatMessage>;
  query: (
    field: string,
    options: { key: string },
  ) => Promise<{ rows: { id: string; doc: AnyChatMessage }[] }>;
  delete: (id: string) => Promise<{ ok: boolean }>;
}

function makeDefaultSessionDatabase(): SessionDatabase {
  return {
    put: vi.fn(async (doc: Partial<AnyChatMessage> & { _id?: string }) => {
      const id = doc._id || `doc-${Date.now()}`;
      return Promise.resolve({ id } as DocResponse);
    }),
    get: vi.fn(async (id: string) => {
      const found = mockDocs.find((d) => d._id === id);
      if (found) return Promise.resolve(found);
      return Promise.reject(new Error("Not found"));
    }),
    query: vi.fn(async (field: string, options: { key: string }) => {
      const key = options?.key;
      const filtered = mockDocs.filter((doc) => {
        // Type-safe field access for known chat message fields
        if (field === "session_id") return doc.session_id === key;
        if (field === "type") return doc.type === key;
        if (field === "_id") return doc._id === key;
        return false; // Unknown field, no match
      });
      return Promise.resolve({
        rows: filtered.map((doc) => ({ id: doc._id as string, doc })),
      });
    }),
    delete: vi.fn(async (id: string) => {
      const idx = mockDocs.findIndex((d) => d._id === id);
      if (idx >= 0) mockDocs.splice(idx, 1);
      return Promise.resolve({ ok: true });
    }),
  };
}

const sharedSessionDatabase: SessionDatabase = makeDefaultSessionDatabase();

export { sharedSessionDatabase };

function resetSharedSessionDatabase() {
  const defaults = makeDefaultSessionDatabase();
  sharedSessionDatabase.put = defaults.put;
  sharedSessionDatabase.get = defaults.get;
  sharedSessionDatabase.query = defaults.query;
  sharedSessionDatabase.delete = defaults.delete;
}

// Mock the useSession hook
vi.mock("~/vibes.diy/app/hooks/useSession", async (original) => {
  const all =
    (await original()) as typeof import("~/vibes.diy/app/hooks/useSession.js");
  return {
    ...all,
    // updateAiSelectedDependencies: vi.fn(),
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
          .mockImplementation(async (_title) => Promise.resolve()),
        addScreenshot: vi.fn(),
        sessionDatabase: sharedSessionDatabase,
        openSessionDatabase: vi.fn(),
        userMessage: currentUserMessage,
        mergeUserMessage: mockMergeUserMessage,
        submitUserMessage: vi.fn().mockImplementation(async () => {
          const id = `user-message-${Date.now()}`;
          const newDoc = {
            ...currentUserMessage,
            _id: id,
          };
          mockDocs.push(newDoc);
          return Promise.resolve({ id });
        }),
        aiMessage: currentAiMessage,
        mergeAiMessage: vi.fn((data) => {
          if (data && typeof data.text === "string") {
            currentAiMessage.text = data.text;
          }
        }),
        submitAiMessage: vi.fn().mockImplementation(async () => {
          const id = `ai-message-${Date.now()}`;
          const newDoc = {
            ...currentAiMessage,
            _id: id,
          };
          mockDocs.push(newDoc);
          return Promise.resolve({ id });
        }),
        saveAiMessage: vi.fn().mockImplementation(async (existingDoc) => {
          const id = existingDoc?._id || `ai-message-${Date.now()}`;
          const newDoc = {
            ...currentAiMessage,
            ...existingDoc,
            _id: id,
          };
          mockDocs.push(newDoc);
          return Promise.resolve({ id });
        }),
        effectiveModel: ["anthropic/claude-sonnet-4.5"],
        updateSelectedModel: vi.fn().mockResolvedValue(undefined),
        // Mock message handling
        addUserMessage: vi.fn().mockImplementation(async (text) => {
          const created_at = Date.now();
          mockDocs.push({
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

            mockDocs.push({
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
              const existingIndex = mockDocs.findIndex(
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
                mockDocs[existingIndex] = aiMessage;
              } else {
                mockDocs.push(aiMessage);
              }

              return Promise.resolve(aiMessage);
            },
          ),
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

// Wrapper definition
const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => <>{children}</>;
};

beforeEach(() => {
  // Credit checking mocks no longer needed

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
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
        text: () => Promise.resolve("This is a test response"),
        headers: new Headers(),
      } as Response;
    }),
  );

  Element.prototype.scrollIntoView = vi.fn();

  // VibesDiyEnv.set("CALLAI_API_KEY", "test-api-key");
  // vi.stubEnv("VITE_CALLAI_API_KEY", "test-api-key");

  resetMockState();
  resetSharedSessionDatabase();

  vi.spyOn(Storage.prototype, "getItem");
  localStorage.getItem = vi.fn(() => null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  localStorage.clear();
});

export { formatAsSSE, createWrapper, mockMergeUserMessage };
