import console from "console";
import { beforeEach, describe, expect, it, vi } from "vitest";
import renderApp from "@vibes.diy/hosting";
import { expectCatalogTitle, expectAppInstance } from "@vibes.diy/hosting";

// Mock the createKey function to return a successful result
vi.mock("../src/endpoints/keyLib", () => ({
  createKey: vi.fn().mockResolvedValue({
    success: true,
    key: {
      key: "test-api-key-123",
      id: "test-key-id",
      name: "Test Key",
      label: "test-label",
    },
  }),
}));

describe("Custom Domain E2E Tests", () => {
  // Mock KV storage
  const kvStore = new Map<string, any>();

  // Mock environment
  const mockEnv = {
    KV: {
      get: async (key: string, type?: string) => {
        const value = kvStore.get(key);
        if (!value) return null;
        if (type === "arrayBuffer") {
          // Return a simple buffer for screenshot tests
          return new ArrayBuffer(100);
        }
        return value;
      },
      put: async (key: string, value: any) => {
        kvStore.set(key, value);
      },
      delete: async (key: string) => {
        kvStore.delete(key);
      },
    },
    SERVER_OPENROUTER_PROV_KEY: "test-provisioning-key",
  };

  beforeEach(() => {
    kvStore.clear();
  });

  describe("Custom Domain Resolution", () => {
    it("should resolve custom domain to correct app", async () => {
      // Set up test app
      const testApp = {
        name: "Test App",
        slug: "test-app-123",
        code: "export default function App() { return <div>Hello Custom Domain</div> }",
        title: "Custom Domain Test App",
        customDomain: "example.com",
      };

      // Store app and domain mapping
      kvStore.set("test-app-123", JSON.stringify(testApp));
      kvStore.set("domain:example.com", "test-app-123");

      const res = await renderApp.request("https://example.com/", {}, mockEnv);

      expect(res.status).toBe(200);
      const html = await res.text();
      // Custom domain serves app instance directly
      expect(html).toContain("Hello Custom Domain");
      expect(html).toContain("ReactDOMClient");
      expect(html).toContain("container");
      expect(html).toContain("<title>Custom Domain Test App</title>");
    });

    it("should resolve subdomain to correct app", async () => {
      // Set up test app
      const testApp = {
        name: "Test App",
        slug: "test-app-123",
        code: "export default function App() { return <div>Hello Subdomain</div> }",
        title: "Subdomain Test App",
      };

      kvStore.set("test-app-123", JSON.stringify(testApp));

      const res = await renderApp.request(
        "https://test-app-123.vibesdiy.app/",
        {},
        mockEnv,
      );

      expect(res.status).toBe(200);
      const html = await res.text();
      // Subdomain without underscore shows catalog title page
      expect(html).toContain("Subdomain Test App");
      expect(html).toContain("catalog-container");
      expect(html).toContain("Install");
      expect(html).toContain("<title>Subdomain Test App - Vibes DIY</title>");
    });

    it("should resolve app instance with underscore to app code", async () => {
      // Set up test app
      const testApp = {
        name: "Test App",
        slug: "test-app-instance",
        code: "export default function App() { return <div>Hello App Instance</div> }",
        title: "Instance Test App",
      };

      kvStore.set("test-app-instance", JSON.stringify(testApp));

      // Test with underscore (app instance)
      const res = await renderApp.request(
        "https://test-app-instance_abc123.vibesdiy.app/",
        {},
        mockEnv,
      );

      expect(res.status).toBe(200);
      const html = await res.text();
      // Subdomain with underscore shows actual app instance
      expect(html).toContain("Hello App Instance");
      expect(html).toContain("ReactDOMClient");
      expect(html).toContain("container");
      expect(html).not.toContain("catalog-container");
      expect(html).not.toContain("Install");
    });

    it("should return not found for unmapped custom domain", async () => {
      const res = await renderApp.request("https://unmapped.com/", {}, mockEnv);

      expect(res.status).toBe(404);
    });

    it("should redirect apex domains", async () => {
      const apexDomains = [
        "vibesdiy.app",
        "vibecode.garden",
        "www.vibesdiy.app",
      ];

      for (const domain of apexDomains) {
        const res = await renderApp.request(`https://${domain}/`, {}, mockEnv);

        expect(res.status).toBe(301);
        expect(res.headers.get("location")).toBe("https://vibes.diy");
      }
    });

    it("should handle same app accessible via both custom domain and subdomain", async () => {
      const app = {
        name: "Dual Access",
        slug: "dual-access",
        code: "export default function App() { return <div>Dual Access App</div> }",
        title: "Dual Access Test",
        customDomain: "dual.com",
      };

      kvStore.set("dual-access", JSON.stringify(app));
      kvStore.set("domain:dual.com", "dual-access");

      // Test custom domain access (app instance page)
      const customRes = await renderApp.request(
        "https://dual.com/",
        {},
        mockEnv,
      );
      expect(customRes.status).toBe(200);
      const customHtml = await customRes.text();
      expect(customHtml).toContain("Dual Access App");
      expect(customHtml).toContain("ReactDOMClient");
      expect(customHtml).not.toContain("catalog-container");
      expect(customHtml).toContain("<title>Dual Access Test</title>");

      // Test subdomain access (catalog title page)
      const subdomainRes = await renderApp.request(
        "https://dual-access.vibesdiy.app/",
        {},
        mockEnv,
      );
      expect(subdomainRes.status).toBe(200);
      const subdomainHtml = await subdomainRes.text();
      expect(subdomainHtml).toContain("Dual Access Test");
      expect(subdomainHtml).toContain("catalog-container");
      expect(subdomainHtml).toContain(
        "<title>Dual Access Test - Vibes DIY</title>",
      );

      // Custom domain shows app instance, subdomain shows catalog
      expect(customHtml).toContain("ReactDOMClient"); // App instance marker
      expect(subdomainHtml).toContain("Install");
    });

    it("should serve different apps on different custom domains", async () => {
      // Set up first app
      const app1 = {
        name: "App One",
        slug: "app-one",
        code: "export default function App() { return <div>App One</div> }",
        title: "First App",
        customDomain: "first.com",
      };

      kvStore.set("app-one", JSON.stringify(app1));
      kvStore.set("domain:first.com", "app-one");

      // Set up second app
      const app2 = {
        name: "App Two",
        slug: "app-two",
        code: "export default function App() { return <div>App Two</div> }",
        title: "Second App",
        customDomain: "second.com",
      };

      kvStore.set("app-two", JSON.stringify(app2));
      kvStore.set("domain:second.com", "app-two");

      // Test first domain (app instance page)
      const res1 = await renderApp.request("https://first.com/", {}, mockEnv);
      expect(res1.status).toBe(200);
      const html1 = await res1.text();
      expect(html1).toContain("App One");
      expect(html1).toContain("ReactDOMClient");
      expect(html1).not.toContain("catalog-container");
      expect(html1).toContain("<title>First App</title>");

      // Test second domain (app instance page)
      const res2 = await renderApp.request("https://second.com/", {}, mockEnv);
      expect(res2.status).toBe(200);
      const html2 = await res2.text();
      expect(html2).toContain("App Two");
      expect(html2).toContain("ReactDOMClient");
      expect(html2).not.toContain("catalog-container");
      expect(html2).toContain("<title>Second App</title>");

      // Should be different apps
      expect(html1).not.toContain("Second App");
      expect(html2).not.toContain("First App");
    });
  });

  describe("Domain Mapping Management", () => {
    it("should handle domain mapping updates", async () => {
      const app = {
        name: "Update Test",
        slug: "update-test",
        code: "export default function App() { return <div>Update Test</div> }",
        title: "Update Test App",
        customDomain: "old-domain.com",
      };

      // Initial setup
      kvStore.set("update-test", JSON.stringify(app));
      kvStore.set("domain:old-domain.com", "update-test");

      // Verify old domain works
      let res = await renderApp.request("https://old-domain.com/", {}, mockEnv);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("Update Test");

      // Simulate domain update (remove old, add new)
      kvStore.delete("domain:old-domain.com");
      kvStore.set("domain:new-domain.com", "update-test");

      // Update app object
      app.customDomain = "new-domain.com";
      kvStore.set("update-test", JSON.stringify(app));

      // Verify new domain works
      res = await renderApp.request("https://new-domain.com/", {}, mockEnv);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Update Test");

      // Verify old domain no longer works
      res = await renderApp.request("https://old-domain.com/", {}, mockEnv);
      expect(res.status).toBe(404);
    });

    it("should handle domain removal", async () => {
      const app: any = {
        name: "Remove Test",
        slug: "remove-test",
        code: "export default function App() { return <div>Remove Test</div> }",
        title: "Remove Test App",
        customDomain: "remove-domain.com",
      };

      // Initial setup
      kvStore.set("remove-test", JSON.stringify(app));
      kvStore.set("domain:remove-domain.com", "remove-test");

      // Verify domain works
      let res = await renderApp.request(
        "https://remove-domain.com/",
        {},
        mockEnv,
      );
      expect(res.status).toBe(200);

      // Remove domain mapping
      kvStore.delete("domain:remove-domain.com");
      delete app.customDomain;
      kvStore.set("remove-test", JSON.stringify(app));

      // Verify domain no longer works
      res = await renderApp.request("https://remove-domain.com/", {}, mockEnv);
      expect(res.status).toBe(404);

      // But subdomain should still work
      res = await renderApp.request(
        "https://remove-test.vibesdiy.app/",
        {},
        mockEnv,
      );
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Remove Test");
      expect(html).toContain("catalog-container");
    });
  });

  describe("Edge Cases", () => {
    it("should handle malformed hostnames gracefully", async () => {
      const res = await renderApp.request("https://./", {}, mockEnv);
      expect(res.status).toBe(301); // Redirects to vibes.diy for invalid subdomains
    });

    it("should handle very long hostnames", async () => {
      const longHostname = "a".repeat(253) + ".com"; // Max DNS hostname length
      const res = await renderApp.request(
        `https://${longHostname}/`,
        {},
        mockEnv,
      );
      expect(res.status).toBe(301); // Invalid subdomains redirect to vibes.diy
      expect(res.headers.get("location")).toBe("https://vibes.diy");
    });

    it("should handle numeric subdomains", async () => {
      const app = {
        name: "Numeric App",
        slug: "12345",
        code: "export default function App() { return <div>Numeric</div> }",
        title: "Numeric App",
      };

      kvStore.set("12345", JSON.stringify(app));

      const res = await renderApp.request(
        "https://12345.vibesdiy.app/",
        {},
        mockEnv,
      );
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Numeric App");
      expect(html).toContain("catalog-container");
    });

    it("should handle domains with multiple dots", async () => {
      const app = {
        name: "Subdomain App",
        slug: "sub-app",
        code: "export default function App() { return <div>Sub</div> }",
        title: "Subdomain App",
        customDomain: "app.subdomain.example.com",
      };

      kvStore.set("sub-app", JSON.stringify(app));
      kvStore.set("domain:app.subdomain.example.com", "sub-app");

      const res = await renderApp.request(
        "https://app.subdomain.example.com/",
        {},
        mockEnv,
      );
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Sub");
      expect(html).toContain("ReactDOMClient");
      expect(html).not.toContain("catalog-container");
    });
  });
});
