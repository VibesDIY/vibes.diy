import { describe, expect, it } from "vitest";
import worker from "./__mocks__/worker";

describe("CORS and Security Headers", () => {
  describe("CORS headers", () => {
    it("should allow all origins for root route", async () => {
      const request = new Request("https://vibesbox.dev/");
      const response = await worker.fetch(request);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "GET",
      );
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "OPTIONS",
      );
    });

    it("should handle OPTIONS preflight requests", async () => {
      const request = new Request("https://vibesbox.dev/", {
        method: "OPTIONS",
      });
      const response = await worker.fetch(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("should allow cross-origin requests from any domain", async () => {
      const origins = [
        "https://vibes.diy",
        "http://localhost:3000",
        "https://example.com",
      ];

      for (const origin of origins) {
        const request = new Request("https://vibesbox.dev/", {
          headers: {
            Origin: origin,
          },
        });
        const response = await worker.fetch(request);

        expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      }
    });
  });

  describe("Frame options", () => {
    it("should allow embedding in any iframe", async () => {
      const request = new Request("https://vibesbox.dev/");
      const response = await worker.fetch(request);

      expect(response.headers.get("X-Frame-Options")).toBe("ALLOWALL");
    });

    it("should allow framing for vibe routes", async () => {
      const request = new Request("https://vibesbox.dev/vibe/test");
      const response = await worker.fetch(request);

      // Wrapper pages don't need ALLOWALL since they contain iframes
      const xFrameOptions = response.headers.get("X-Frame-Options");
      expect(xFrameOptions).toBeNull(); // No restriction on wrapper
    });

    it("should allow framing for lab routes", async () => {
      const request = new Request("https://vibesbox.dev/lab/test");
      const response = await worker.fetch(request);

      const xFrameOptions = response.headers.get("X-Frame-Options");
      expect(xFrameOptions).toBeNull(); // No restriction on lab
    });
  });

  describe("Cache control headers", () => {
    it("should cache static iframe content", async () => {
      const request = new Request("https://vibesbox.dev/");
      const response = await worker.fetch(request);

      const cacheControl = response.headers.get("Cache-Control");
      expect(cacheControl).toContain("public");
      expect(cacheControl).toContain("max-age=3600"); // 1 hour
    });

    it("should have shorter cache for dynamic vibe content", async () => {
      const request = new Request("https://vibesbox.dev/vibe/test");
      const response = await worker.fetch(request);

      const cacheControl = response.headers.get("Cache-Control");
      expect(cacheControl).toContain("public");
      expect(cacheControl).toContain("max-age=300"); // 5 minutes
    });

    it("should have shorter cache for lab content", async () => {
      const request = new Request("https://vibesbox.dev/lab/test");
      const response = await worker.fetch(request);

      const cacheControl = response.headers.get("Cache-Control");
      expect(cacheControl).toContain("public");
      expect(cacheControl).toContain("max-age=300"); // 5 minutes
    });
  });

  describe("Content-Type headers", () => {
    it("should return HTML content type for all routes", async () => {
      const routes = ["/", "/vibe/test", "/lab/test"];

      for (const route of routes) {
        const request = new Request(`https://vibesbox.dev${route}`);
        const response = await worker.fetch(request);

        expect(response.headers.get("Content-Type")).toBe("text/html");
      }
    });
  });

  describe("HTTP methods", () => {
    it("should handle GET requests", async () => {
      const request = new Request("https://vibesbox.dev/", {
        method: "GET",
      });
      const response = await worker.fetch(request);

      expect(response.status).toBe(200);
    });

    it("should handle HEAD requests", async () => {
      const request = new Request("https://vibesbox.dev/", {
        method: "HEAD",
      });
      const response = await worker.fetch(request);

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toBe(""); // HEAD should not return body
    });

    it("should handle unsupported methods gracefully", async () => {
      const unsupportedMethods = ["POST", "PUT", "DELETE", "PATCH"];

      for (const method of unsupportedMethods) {
        const request = new Request("https://vibesbox.dev/", {
          method: method,
        });
        const response = await worker.fetch(request);

        // Should still respond (worker doesn't explicitly reject these)
        expect(response.status).toBe(200);
      }
    });
  });

  describe("Security considerations", () => {
    it("should not expose sensitive headers", async () => {
      const request = new Request("https://vibesbox.dev/");
      const response = await worker.fetch(request);

      // Should not expose server information
      expect(response.headers.get("Server")).toBeNull();
      expect(response.headers.get("X-Powered-By")).toBeNull();
    });

    it("should handle malformed URLs gracefully", async () => {
      const malformedUrls = [
        "https://vibesbox.dev/../etc/passwd",
        "https://vibesbox.dev/vibe/%2E%2E%2F",
        "https://vibesbox.dev/vibe/../../",
        "https://vibesbox.dev/vibe/<script>alert(1)</script>",
      ];

      for (const url of malformedUrls) {
        const request = new Request(url);
        const response = await worker.fetch(request);

        expect(response.status).toBe(200);
        const html = await response.text();
        // Should not execute or expose anything dangerous
        expect(html).toContain("<!doctype html>");
      }
    });

    it("should sanitize slug values in HTML", async () => {
      const dangerousSlugs = [
        "<script>alert('xss')</script>",
        "';alert('xss');//",
        '"><img src=x onerror=alert(1)>',
      ];

      for (const slug of dangerousSlugs) {
        const request = new Request(
          `https://vibesbox.dev/vibe/${encodeURIComponent(slug)}`,
        );
        const response = await worker.fetch(request);
        const html = await response.text();

        // Should escape or encode dangerous content
        expect(html).not.toContain("<script>alert");
        expect(html).not.toContain("onerror=");
      }
    });
  });

  describe("Response status codes", () => {
    it("should return 200 for valid routes", async () => {
      const validRoutes = ["/", "/vibe/test", "/lab/test", "/vibe/", "/lab/"];

      for (const route of validRoutes) {
        const request = new Request(`https://vibesbox.dev${route}`);
        const response = await worker.fetch(request);

        expect(response.status).toBe(200);
        expect(response.statusText).toBe("OK");
      }
    });

    it("should handle query parameters", async () => {
      const request = new Request(
        "https://vibesbox.dev/?v_fp=0.22.0&other=param",
      );
      const response = await worker.fetch(request);

      expect(response.status).toBe(200);
    });
  });
});
