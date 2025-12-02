import { vi } from "vitest";

// Create a simple mock database that can be returned by fireproof
const mockDb = {
  put: vi.fn().mockResolvedValue({ id: "test-id" }),
  get: vi.fn().mockResolvedValue({ _id: "test-id", title: "Test Document" }),
  query: vi.fn().mockResolvedValue({
    rows: [
      { id: "session1", key: "session1", value: { title: "Test Session" } },
    ],
  }),
  delete: vi.fn().mockResolvedValue({ ok: true }),
  allDocs: vi.fn().mockResolvedValue({
    rows: [
      {
        key: "session1",
        value: {
          _id: "session1",
          title: "Test Session",
          session_id: "session1",
        },
      },
    ],
  }),
  subscribe: vi.fn().mockReturnValue(() => {
    // Unsubscribe function
  }),
};

// Mock session data for queries
const mockSessions = [
  {
    _id: "session1",
    type: "session",
    title: "Test Session 1",
    timestamp: Date.now() - 1000000,
    messages: [
      { text: "Hello", type: "user" },
      { text: "Hi there", type: "ai", code: 'console.log("Hello")' },
    ],
  },
];

// Mock screenshots can be used in useLiveQuery with screenshot query filters
const mockScreenshots = [
  {
    _id: "screenshot1",
    type: "screenshot",
    session_id: "session1",
    timestamp: Date.now(),
  },
];

// Ensure the mock uses the mockScreenshots array
const getQueryResult = (queryType: string) => {
  if (queryType.includes("screenshot")) {
    return { docs: mockScreenshots, status: "success" };
  }
  return { docs: mockSessions, status: "success" };
};

// Mock the fireproof function - this is imported directly in databaseManager.ts
const fireproof = vi.fn().mockImplementation(() => mockDb);

// Mock the useFireproof hook - this is used in components
const useFireproof = vi.fn().mockImplementation(() => ({
  database: mockDb,
  useLiveQuery: vi.fn().mockImplementation((query) => {
    const queryStr = typeof query === "string" ? query : "";
    return getQueryResult(queryStr);
  }),
  useDocument: vi.fn().mockReturnValue({
    doc: mockSessions[0],
    merge: vi.fn(),
    save: vi.fn(),
  }),
  getDB: () => mockDb,
}));

// Default export for CommonJS compatibility
export default {
  fireproof,
  useFireproof,
};

// Named exports for ESM compatibility
export { fireproof, useFireproof };
