import { describe, expect, it } from "vitest";
import worker from "./__mocks__/worker";

describe("Vibesbox Routing", () => {
  // Helper to create mock request
  const createRequest = (path: string, params?: Record<string, string>) => {
    const url = new URL(`https://vibesbox.dev${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    return new Request(url.toString());
  };

  describe("Root route", () => {
    it("should return iframe.html for root path", async () => {
      const request = createRequest("/");
      const response = await worker.fetch(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/html");

      const html = await response.text();
      expect(html).toContain("<!doctype html>");
      expect(html).toContain("vibesbox");
      expect(html).toContain("container");
    });

    it("should have correct CORS headers", async () => {
      const request = createRequest("/");
      const response = await worker.fetch(request);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("X-Frame-Options")).toBe("ALLOWALL");
      expect(response.headers.get("Cache-Control")).toContain("public");
    });
  });

  describe("/vibe/{slug} route", () => {
    it("should return wrapper.html with slug replacement", async () => {
      const request = createRequest("/vibe/test-slug-123");
      const response = await worker.fetch(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/html");

      const html = await response.text();
      expect(html).toContain("test-slug-123");
      expect(html).toContain("vibeFrame");
      expect(html).toContain("postMessage");
    });

    it("should use default slug when none provided", async () => {
      const request = createRequest("/vibe");
      const response = await worker.fetch(request);

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("quick-cello-8104"); // Default slug
    });

    it("should have shorter cache for dynamic content", async () => {
      const request = createRequest("/vibe/my-app");
      const response = await worker.fetch(request);

      expect(response.headers.get("Cache-Control")).toContain("max-age=300");
    });
  });

  describe("/lab/{slug} route", () => {
    it("should return lab.html with slug replacement", async () => {
      const request = createRequest("/lab/lab-test-456");
      const response = await worker.fetch(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/html");

      const html = await response.text();
      expect(html).toContain("lab-test-456");
      expect(html).toContain("Lab");
      expect(html).toContain("iframe-container");
    });

    it("should use default slug when none provided", async () => {
      const request = createRequest("/lab");
      const response = await worker.fetch(request);

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("quick-cello-8104"); // Default slug
    });
  });

  describe("URL path parsing", () => {
    it("should handle trailing slashes", async () => {
      const request = createRequest("/vibe/my-slug/");
      const response = await worker.fetch(request);

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("my-slug");
    });

    it("should handle subdomain requests", async () => {
      const request = new Request("https://app.vibesbox.dev/");
      const response = await worker.fetch(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/html");
    });
  });
});
