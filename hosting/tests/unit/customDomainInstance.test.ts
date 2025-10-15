import { describe, it, expect, beforeEach } from "vitest";
import renderApp from "@vibes.diy/hosting";

describe("Custom Domain Instance Behavior", () => {
  // Mock KV storage
  const kvStore = new Map<string, string | ArrayBuffer>();

  // Mock environment
  const mockEnv = {
    KV: {
      get: async (key: string, type?: string) => {
        const value = kvStore.get(key);
        if (!value) return null;
        if (type === "arrayBuffer" && value instanceof ArrayBuffer) {
          return value;
        }
        return typeof value === "string" ? value : null;
      },
      put: async (key: string, value: string | ArrayBuffer) => {
        kvStore.set(key, value);
      },
      delete: async (key: string) => {
        kvStore.delete(key);
      },
    },
    SERVER_OPENROUTER_API_KEY: "test-provisioning-key",
  };

  // Helper function to make requests with proper Request objects
  const fetchApp = (url: string) => {
    const req = new Request(url);
    return renderApp.fetch(req, mockEnv);
  };

  beforeEach(() => {
    kvStore.clear();
  });

  describe("Custom Domain Detection", () => {
    it("should detect custom domains (non-vibesdiy domains)", async () => {
      const testApp = {
        slug: "crypto-app-123",
        title: "CryptoApp",
        name: "CryptoApp",
        code: "export default function App() { return <div>Hello Crypto</div> }",
      };

      // Set up app and domain mapping for ncrypt.app -> crypto-app-123
      kvStore.set("crypto-app-123", JSON.stringify(testApp));
      kvStore.set("domain:ncrypt.app", "crypto-app-123");

      const res = await fetchApp("https://ncrypt.app/");

      expect(res.status).toBe(200);
      const html = await res.text();

      // Should serve app instance directly (not catalog page)
      expect(html).toContain("Hello Crypto");
      expect(html).toContain("ReactDOMClient");
      expect(html).toContain("container");

      // Should NOT contain catalog elements
      expect(html).not.toContain("catalog-container");
      expect(html).not.toContain("Launch App");
      expect(html).not.toContain("launch-app-btn");
    });

    it("should NOT treat vibesdiy.app domains as custom", async () => {
      const testApp = {
        slug: "test-app-123",
        title: "Test App",
        name: "Test App",
        code: "export default function App() { return <div>Regular App</div> }",
      };

      kvStore.set("test-app-123", JSON.stringify(testApp));

      const res = await fetchApp("https://test-app-123.vibesdiy.app/");

      expect(res.status).toBe(200);
      const html = await res.text();

      // Should serve catalog page (normal behavior)
      expect(html).toContain("catalog-container");
      expect(html).toContain("Install");
      expect(html).not.toContain("ReactDOMClient");
    });

    it("should NOT treat vibesdiy.work domains as custom", async () => {
      const testApp = {
        slug: "work-app-123",
        title: "Work App",
        name: "Work App",
        code: "export default function App() { return <div>Work App</div> }",
      };

      kvStore.set("work-app-123", JSON.stringify(testApp));

      const res = await fetchApp("https://work-app-123.vibesdiy.work/");

      expect(res.status).toBe(200);
      const html = await res.text();

      // Should serve catalog page (normal behavior)
      expect(html).toContain("catalog-container");
      expect(html).toContain("Install");
      expect(html).not.toContain("ReactDOMClient");
    });

    it("should NOT treat vibecode.garden domains as custom", async () => {
      const testApp = {
        slug: "garden-app-123",
        title: "Garden App",
        name: "Garden App",
        code: "export default function App() { return <div>Garden App</div> }",
      };

      kvStore.set("garden-app-123", JSON.stringify(testApp));

      const res = await fetchApp("https://garden-app-123.vibecode.garden/");

      expect(res.status).toBe(200);
      const html = await res.text();

      // Should serve catalog page (normal behavior)
      expect(html).toContain("catalog-container");
      expect(html).toContain("Install");
      expect(html).not.toContain("ReactDOMClient");
    });
  });

  describe("Custom Domain URL Preservation", () => {
    it("should preserve custom domain in meta tags", async () => {
      const testApp = {
        slug: "crypto-app-123",
        title: "CryptoApp",
        name: "CryptoApp",
        code: "export default function App() { return <div>Hello Crypto</div> }",
      };

      kvStore.set("crypto-app-123", JSON.stringify(testApp));
      kvStore.set("domain:ncrypt.app", "crypto-app-123");

      const res = await fetchApp("https://ncrypt.app/");
      const html = await res.text();

      // Meta tags should use custom domain, not vibesdiy.app
      expect(html).toContain('og:url" content="https://ncrypt.app');
      expect(html).toContain('twitter:url" content="https://ncrypt.app');
      expect(html).not.toContain("vibesdiy.app");
    });

    it("should preserve custom domain in screenshot URLs", async () => {
      const testApp = {
        slug: "crypto-app-123",
        title: "CryptoApp",
        name: "CryptoApp",
        code: "export default function App() { return <div>Hello Crypto</div> }",
      };

      kvStore.set("crypto-app-123", JSON.stringify(testApp));
      kvStore.set("domain:example.com", "crypto-app-123");

      const res = await fetchApp("https://example.com/");
      const html = await res.text();

      // Screenshot URLs should use custom domain
      expect(html).toContain(
        'og:image" content="https://example.com/screenshot.png',
      );
      expect(html).toContain(
        'twitter:image" content="https://example.com/screenshot.png',
      );
    });
  });

  describe("Multiple Custom Domains", () => {
    it("should handle different custom domains for same app", async () => {
      const testApp = {
        slug: "multi-app-123",
        title: "Multi App",
        name: "Multi App",
        code: "export default function App() { return <div>Multi Domain App</div> }",
      };

      kvStore.set("multi-app-123", JSON.stringify(testApp));
      kvStore.set("domain:first.com", "multi-app-123");
      kvStore.set("domain:second.io", "multi-app-123");

      // Test first domain
      const res1 = await fetchApp("https://first.com/");
      expect(res1.status).toBe(200);
      const html1 = await res1.text();

      expect(html1).toContain("Multi Domain App");
      expect(html1).toContain("ReactDOMClient");
      expect(html1).toContain('og:url" content="https://first.com');
      expect(html1).not.toContain("catalog-container");

      // Test second domain
      const res2 = await fetchApp("https://second.io/");
      expect(res2.status).toBe(200);
      const html2 = await res2.text();

      expect(html2).toContain("Multi Domain App");
      expect(html2).toContain("ReactDOMClient");
      expect(html2).toContain('og:url" content="https://second.io');
      expect(html2).not.toContain("catalog-container");
    });
  });

  describe("Custom Domain App.jsx Route", () => {
    it("should serve app code for custom domain /App.jsx route", async () => {
      const testApp = {
        slug: "custom-jsx-app",
        title: "Custom JSX App",
        name: "Custom JSX App",
        code: "export default function App() { return <div>Custom JSX</div> }",
      };

      kvStore.set("custom-jsx-app", JSON.stringify(testApp));
      kvStore.set("domain:customjsx.com", "custom-jsx-app");

      const res = await fetchApp("https://customjsx.com/App.jsx");

      expect(res.status).toBe(200);
      const jsCode = await res.text();

      expect(jsCode).toContain("export default function App()");
      expect(jsCode).toContain("Custom JSX");
      expect(res.headers.get("Content-Type")).toContain(
        "application/javascript",
      );
    });
  });

  describe("Custom Domain Screenshot Route", () => {
    it("should serve screenshot for custom domain /screenshot.png route", async () => {
      const testApp = {
        slug: "screenshot-app",
        title: "Screenshot App",
        name: "Screenshot App",
        code: "export default function App() { return <div>Screenshot</div> }",
      };

      kvStore.set("screenshot-app", JSON.stringify(testApp));
      kvStore.set("domain:screenshot.com", "screenshot-app");
      kvStore.set("screenshot-app-screenshot", new ArrayBuffer(100));

      const res = await fetchApp("https://screenshot.com/screenshot.png");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
    });
  });

  describe("Custom Domain Instance ID Preservation", () => {
    it("should preserve existing instance ID in custom domain mapping", async () => {
      const testApp = {
        slug: "my-app-123",
        title: "My Test App",
        name: "My Test App",
        code: "export default function App() { return <div>Specific Instance</div> }",
      };

      // Set up app and domain mapping that already specifies an instance
      kvStore.set("my-app-123", JSON.stringify(testApp));
      kvStore.set("domain:specific.com", "my-app-123_abc123"); // Already has instance ID

      const res = await fetchApp("https://specific.com/");

      expect(res.status).toBe(200);
      const html = await res.text();

      // Should serve app instance directly
      expect(html).toContain("Specific Instance");
      expect(html).toContain("ReactDOMClient");

      // Should preserve custom domain in URLs
      expect(html).toContain('og:url" content="https://specific.com');
    });

    it("should add _origin to custom domain mapping without instance ID", async () => {
      const testApp = {
        slug: "another-app-456",
        title: "Another Test App",
        name: "Another Test App",
        code: "export default function App() { return <div>Origin Instance</div> }",
      };

      // Set up app and domain mapping that only specifies app slug
      kvStore.set("another-app-456", JSON.stringify(testApp));
      kvStore.set("domain:generic.com", "another-app-456"); // No instance ID

      const res = await fetchApp("https://generic.com/");

      expect(res.status).toBe(200);
      const html = await res.text();

      // Should serve app instance directly
      expect(html).toContain("Origin Instance");
      expect(html).toContain("ReactDOMClient");

      // Should preserve custom domain in URLs
      expect(html).toContain('og:url" content="https://generic.com');
    });
  });

  describe("Invalid Custom Domain Mappings", () => {
    it("should return 404 for unmapped custom domain", async () => {
      const res = await fetchApp("https://unmapped-custom.com/");
      expect(res.status).toBe(404);
    });

    it("should return 404 for custom domain mapped to non-existent app", async () => {
      kvStore.set("domain:broken.com", "non-existent-app");

      const res = await fetchApp("https://broken.com/");
      expect(res.status).toBe(404);
    });
  });
});
