import { describe, it, expect } from "vitest";
import { renderAppInstance, parseSubdomain } from "@vibes.diy/hosting";

describe("Vibes Version Override (v_vibes parameter)", () => {
  // Mock app data for testing
  const mockApp = {
    slug: "test-app",
    title: "Test App",
    name: "Test App",
    code: "function App() { return <div>Hello World</div>; }",
    hasScreenshot: true,
    userId: "user-123",
  };

  // Mock context for testing with v_vibes parameter
  const createMockContext = (url: string) => ({
    req: { url },
    html: (content: string, status = 200) => new Response(content, { status }),
  });

  describe("Import Map Version Override", () => {
    it("should use default versions when no v_vibes parameter is provided", async () => {
      const context = createMockContext("https://test-app_abc123.vibesdiy.app");
      const parsed = parseSubdomain("test-app_abc123.vibesdiy.app");

      const response = await renderAppInstance(context, parsed, mockApp);
      const html = await response.text();

      expect(html).toContain('"use-vibes": "https://esm.sh/use-vibes"');
      expect(html).toContain('"use-fireproof": "https://esm.sh/use-vibes"');
    });

    it("should override use-vibes and use-fireproof versions when valid v_vibes parameter is provided", async () => {
      const context = createMockContext(
        "https://test-app_abc123.vibesdiy.app?v_vibes=1.2.3",
      );
      const parsed = parseSubdomain("test-app_abc123.vibesdiy.app");

      const response = await renderAppInstance(context, parsed, mockApp);
      const html = await response.text();

      expect(html).toContain('"use-vibes": "https://esm.sh/use-vibes@1.2.3"');
      expect(html).toContain(
        '"use-fireproof": "https://esm.sh/use-vibes@1.2.3"',
      );
    });

    it("should handle semantic versioning with patch versions", async () => {
      const context = createMockContext(
        "https://test-app_abc123.vibesdiy.app?v_vibes=2.1.0",
      );
      const parsed = parseSubdomain("test-app_abc123.vibesdiy.app");

      const response = await renderAppInstance(context, parsed, mockApp);
      const html = await response.text();

      expect(html).toContain('"use-vibes": "https://esm.sh/use-vibes@2.1.0"');
      expect(html).toContain(
        '"use-fireproof": "https://esm.sh/use-vibes@2.1.0"',
      );
    });

    it("should handle major.minor versions", async () => {
      const context = createMockContext(
        "https://test-app_abc123.vibesdiy.app?v_vibes=3.4",
      );
      const parsed = parseSubdomain("test-app_abc123.vibesdiy.app");

      const response = await renderAppInstance(context, parsed, mockApp);
      const html = await response.text();

      expect(html).toContain('"use-vibes": "https://esm.sh/use-vibes@3.4"');
      expect(html).toContain('"use-fireproof": "https://esm.sh/use-vibes@3.4"');
    });

    it("should handle major-only versions", async () => {
      const context = createMockContext(
        "https://test-app_abc123.vibesdiy.app?v_vibes=5",
      );
      const parsed = parseSubdomain("test-app_abc123.vibesdiy.app");

      const response = await renderAppInstance(context, parsed, mockApp);
      const html = await response.text();

      expect(html).toContain('"use-vibes": "https://esm.sh/use-vibes@5"');
      expect(html).toContain('"use-fireproof": "https://esm.sh/use-vibes@5"');
    });

    it("should handle pre-release versions", async () => {
      const context = createMockContext(
        "https://test-app_abc123.vibesdiy.app?v_vibes=1.2.3-alpha.1",
      );
      const parsed = parseSubdomain("test-app_abc123.vibesdiy.app");

      const response = await renderAppInstance(context, parsed, mockApp);
      const html = await response.text();

      expect(html).toContain(
        '"use-vibes": "https://esm.sh/use-vibes@1.2.3-alpha.1"',
      );
      expect(html).toContain(
        '"use-fireproof": "https://esm.sh/use-vibes@1.2.3-alpha.1"',
      );
    });

    it("should handle beta versions", async () => {
      const context = createMockContext(
        "https://test-app_abc123.vibesdiy.app?v_vibes=2.0.0-beta.10",
      );
      const parsed = parseSubdomain("test-app_abc123.vibesdiy.app");

      const response = await renderAppInstance(context, parsed, mockApp);
      const html = await response.text();

      expect(html).toContain(
        '"use-vibes": "https://esm.sh/use-vibes@2.0.0-beta.10"',
      );
      expect(html).toContain(
        '"use-fireproof": "https://esm.sh/use-vibes@2.0.0-beta.10"',
      );
    });
  });

  describe("Version Validation", () => {
    it("should ignore invalid version strings and use defaults", async () => {
      const invalidVersions = [
        "invalid-version",
        "1.2.3.4.5", // too many parts
        "abc",
        "1.2.x",
        "",
        " ", // whitespace
        "v1.2.3", // 'v' prefix not allowed
      ];

      for (const version of invalidVersions) {
        const context = createMockContext(
          `https://test-app_abc123.vibesdiy.app?v_vibes=${encodeURIComponent(version)}`,
        );
        const parsed = parseSubdomain("test-app_abc123.vibesdiy.app");

        const response = await renderAppInstance(context, parsed, mockApp);
        const html = await response.text();

        expect(html).toContain('"use-vibes": "https://esm.sh/use-vibes"');
        expect(html).toContain('"use-fireproof": "https://esm.sh/use-vibes"');
      }
    });

    it("should trim whitespace from version parameter", async () => {
      const context = createMockContext(
        "https://test-app_abc123.vibesdiy.app?v_vibes=%20%201.2.3%20%20",
      );
      const parsed = parseSubdomain("test-app_abc123.vibesdiy.app");

      const response = await renderAppInstance(context, parsed, mockApp);
      const html = await response.text();

      expect(html).toContain('"use-vibes": "https://esm.sh/use-vibes@1.2.3"');
      expect(html).toContain(
        '"use-fireproof": "https://esm.sh/use-vibes@1.2.3"',
      );
    });

    it("should handle empty v_vibes parameter", async () => {
      const context = createMockContext(
        "https://test-app_abc123.vibesdiy.app?v_vibes=",
      );
      const parsed = parseSubdomain("test-app_abc123.vibesdiy.app");

      const response = await renderAppInstance(context, parsed, mockApp);
      const html = await response.text();

      expect(html).toContain('"use-vibes": "https://esm.sh/use-vibes"');
      expect(html).toContain('"use-fireproof": "https://esm.sh/use-vibes"');
    });
  });

  describe("Import Map Structure", () => {
    it("should maintain correct import map structure with version override", async () => {
      const context = createMockContext(
        "https://test-app_abc123.vibesdiy.app?v_vibes=1.5.0",
      );
      const parsed = parseSubdomain("test-app_abc123.vibesdiy.app");

      const response = await renderAppInstance(context, parsed, mockApp);
      const html = await response.text();

      // Extract import map from HTML
      const importMapMatch = html.match(
        /<script type="importmap">\s*({[\s\S]*?})\s*<\/script>/,
      );
      expect(importMapMatch).not.toBeNull();
      if (!importMapMatch) throw new Error("importMapMatch should not be null");

      const importMap = JSON.parse(importMapMatch[1]);
      expect(importMap).toHaveProperty("imports");
      expect(importMap.imports).toHaveProperty(
        "use-vibes",
        "https://esm.sh/use-vibes@1.5.0",
      );
      expect(importMap.imports).toHaveProperty(
        "use-fireproof",
        "https://esm.sh/use-vibes@1.5.0",
      );

      // Ensure other imports are preserved
      expect(importMap.imports).toHaveProperty("react");
      expect(importMap.imports).toHaveProperty("react-dom");
    });

    it("should not affect other library versions", async () => {
      const context = createMockContext(
        "https://test-app_abc123.vibesdiy.app?v_vibes=1.0.0",
      );
      const parsed = parseSubdomain("test-app_abc123.vibesdiy.app");

      const response = await renderAppInstance(context, parsed, mockApp);
      const html = await response.text();

      // Extract import map from HTML
      const importMapMatch = html.match(
        /<script type="importmap">\s*({[\s\S]*?})\s*<\/script>/,
      );
      expect(importMapMatch).not.toBeNull();
      if (!importMapMatch) throw new Error("importMapMatch should not be null");

      const importMap = JSON.parse(importMapMatch[1]);

      // React versions should remain unpinned (no version specifiers)
      expect(importMap.imports.react).toBe("https://esm.sh/react");
      expect(importMap.imports["react-dom"]).toBe("https://esm.sh/react-dom");

      // Only use-vibes related imports should be affected
      expect(importMap.imports["use-vibes"]).toBe(
        "https://esm.sh/use-vibes@1.0.0",
      );
      expect(importMap.imports["use-fireproof"]).toBe(
        "https://esm.sh/use-vibes@1.0.0",
      );
    });
  });

  describe("URL Parameter Handling", () => {
    it("should handle multiple URL parameters with v_vibes", async () => {
      const context = createMockContext(
        "https://test-app_abc123.vibesdiy.app?debug=true&v_vibes=2.3.4&other=value",
      );
      const parsed = parseSubdomain("test-app_abc123.vibesdiy.app");

      const response = await renderAppInstance(context, parsed, mockApp);
      const html = await response.text();

      expect(html).toContain('"use-vibes": "https://esm.sh/use-vibes@2.3.4"');
      expect(html).toContain(
        '"use-fireproof": "https://esm.sh/use-vibes@2.3.4"',
      );
    });

    it("should handle URL-encoded version parameter", async () => {
      const context = createMockContext(
        "https://test-app_abc123.vibesdiy.app?v_vibes=1.0.0-alpha%2B001",
      );
      const parsed = parseSubdomain("test-app_abc123.vibesdiy.app");

      const response = await renderAppInstance(context, parsed, mockApp);
      const html = await response.text();

      expect(html).toContain(
        '"use-vibes": "https://esm.sh/use-vibes@1.0.0-alpha+001"',
      );
      expect(html).toContain(
        '"use-fireproof": "https://esm.sh/use-vibes@1.0.0-alpha+001"',
      );
    });
  });
});
