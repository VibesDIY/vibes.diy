import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { listLocalVibes, deleteVibeDatabase } from "~/vibes.diy/app/utils/vibeUtils.js";
import type { LocalVibe } from "~/vibes.diy/app/utils/vibeUtils.js";

// Mock vibeUtils module
vi.mock("~/vibes.diy/app/utils/vibeUtils", () => {
  return {
    listLocalVibes: vi.fn(),
    deleteVibeDatabase: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock indexedDB after the vibeUtils mock is set up
const mockIndexedDB = {
  databases: vi.fn().mockResolvedValue([
    { name: "fp.vibe-test1", version: 1 },
    { name: "fp.vibe-test2", version: 1 },
    { name: "fp.other-db", version: 1 },
  ]),
  deleteDatabase: vi.fn().mockImplementation(() => Promise.resolve()),
};
vi.stubGlobal("indexedDB", mockIndexedDB);

// Set up test data
const mockVibes: LocalVibe[] = [
  {
    id: "test1",
    title: "Test Vibe 1",
    encodedTitle: "test-vibe-1",
    slug: "original-vibe",
    created: new Date(1713632400000).toISOString(),
    screenshot: {
      file: () => Promise.resolve(new File(["test"], "screenshot.png", { type: "image/png" })),
      type: "image/png",
    },
  },
  {
    id: "test2",
    title: "Test Vibe 2",
    encodedTitle: "test-vibe-2",
    slug: "original-vibe",
    created: new Date(1713632400000).toISOString(),
    screenshot: {
      file: () => Promise.resolve(new File(["test"], "screenshot.png", { type: "image/png" })),
      type: "image/png",
    },
  },
];

describe("vibeUtils", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Set up the listLocalVibes mock to return our test data
    (listLocalVibes as Mock).mockResolvedValue(mockVibes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("listLocalVibes", () => {
    it("should return vibe information", async () => {
      // Act
      const vibes = await listLocalVibes();

      // Assert
      expect(vibes.length).toBe(2);
      expect(vibes[0].id).toBe("test1");
      expect(vibes[0].title).toBe("Test Vibe 1");
      expect(vibes[0].slug).toBe("original-vibe");
      expect(vibes[0].created).toBeDefined();
      expect(vibes[0].screenshot).toBeDefined();
    });

    it("should handle empty database list", async () => {
      // Arrange
      (listLocalVibes as Mock).mockResolvedValueOnce([]);

      // Act
      const vibes = await listLocalVibes();

      // Assert
      expect(vibes.length).toBe(0);
    });

    it("should handle errors gracefully", async () => {
      // Arrange
      (listLocalVibes as Mock).mockResolvedValueOnce([]);

      // Act
      const vibes = await listLocalVibes();

      // Assert
      expect(vibes.length).toBe(0);
    });
  });

  describe("deleteVibeDatabase", () => {
    it("should delete the database with the correct ID", async () => {
      // Act
      await deleteVibeDatabase("test-vibe-id");

      // Assert
      expect(deleteVibeDatabase).toHaveBeenCalledWith("test-vibe-id");
    });

    it("should handle errors and rethrow them", async () => {
      // Arrange
      (deleteVibeDatabase as Mock).mockRejectedValueOnce(new Error("Delete error"));

      // Act & Assert
      await expect(deleteVibeDatabase("test-vibe-id")).rejects.toThrow("Delete error");
    });
  });
});
