import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCatalog } from "../pkg/app/hooks/useCatalog.js";
import type { LocalVibe } from "../pkg/app/utils/vibeUtils.js";
import { useFireproof } from "use-fireproof";

// Mock use-fireproof using the simple pattern from working tests
const mockDatabase = {
  name: "vibez-catalog-test",
  allDocs: vi.fn().mockResolvedValue({ rows: [] }),
  get: vi.fn().mockResolvedValue({ _id: "test-doc" }),
  put: vi.fn().mockResolvedValue({ ok: true }),
  bulk: vi.fn().mockResolvedValue({ ok: true }),
};

const mockSessionDb = {
  get: vi
    .fn()
    .mockResolvedValue({ title: "Test Vibe", created_at: Date.now() }),
  query: vi.fn().mockResolvedValue({ rows: [] }),
};

const mockUseAllDocs = vi.fn(() => ({ docs: [] as any[], rows: [] as any[] }));

vi.mock("use-fireproof", () => ({
  useFireproof: vi.fn(() => ({
    database: mockDatabase,
    useAllDocs: mockUseAllDocs,
  })),
  fireproof: vi.fn(() => mockSessionDb),
  toCloud: vi.fn().mockReturnValue({}),
}));

describe("useCatalog", () => {
  const mockVibes: LocalVibe[] = [
    {
      id: "vibe1",
      title: "Test Vibe 1",
      encodedTitle: "test-vibe-1",
      slug: "vibe1",
      created: "2024-01-01T00:00:00.000Z",
      favorite: false,
    },
    {
      id: "vibe2",
      title: "Test Vibe 2",
      encodedTitle: "test-vibe-2",
      slug: "vibe2",
      created: "2024-01-02T00:00:00.000Z",
      favorite: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to default empty state
    mockUseAllDocs.mockReturnValue({ docs: [], rows: [] });
  });

  it("should return correct interface", () => {
    const { result } = renderHook(() => useCatalog("user123", []));

    // Verify the hook returns the expected interface
    expect(result.current).toHaveProperty("count");
    expect(result.current).toHaveProperty("catalogVibes");
    expect(result.current).toHaveProperty("addCatalogScreenshot");

    expect(typeof result.current.count).toBe("number");
    expect(Array.isArray(result.current.catalogVibes)).toBe(true);
    expect(typeof result.current.addCatalogScreenshot).toBe("function");
  });

  it("should handle empty vibes array", () => {
    const { result } = renderHook(() => useCatalog("user123", []));

    expect(result.current.count).toBe(0);
    expect(result.current.catalogVibes).toEqual([]);
  });

  it("should use local as default userId when empty", () => {
    renderHook(() => useCatalog("", mockVibes));

    expect(useFireproof).toHaveBeenCalledWith(
      expect.stringMatching(/-local$/),
      expect.any(Object),
    );
  });

  it("should create correct database name with userId", () => {
    renderHook(() => useCatalog("user123", mockVibes));

    expect(useFireproof).toHaveBeenCalledWith(
      expect.stringMatching(/-user123$/),
      expect.any(Object),
    );
  });

  it("should transform catalog docs to LocalVibe format", () => {
    // Mock catalog documents with vibeIds longer than 10 characters
    const mockCatalogDocs = [
      {
        _id: "catalog-vibe1234567890",
        vibeId: "vibe1234567890",
        title: "Catalog Vibe 1",
        created: Date.now() - 1000,
        url: "https://example.com/vibe1",
      },
      {
        _id: "catalog-vibe0987654321",
        vibeId: "vibe0987654321",
        title: "Catalog Vibe 2",
        created: Date.now() - 2000,
        url: "https://example.com/vibe2",
        screenshot: {
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAGAzGNrpgAAAABJRU5ErkJggg==",
          size: 95,
          type: "image/png",
        },
      },
    ];

    // Set up the mock to return our test data for both useAllDocs calls
    mockUseAllDocs.mockReturnValue({
      docs: mockCatalogDocs,
      rows: mockCatalogDocs.map((doc) => ({ id: doc._id, key: doc._id })),
    });

    const { result } = renderHook(() => useCatalog("user123", mockVibes));

    expect(result.current.catalogVibes).toHaveLength(2);

    // Check first vibe transformation (newest first)
    expect(result.current.catalogVibes[0]).toMatchObject({
      id: "vibe1234567890", // Newer vibe (created: Date.now() - 1000)
      title: "Catalog Vibe 1",
      encodedTitle: "catalog-vibe-1",
      slug: "vibe1234567890",
      favorite: false,
      publishedUrl: "https://example.com/vibe1",
    });

    // Check that screenshot is properly handled
    expect(result.current.catalogVibes[1].screenshot).toBeDefined();
    expect(result.current.catalogVibes[0].screenshot).toBeUndefined();
  });

  it("should filter out corrupted catalog documents", () => {
    const mockCatalogDocs = [
      {
        _id: "catalog-validvibe12345",
        vibeId: "validvibe12345",
        title: "Valid Vibe",
        created: Date.now(),
      },
      {
        _id: "catalog-anothervibe67890", // Valid entry (long vibeId)
        vibeId: "anothervibe67890",
        title: "Another Valid Vibe",
        created: Date.now(),
      },
      {
        _id: "catalog-short",
        vibeId: "short", // Too short
        title: "Short ID",
        created: Date.now(),
      },
      {
        _id: "not-catalog-doc", // Wrong prefix
        vibeId: "vibethree123456",
        title: "Not Catalog",
        created: Date.now(),
      },
    ];

    // Set up the mock to return our test data for both useAllDocs calls
    mockUseAllDocs.mockReturnValue({
      docs: mockCatalogDocs,
      rows: mockCatalogDocs.map((doc) => ({ id: doc._id, key: doc._id })),
    });

    const { result } = renderHook(() => useCatalog("user123", mockVibes));

    // Should include both valid vibes (long vibeIds with catalog- prefix)
    expect(result.current.catalogVibes).toHaveLength(2);
    expect(result.current.catalogVibes.map((v: LocalVibe) => v.id)).toContain(
      "validvibe12345",
    );
    expect(result.current.catalogVibes.map((v: LocalVibe) => v.id)).toContain(
      "anothervibe67890",
    );
  });

  it("should sort catalog vibes by creation date (newest first)", () => {
    const oldDate = Date.now() - 10000;
    const newDate = Date.now() - 1000;

    const mockCatalogDocs = [
      {
        _id: "catalog-oldervibe1234",
        vibeId: "oldervibe1234",
        title: "Older Vibe",
        created: oldDate,
      },
      {
        _id: "catalog-newervibe5678",
        vibeId: "newervibe5678",
        title: "Newer Vibe",
        created: newDate,
      },
    ];

    // Set up the mock to return our test data for both useAllDocs calls
    mockUseAllDocs.mockReturnValue({
      docs: mockCatalogDocs,
      rows: mockCatalogDocs.map((doc) => ({ id: doc._id, key: doc._id })),
    });

    const { result } = renderHook(() => useCatalog("user123", mockVibes));

    expect(result.current.catalogVibes).toHaveLength(2);
    expect(result.current.catalogVibes[0].title).toBe("Newer Vibe");
    expect(result.current.catalogVibes[1].title).toBe("Older Vibe");
  });

  it("should handle addCatalogScreenshot function", async () => {
    // Set up the mock database for this test
    mockDatabase.get = vi.fn().mockResolvedValue({
      _id: "catalog-vibe1",
      vibeId: "vibe1",
      title: "Test Vibe",
      _files: {},
    });
    mockDatabase.put = vi.fn().mockResolvedValue({ ok: true });

    // Mock fetch for screenshot data
    global.fetch = vi.fn(() =>
      Promise.resolve({
        blob: () =>
          Promise.resolve(new Blob(["screenshot"], { type: "image/png" })),
      }),
    ) as any;

    const { result } = renderHook(() => useCatalog("user123", mockVibes));

    await result.current.addCatalogScreenshot(
      "vibe1",
      "data:image/png;base64,test",
      'console.log("test")',
    );

    expect(mockDatabase.get).toHaveBeenCalledWith("catalog-vibe1");
    expect(mockDatabase.put).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "catalog-vibe1",
        vibeId: "vibe1",
        title: "Test Vibe",
        _files: expect.objectContaining({
          screenshot: expect.any(File),
          source: expect.any(File),
        }),
        lastUpdated: expect.any(Number),
      }),
    );
  });
});
