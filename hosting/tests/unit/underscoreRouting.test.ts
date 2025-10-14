import { describe, it, expect } from "vitest";
import { parseSubdomain , renderAppInstance, renderCatalogTitle , expectBasicCatalogTitle, expectAppInstance } from "@vibes.diy/hosting";

describe("Underscore-Based Routing Integration", () => {
  // Mock app data for testing
  const mockApp = {
    slug: "test-app",
    title: "Test App",
    name: "Test App",
    code: "function App() { return <div>Hello World</div>; }",
    hasScreenshot: true,
    userId: "user-123",
  };

  // Mock context for testing
  const createMockContext = (url: string) => ({
    req: { url },
    html: (content: string, status = 200) =>
      new Response(content, { status }),
  });

  describe("URL Parsing Integration", () => {
    it("should correctly identify catalog title URLs (no underscore)", () => {
      const testUrls = [
        "https://my-app.vibesdiy.app",
        "https://test-app.vibecode.garden",
        "https://awesome-app.custom-domain.com",
      ];

      testUrls.forEach((url) => {
        const parsed = parseSubdomain(new URL(url).hostname);
        expect(parsed.isInstance).toBe(false);
        expect(parsed.installId).toBeUndefined();
      });
    });

    it("should correctly identify app instance URLs (with underscore)", () => {
      const testUrls = [
        "https://my-app_abc123.vibesdiy.app",
        "https://test-app_550e8400-e29b-41d4-a716-446655440000.vibecode.garden",
        "https://awesome-app_user-session.custom-domain.com",
      ];

      testUrls.forEach((url) => {
        const parsed = parseSubdomain(new URL(url).hostname);
        expect(parsed.isInstance).toBe(true);
        expect(parsed.installId).toBeDefined();
        expect(parsed.installId?.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Route Handler Behavior", () => {
    it("should render catalog title for subdomain without underscore", async () => {
      const context = createMockContext("https://test-app.vibesdiy.app");
      const parsed = parseSubdomain("test-app.vibesdiy.app");

      expect(parsed.isInstance).toBe(false);

      const response = await renderCatalogTitle(context, parsed, mockApp);
      expect(response.status).toBe(200);

      const html = await response.text();
      expect(html).toContain("<!DOCTYPE html>");
      expectBasicCatalogTitle(html, "Test App");
    });

    it("should render app instance for subdomain with underscore", async () => {
      const context = createMockContext("https://test-app_abc123.vibesdiy.app");
      const parsed = parseSubdomain("test-app_abc123.vibesdiy.app");

      expect(parsed.isInstance).toBe(true);
      expect(parsed.installId).toBe("abc123");

      const response = await renderAppInstance(context, parsed, mockApp);
      expect(response.status).toBe(200);

      const html = await response.text();
      expect(html).toContain("<!DOCTYPE html>");
      expectAppInstance(html, "function App()");
    });
  });

  describe("Template Content Validation", () => {
    it("should include proper meta tags for catalog title", async () => {
      const context = createMockContext("https://test-app.vibesdiy.app");
      const parsed = parseSubdomain("test-app.vibesdiy.app");

      const response = await renderCatalogTitle(context, parsed, mockApp);
      const html = await response.text();

      expect(html).toContain("og:title");
      expect(html).toContain("og:description");
      expect(html).toContain("Test App - Vibes DIY");
      expect(html).toContain("https://test-app.vibesdiy.app");
    });

    it("should include proper meta tags for app instance", async () => {
      const context = createMockContext("https://test-app_abc123.vibesdiy.app");
      const parsed = parseSubdomain("test-app_abc123.vibesdiy.app");

      const response = await renderAppInstance(context, parsed, mockApp);
      const html = await response.text();

      expect(html).toContain("og:title");
      expect(html).toContain("og:description");
      expect(html).toContain("Test App");
      // Instance should have screenshot from base app
      expect(html).toContain("https://test-app.vibesdiy.app/screenshot.png");
    });

    it("should handle apps without screenshots in catalog title", async () => {
      const appWithoutScreenshot = { ...mockApp, hasScreenshot: false };
      const context = createMockContext("https://no-screenshot.vibesdiy.app");
      const parsed = parseSubdomain("no-screenshot.vibesdiy.app");

      const response = await renderCatalogTitle(
        context,
        parsed,
        appWithoutScreenshot,
      );
      const html = await response.text();

      expect(html).toContain("placeholder-screenshot");
      expect(html).toContain("No preview available");
      expect(html).toContain("📱");
      // Should have an <img> tag that will be hidden by onerror handler
      expect(html).toMatch(/<img[^>]+class="app-screenshot"/);
      expect(html).toContain("onerror=\"this.style.display='none';");
    });

    it("should handle apps with screenshots in catalog title", async () => {
      const context = createMockContext("https://with-screenshot.vibesdiy.app");
      const parsed = parseSubdomain("with-screenshot.vibesdiy.app");

      const response = await renderCatalogTitle(context, parsed, mockApp);
      const html = await response.text();

      expect(html).toContain("/screenshot.png");
      expect(html).toMatch(/<img[^>]+class="app-screenshot"/);
      // Should have placeholder content in the HTML body (but hidden by default)
      expect(html).toMatch(
        /<div[^>]+class="placeholder-screenshot"[^>]*style="display: none;"/,
      );
    });

    it("should include color-scheme and theme-color meta tags", async () => {
      const context = createMockContext("https://test-app.vibesdiy.app");
      const parsed = parseSubdomain("test-app.vibesdiy.app");

      const response = await renderCatalogTitle(context, parsed, mockApp);
      const html = await response.text();

      expect(html).toContain(
        '<meta name="color-scheme" content="light dark" />',
      );
      // Two theme-color tags with light/dark media queries and expected colors
      const themeColorTags =
        html.match(/<meta[^>]+name="theme-color"/g) || [];
      expect(themeColorTags.length).toBe(2);
      expect(html).toContain(
        '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f1f5f9" />',
      );
      expect(html).toContain(
        '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b1220" />',
      );
    });
  });

  describe("Launch Button Functionality", () => {
    it("should include launch button JavaScript in catalog title", async () => {
      const context = createMockContext("https://test-app.vibesdiy.app");
      const parsed = parseSubdomain("test-app.vibesdiy.app");

      const response = await renderCatalogTitle(context, parsed, mockApp);
      const html = await response.text();

      expect(html).toContain("function launchApp()");
      expect(html).toContain("function generateInstallId()");
      expect(html).toContain("launch-app-btn");
      expect(html).toContain("addEventListener");
    });

    it("should not include launch button functionality in app instance", async () => {
      const context = createMockContext("https://test-app_abc123.vibesdiy.app");
      const parsed = parseSubdomain("test-app_abc123.vibesdiy.app");

      const response = await renderAppInstance(context, parsed, mockApp);
      const html = await response.text();

      expect(html).not.toContain("function launchApp()");
      expect(html).not.toContain("launch-app-btn");
    });
  });

  describe("App Code Integration", () => {
    it("should not include app code in catalog title", async () => {
      const context = createMockContext("https://test-app.vibesdiy.app");
      const parsed = parseSubdomain("test-app.vibesdiy.app");

      const response = await renderCatalogTitle(context, parsed, mockApp);
      const html = await response.text();

      expect(html).not.toContain("function App()");
      expect(html).not.toContain("ReactDOMClient");
      // Catalog page now includes ES module script for install history, but not user app code
      expect(html).toContain('type="module"'); // For install history component
      expect(html).not.toContain(mockApp.code); // But not the actual app code
    });

    it("should include app code in app instance", async () => {
      const context = createMockContext("https://test-app_abc123.vibesdiy.app");
      const parsed = parseSubdomain("test-app_abc123.vibesdiy.app");

      const response = await renderAppInstance(context, parsed, mockApp);
      const html = await response.text();

      expect(html).toContain("function App()");
      expect(html).toContain("ReactDOMClient");
      expect(html).toContain('type="text/babel"');
      expect(html).toContain("Hello World");
    });
  });

  describe("Remix Button Integration", () => {
    it("should include remix URL in catalog title footer", async () => {
      const context = createMockContext("https://test-app.vibesdiy.app");
      const parsed = parseSubdomain("test-app.vibesdiy.app");

      const response = await renderCatalogTitle(context, parsed, mockApp);
      const html = await response.text();

      expect(html).toContain("Remix this vibe");
      expect(html).toContain("https://vibes.diy/remix/test-app");
    });

    it("should render remix apps with VibeControl integration", async () => {
      const remixApp = { ...mockApp, remixOf: "original-app" };
      const context = createMockContext(
        "https://remix-app_abc123.vibesdiy.app",
      );
      const parsed = parseSubdomain("remix-app_abc123.vibesdiy.app");

      const response = await renderAppInstance(context, parsed, remixApp);
      const html = await response.text();

      // Should have VibeControl integration (which handles remix UI)
      expect(html).toContain("mountVibesApp");
      expect(response.status).toBe(200);
    });
  });

  describe("Complex Subdomain Scenarios", () => {
    it("should handle multiple underscores in install ID", async () => {
      const context = createMockContext(
        "https://app_user_session_123.vibesdiy.app",
      );
      const parsed = parseSubdomain("app_user_session_123.vibesdiy.app");

      expect(parsed.appSlug).toBe("app");
      expect(parsed.installId).toBe("user_session_123");
      expect(parsed.isInstance).toBe(true);

      const response = await renderAppInstance(context, parsed, mockApp);
      expect(response.status).toBe(200);
    });

    it("should handle UUID-style install IDs", async () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const context = createMockContext(
        `https://uuid-app_${uuid}.vibesdiy.app`,
      );
      const parsed = parseSubdomain(`uuid-app_${uuid}.vibesdiy.app`);

      expect(parsed.appSlug).toBe("uuid-app");
      expect(parsed.installId).toBe(uuid);
      expect(parsed.isInstance).toBe(true);

      const response = await renderAppInstance(context, parsed, mockApp);
      expect(response.status).toBe(200);
    });

    it("should handle complex app slug names", async () => {
      const complexApp = { ...mockApp, slug: "weather-dashboard-v2-beta" };
      const context = createMockContext(
        "https://weather-dashboard-v2-beta.vibesdiy.app",
      );
      const parsed = parseSubdomain("weather-dashboard-v2-beta.vibesdiy.app");

      expect(parsed.appSlug).toBe("weather-dashboard-v2-beta");
      expect(parsed.isInstance).toBe(false);

      const response = await renderCatalogTitle(context, parsed, complexApp);
      expect(response.status).toBe(200);
    });
  });
});
