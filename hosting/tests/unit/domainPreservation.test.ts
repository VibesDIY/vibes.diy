import { describe, it, expect, beforeEach } from "vitest";
import renderApp from "@vibes.diy/hosting";

describe("First-Party Domain Preservation", () => {
  // Mock KV storage
  const kvStore = new Map<string, string>();

  // Mock environment
  const mockEnv = {
    KV: {
      get: async (key: string, type?: string) => {
        const value = kvStore.get(key);
        if (!value) return null;
        if (type === "arrayBuffer") {
          return new ArrayBuffer(100);
        }
        return value;
      },
      put: async (key: string, value: string) => {
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

  describe("Domain preservation for vibesdiy.app", () => {
    it("should preserve vibesdiy.app domain in meta tags for catalog pages", async () => {
      const testApp = {
        slug: "test-app",
        title: "Test App",
        name: "Test App",
        code: "export default function App() { return <div>Test</div> }",
      };

      kvStore.set("test-app", JSON.stringify(testApp));

      const res = await fetchApp("https://test-app.vibesdiy.app/");
      expect(res.status).toBe(200);
      const html = await res.text();

      // Should use vibesdiy.app, not hardcoded to another domain
      expect(html).toContain('og:url" content="https://test-app.vibesdiy.app');
      expect(html).toContain(
        'og:image" content="https://test-app.vibesdiy.app/screenshot.png',
      );
      expect(html).not.toContain("vibesdiy.work");
      expect(html).not.toContain("vibecode.garden");
    });

    it("should preserve vibesdiy.app domain for instance pages", async () => {
      const testApp = {
        slug: "test-app",
        title: "Test App",
        name: "Test App",
        code: "export default function App() { return <div>Test Instance</div> }",
      };

      kvStore.set("test-app", JSON.stringify(testApp));

      const res = await fetchApp("https://test-app_abc123.vibesdiy.app/");
      expect(res.status).toBe(200);
      const html = await res.text();

      // Should use vibesdiy.app in meta tags
      expect(html).toContain(
        'og:url" content="https://test-app_abc123.vibesdiy.app',
      );
      expect(html).toContain(
        'og:image" content="https://test-app.vibesdiy.app/screenshot.png',
      );
      expect(html).not.toContain("vibesdiy.work");
      expect(html).not.toContain("vibecode.garden");
    });
  });

  describe("Domain preservation for vibesdiy.work", () => {
    it("should preserve vibesdiy.work domain in meta tags for catalog pages", async () => {
      const testApp = {
        slug: "work-app",
        title: "Work App",
        name: "Work App",
        code: "export default function App() { return <div>Work</div> }",
      };

      kvStore.set("work-app", JSON.stringify(testApp));

      const res = await fetchApp("https://work-app.vibesdiy.work/");
      expect(res.status).toBe(200);
      const html = await res.text();

      // Should use vibesdiy.work, not vibesdiy.app
      expect(html).toContain('og:url" content="https://work-app.vibesdiy.work');
      expect(html).toContain(
        'og:image" content="https://work-app.vibesdiy.work/screenshot.png',
      );
      expect(html).not.toContain("vibesdiy.app");
      expect(html).not.toContain("vibecode.garden");
    });

    it("should preserve vibesdiy.work domain for instance pages", async () => {
      const testApp = {
        slug: "work-app",
        title: "Work App",
        name: "Work App",
        code: "export default function App() { return <div>Work Instance</div> }",
      };

      kvStore.set("work-app", JSON.stringify(testApp));

      const res = await fetchApp("https://work-app_xyz789.vibesdiy.work/");
      expect(res.status).toBe(200);
      const html = await res.text();

      // Should use vibesdiy.work in meta tags
      expect(html).toContain(
        'og:url" content="https://work-app_xyz789.vibesdiy.work',
      );
      expect(html).toContain(
        'og:image" content="https://work-app.vibesdiy.work/screenshot.png',
      );
      expect(html).not.toContain("vibesdiy.app");
      expect(html).not.toContain("vibecode.garden");
    });
  });

  describe("Domain preservation for vibecode.garden", () => {
    it("should preserve vibecode.garden domain in meta tags for catalog pages", async () => {
      const testApp = {
        slug: "garden-app",
        title: "Garden App",
        name: "Garden App",
        code: "export default function App() { return <div>Garden</div> }",
      };

      kvStore.set("garden-app", JSON.stringify(testApp));

      const res = await fetchApp("https://garden-app.vibecode.garden/");
      expect(res.status).toBe(200);
      const html = await res.text();

      // Should use vibecode.garden, not vibesdiy.app
      expect(html).toContain(
        'og:url" content="https://garden-app.vibecode.garden',
      );
      expect(html).toContain(
        'og:image" content="https://garden-app.vibecode.garden/screenshot.png',
      );
      expect(html).not.toContain("vibesdiy.app");
      expect(html).not.toContain("vibesdiy.work");
    });

    it("should preserve vibecode.garden domain for instance pages", async () => {
      const testApp = {
        slug: "garden-app",
        title: "Garden App",
        name: "Garden App",
        code: "export default function App() { return <div>Garden Instance</div> }",
      };

      kvStore.set("garden-app", JSON.stringify(testApp));

      const res = await fetchApp("https://garden-app_def456.vibecode.garden/");
      expect(res.status).toBe(200);
      const html = await res.text();

      // Should use vibecode.garden in meta tags
      expect(html).toContain(
        'og:url" content="https://garden-app_def456.vibecode.garden',
      );
      expect(html).toContain(
        'og:image" content="https://garden-app.vibecode.garden/screenshot.png',
      );
      expect(html).not.toContain("vibesdiy.app");
      expect(html).not.toContain("vibesdiy.work");
    });
  });

  describe("Custom domain with domain preservation", () => {
    it("should preserve vibesdiy.work when mapping custom domain from .work", async () => {
      const testApp = {
        slug: "custom-work-app",
        title: "Custom Work App",
        name: "Custom Work App",
        code: "export default function App() { return <div>Custom Work</div> }",
      };

      kvStore.set("custom-work-app", JSON.stringify(testApp));
      kvStore.set("domain:customwork.com", "custom-work-app");

      // First set up the mapping from a .work domain
      const setupRes = await fetchApp("https://custom-work-app.vibesdiy.work/");
      expect(setupRes.status).toBe(200);

      // Now when accessing via custom domain, it should remember .work was the original
      const res = await fetchApp("https://customwork.com/");
      expect(res.status).toBe(200);
      const html = await res.text();

      // Custom domain should be preserved in URLs
      expect(html).toContain('og:url" content="https://customwork.com');
      expect(html).toContain(
        'og:image" content="https://customwork.com/screenshot.png',
      );
    });

    it("should handle custom domain mapping with instance ID from vibecode.garden", async () => {
      const testApp = {
        slug: "garden-custom-app",
        title: "Garden Custom App",
        name: "Garden Custom App",
        code: "export default function App() { return <div>Garden Custom</div> }",
      };

      kvStore.set("garden-custom-app", JSON.stringify(testApp));
      kvStore.set("domain:gardencustom.io", "garden-custom-app_instance123");

      const res = await fetchApp("https://gardencustom.io/");
      expect(res.status).toBe(200);
      const html = await res.text();

      // Custom domain should be preserved
      expect(html).toContain('og:url" content="https://gardencustom.io');
      expect(html).toContain(
        'og:image" content="https://gardencustom.io/screenshot.png',
      );

      // Should serve instance directly (not catalog)
      expect(html).toContain("Garden Custom");
      expect(html).toContain("mountVibesApp");
      expect(html).not.toContain("catalog-container");
    });
  });

  describe("App.jsx endpoint with domain preservation", () => {
    it("should serve App.jsx from vibesdiy.work domain", async () => {
      const testApp = {
        slug: "jsx-work-app",
        title: "JSX Work App",
        name: "JSX Work App",
        code: "export default function WorkApp() { return <div>Work JSX</div> }",
      };

      kvStore.set("jsx-work-app", JSON.stringify(testApp));

      const res = await fetchApp("https://jsx-work-app.vibesdiy.work/App.jsx");
      expect(res.status).toBe(200);
      const jsCode = await res.text();

      expect(jsCode).toContain("export default function WorkApp()");
      expect(jsCode).toContain("Work JSX");
      expect(res.headers.get("Content-Type")).toContain(
        "application/javascript",
      );
    });

    it("should serve App.jsx from vibecode.garden domain", async () => {
      const testApp = {
        slug: "jsx-garden-app",
        title: "JSX Garden App",
        name: "JSX Garden App",
        code: "export default function GardenApp() { return <div>Garden JSX</div> }",
      };

      kvStore.set("jsx-garden-app", JSON.stringify(testApp));

      const res = await fetchApp(
        "https://jsx-garden-app.vibecode.garden/App.jsx",
      );
      expect(res.status).toBe(200);
      const jsCode = await res.text();

      expect(jsCode).toContain("export default function GardenApp()");
      expect(jsCode).toContain("Garden JSX");
      expect(res.headers.get("Content-Type")).toContain(
        "application/javascript",
      );
    });
  });
});
