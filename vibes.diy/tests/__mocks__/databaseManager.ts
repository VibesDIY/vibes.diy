// Mock implementation of database manager for testing
import { vi } from "vitest";

// Mock database instances with consistent API
const createMockDatabase = () => ({
  put: vi.fn().mockResolvedValue({ id: "mock-id", ok: true }),
  get: vi.fn().mockResolvedValue({ _id: "mock-id", title: "Mock Document" }),
  query: vi.fn().mockResolvedValue({ rows: [] }),
  delete: vi.fn().mockResolvedValue({ ok: true }),
  allDocs: vi.fn().mockResolvedValue({ rows: [] }),
});

// Single mock database instance that's returned for all requests
const mockDb = createMockDatabase();

/**
 * Mock implementation of getSessionsDatabase
 */
export const getSessionsDatabase = vi.fn().mockImplementation(() => mockDb);

/**
 * Mock implementation of getSessionDatabase
 */
export const getSessionDatabase = vi.fn().mockImplementation(() => mockDb);

/**
 * Mock implementation of getSessionDatabaseName
 */
export const getSessionDatabaseName = vi
  .fn()
  .mockImplementation((sessionId: string) => `vibe-${sessionId}`);
