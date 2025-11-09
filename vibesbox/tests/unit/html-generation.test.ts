import { describe, expect, it } from "vitest";
import worker from "./__mocks__/worker";

describe("HTML Generation", () => {
  describe("iframe.html template", () => {
    it("should contain required scripts and styles", async () => {
      const request = new Request("https://vibesbox.dev/");
      const response = await worker.fetch(request);
      const html = await response.text();

      // Check for essential scripts
      expect(html).toContain("@babel/standalone");
      expect(html).toContain("tailwindcss");
      expect(html).toContain("html2canvas");

      // Check for use-vibes CSS
      expect(html).toContain("use-vibes");

      // Check for container element
      expect(html).toContain('id="container"');
    });

    it("should have fetch interceptor for streaming", async () => {
      const request = new Request("https://vibesbox.dev/");
      const response = await worker.fetch(request);
      const html = await response.text();

      // Check for streaming state management
      expect(html).toContain("activeRequests");
      expect(html).toContain("updateStreamingState");
      expect(html).toContain("window.fetch");
    });

    it("should have postMessage communication setup", async () => {
      const request = new Request("https://vibesbox.dev/");
      const response = await worker.fetch(request);
      const html = await response.text();

      expect(html).toContain('window.addEventListener("message"');
      expect(html).toContain("execute-code");
      expect(html).toContain("postMessage");
    });

    it("should include import map for dependencies", async () => {
      const request = new Request("https://vibesbox.dev/");
      const response = await worker.fetch(request);
      const html = await response.text();

      expect(html).toContain('<script type="importmap">');
      expect(html).toContain('"imports"');
      expect(html).toContain("use-fireproof");
      expect(html).toContain("react");
      expect(html).toContain("react-dom");
    });
  });

  describe("wrapper.html template", () => {
    it("should contain slug placeholder replacement", async () => {
      const request = new Request("https://vibesbox.dev/vibe/my-test-slug");
      const response = await worker.fetch(request);
      const html = await response.text();

      expect(html).toContain("my-test-slug");
      expect(html).not.toContain("{{slug}}"); // Placeholder should be replaced
    });

    it("should contain origin replacement", async () => {
      const request = new Request("https://vibesbox.dev/vibe/test");
      const response = await worker.fetch(request);
      const html = await response.text();

      expect(html).toContain("https://vibesbox.dev");
      expect(html).not.toContain("{{origin}}"); // Placeholder should be replaced
    });

    it("should have iframe with correct ID", async () => {
      const request = new Request("https://vibesbox.dev/vibe/test");
      const response = await worker.fetch(request);
      const html = await response.text();

      expect(html).toContain('id="vibeFrame"');
      expect(html).toContain("<iframe");
    });

    it("should have loading indicator", async () => {
      const request = new Request("https://vibesbox.dev/vibe/test");
      const response = await worker.fetch(request);
      const html = await response.text();

      expect(html).toContain('id="loading"');
      expect(html).toContain("Loading");
    });

    it("should handle postMessage communication", async () => {
      const request = new Request("https://vibesbox.dev/vibe/test");
      const response = await worker.fetch(request);
      const html = await response.text();

      // Wrapper should set up forwarding from parent to inner iframe
      expect(html).toContain("setupForwarding");
      expect(html).toContain("iframe.contentWindow.postMessage");
      expect(html).toContain("execute-code");
    });
  });

  describe("lab.html template", () => {
    it("should contain multiple iframe containers", async () => {
      const request = new Request("https://vibesbox.dev/lab/lab-test");
      const response = await worker.fetch(request);
      const html = await response.text();

      // Lab page should have multiple iframes for testing
      expect(html).toContain("iframe-container");
      expect(html).toContain("Lab");
    });

    it("should have debug controls", async () => {
      const request = new Request("https://vibesbox.dev/lab/test");
      const response = await worker.fetch(request);
      const html = await response.text();

      expect(html).toContain("debugMaster");
      expect(html).toContain("debugValue");
    });

    it("should have session controls", async () => {
      const request = new Request("https://vibesbox.dev/lab/test");
      const response = await worker.fetch(request);
      const html = await response.text();

      expect(html).toContain("sessionSelect");
      expect(html).toContain("vibeSlug");
    });

    it("should have localhost controls", async () => {
      const request = new Request("https://vibesbox.dev/lab/test");
      const response = await worker.fetch(request);
      const html = await response.text();

      expect(html).toContain("localhostControls");
      expect(html).toContain("useLocalhost");
      expect(html).toContain("localhost:8989");
    });

    it("should replace slug placeholder", async () => {
      const request = new Request(
        "https://custom.vibesbox.dev/lab/custom-slug",
      );
      const response = await worker.fetch(request);
      const html = await response.text();

      expect(html).toContain("custom-slug");
      expect(html).not.toContain("{{slug}}");
    });
  });

  describe("Template placeholder replacement", () => {
    it("should handle different origins correctly", async () => {
      const origins = [
        "https://vibesbox.dev",
        "https://app.vibesbox.dev",
        "http://localhost:8989",
      ];

      for (const origin of origins) {
        const url = new URL(`${origin}/vibe/test`);
        const request = new Request(url.toString());
        const response = await worker.fetch(request);
        const html = await response.text();

        expect(html).toContain(origin);
      }
    });

    it("should handle special characters in slug", async () => {
      const slugs = ["test-123", "test_456", "test.789", "TEST-UPPER"];

      for (const slug of slugs) {
        const request = new Request(`https://vibesbox.dev/vibe/${slug}`);
        const response = await worker.fetch(request);
        const html = await response.text();

        expect(html).toContain(slug);
      }
    });
  });

  describe("HTML validation", () => {
    it("should return valid HTML5 document", async () => {
      const request = new Request("https://vibesbox.dev/");
      const response = await worker.fetch(request);
      const html = await response.text();

      expect(html).toMatch(/^<!doctype html>/i);
      expect(html).toContain("<html");
      expect(html).toContain("</html>");
      expect(html).toContain("<head");
      expect(html).toContain("</head>");
      expect(html).toContain("<body");
      expect(html).toContain("</body>");
    });

    it("should have proper meta tags", async () => {
      const request = new Request("https://vibesbox.dev/");
      const response = await worker.fetch(request);
      const html = await response.text();

      expect(html).toContain('<meta charset="utf-8"');
      expect(html).toContain('<meta name="viewport"');
      expect(html).toContain("<title>");
    });
  });
});
