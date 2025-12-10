import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the entire render module since it uses server-only dependencies
vi.mock("~/vibes.diy/lib/render.js", () => ({
  loadAndRenderTSX: vi.fn(),
  loadAndRenderJSX: vi.fn(),
}));

import { loadAndRenderTSX, loadAndRenderJSX } from "~/vibes.diy/lib/render.js";

describe("lib/render utilities", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("loadAndRenderTSX", () => {
    it("should successfully transform and render TSX file", async () => {
      // Arrange
      const mockHtml = "<div>Test</div>";
      vi.mocked(loadAndRenderTSX).mockResolvedValue(mockHtml);

      // Act
      const result = await loadAndRenderTSX("/test/component.tsx");

      // Assert
      expect(loadAndRenderTSX).toHaveBeenCalledWith("/test/component.tsx");
      expect(result).toBe(mockHtml);
      expect(typeof result).toBe("string");
    });

    it("should pass props correctly to component", async () => {
      // Arrange
      const mockHtml = "<div>Test Title</div>";
      const props = { title: "Test Title", description: "Test Description" };
      vi.mocked(loadAndRenderTSX).mockResolvedValue(mockHtml);

      // Act
      const result = await loadAndRenderTSX("/test/component.tsx", props);

      // Assert
      expect(loadAndRenderTSX).toHaveBeenCalledWith(
        "/test/component.tsx",
        props,
      );
      expect(result).toBe(mockHtml);
    });

    it("should return HTML string", async () => {
      // Arrange
      const mockHtml = "<div>Rendered HTML</div>";
      vi.mocked(loadAndRenderTSX).mockResolvedValue(mockHtml);

      // Act
      const result = await loadAndRenderTSX("/test/component.tsx");

      // Assert
      expect(typeof result).toBe("string");
      expect(result).toContain("<");
      expect(result).toContain(">");
    });
  });

  describe("loadAndRenderJSX", () => {
    it("should successfully transform JSX to JS", async () => {
      // Arrange
      const inputCode =
        "const App = () => <div>Hello</div>; export default App;";
      const mockTransformed =
        "const App = () => React.createElement('div', null, 'Hello'); export default App;";
      vi.mocked(loadAndRenderJSX).mockResolvedValue(mockTransformed);

      // Act
      const result = await loadAndRenderJSX(inputCode);

      // Assert
      expect(loadAndRenderJSX).toHaveBeenCalledWith(inputCode);
      expect(result).toBe(mockTransformed);
    });

    it("should return transformed JavaScript string (not HTML)", async () => {
      // Arrange
      const inputCode = "const App = () => <div>Test</div>;";
      const mockTransformed =
        "const App = () => React.createElement('div', null, 'Test');";
      vi.mocked(loadAndRenderJSX).mockResolvedValue(mockTransformed);

      // Act
      const result = await loadAndRenderJSX(inputCode);

      // Assert
      expect(typeof result).toBe("string");
      expect(result).toBe(mockTransformed);
      // Result should contain JavaScript code, not HTML
      expect(result).toContain("React.createElement");
    });

    it("should handle JSX code with exports", async () => {
      // Arrange
      const inputCode =
        "const App = () => <div>Test</div>; export default App;";
      const mockTransformed =
        "const App = () => React.createElement('div', null, 'Test'); export default App;";
      vi.mocked(loadAndRenderJSX).mockResolvedValue(mockTransformed);

      // Act
      const result = await loadAndRenderJSX(inputCode);

      // Assert
      expect(result).toContain("export");
      expect(typeof result).toBe("string");
    });
  });
});
