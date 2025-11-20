import { describe, expect, it } from "vitest";
import worker from "./__mocks__/worker";

describe("Vibes Version Parameter (v_vibes)", () => {
  // Helper to create request with version parameter
  const createRequestWithVersion = (version?: string) => {
    const url = new URL("https://vibesbox.dev/");
    if (version) {
      url.searchParams.set("v_vibes", version);
    }
    return new Request(url.toString());
  };

  describe("Default version", () => {
    it("should use default library import map when no parameter provided", async () => {
      const request = createRequestWithVersion();
      const response = await worker.fetch(request);
      const html = await response.text();

      // Should use default version range from library import map
      expect(html).toContain(
        '"use-vibes": "https://esm.sh/use-vibes@0.16.2"',
      );
      expect(html).toContain(
        '"use-fireproof": "https://esm.sh/use-vibes@0.16.2"',
      );
    });
  });

  describe("Custom version parameter", () => {
    it("should use custom version when valid semver provided", async () => {
      const request = createRequestWithVersion("0.22.0");
      const response = await worker.fetch(request);
      const html = await response.text();

      expect(html).toContain('"use-vibes": "https://esm.sh/use-vibes@0.22.0"');
      expect(html).toContain(
        '"use-fireproof": "https://esm.sh/use-vibes@0.22.0"',
      );
    });

    it("should handle prerelease versions", async () => {
      const request = createRequestWithVersion("0.24.0-beta");
      const response = await worker.fetch(request);
      const html = await response.text();

      expect(html).toContain(
        '"use-vibes": "https://esm.sh/use-vibes@0.24.0-beta"',
      );
      expect(html).toContain(
        '"use-fireproof": "https://esm.sh/use-vibes@0.24.0-beta"',
      );
    });

    it("should handle versions with build metadata", async () => {
      const request = createRequestWithVersion("1.0.0+build123");
      const response = await worker.fetch(request);
      const html = await response.text();

      expect(html).toContain(
        '"use-vibes": "https://esm.sh/use-vibes@1.0.0+build123"',
      );
      expect(html).toContain(
        '"use-fireproof": "https://esm.sh/use-vibes@1.0.0+build123"',
      );
    });
  });

  describe("Invalid version handling", () => {
    it("should fall back to default for invalid version", async () => {
      const request = createRequestWithVersion("invalid");
      const response = await worker.fetch(request);
      const html = await response.text();

      // Falls back to default library import map
      expect(html).toContain(
        '"use-vibes": "https://esm.sh/use-vibes@0.16.2"',
      );
      expect(html).toContain(
        '"use-fireproof": "https://esm.sh/use-vibes@0.16.2"',
      );
    });

    it("should accept major.minor versions", async () => {
      const request = createRequestWithVersion("1.2");
      const response = await worker.fetch(request);
      const html = await response.text();

      // Should accept 1.2 as valid (hosting pattern allows this)
      expect(html).toContain('"use-vibes": "https://esm.sh/use-vibes@1.2"');
      expect(html).toContain('"use-fireproof": "https://esm.sh/use-vibes@1.2"');
    });

    it("should handle empty version parameter", async () => {
      const request = createRequestWithVersion("");
      const response = await worker.fetch(request);
      const html = await response.text();

      // Falls back to default library import map
      expect(html).toContain(
        '"use-vibes": "https://esm.sh/use-vibes@0.16.2"',
      );
      expect(html).toContain(
        '"use-fireproof": "https://esm.sh/use-vibes@0.16.2"',
      );
    });
  });

  describe("Version forwarding in wrapper", () => {
    it("should forward version parameter to iframe src", async () => {
      const url = new URL("https://vibesbox.dev/vibe/test-slug");
      url.searchParams.set("v_vibes", "0.21.0");
      const request = new Request(url.toString());

      const response = await worker.fetch(request);
      const html = await response.text();

      // Check that iframe src includes the version parameter
      expect(html).toContain("v_vibes=0.21.0");
    });

    it("should not include version param in iframe src when using default", async () => {
      const request = new Request("https://vibesbox.dev/vibe/test-slug");
      const response = await worker.fetch(request);
      const html = await response.text();

      // When using default, iframe src should be just "/"
      const iframeSrcMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/);
      expect(iframeSrcMatch).toBeTruthy();
      expect(iframeSrcMatch![1]).toBe("/");
    });
  });

  describe("Semver validation", () => {
    const validVersions = [
      "1", // Major only (hosting pattern allows this)
      "1.2", // Major.minor (hosting pattern allows this)
      "0.0.0",
      "1.2.3",
      "10.20.30",
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-0.3.7",
      "1.0.0-x.7.z.92",
      "1.0.0+20130313144700",
      "1.0.0-beta+exp.sha.5114f85",
    ];

    validVersions.forEach((version) => {
      it(`should accept valid semver: ${version}`, async () => {
        const request = createRequestWithVersion(version);
        const response = await worker.fetch(request);
        const html = await response.text();

        expect(html).toContain(
          `"use-vibes": "https://esm.sh/use-vibes@${version}"`,
        );
        expect(html).toContain(
          `"use-fireproof": "https://esm.sh/use-vibes@${version}"`,
        );
      });
    });

    const invalidVersions = [
      "1.2.3.4", // Too many parts
      "v1.2.3", // Version prefix not allowed
      "invalid", // Not a version at all
    ];

    invalidVersions.forEach((version) => {
      it(`should reject invalid semver: ${version}`, async () => {
        const request = createRequestWithVersion(version);
        const response = await worker.fetch(request);
        const html = await response.text();

        // Falls back to default library import map
        expect(html).toContain(
          '"use-vibes": "https://esm.sh/use-vibes@0.16.2"',
        );
        expect(html).toContain(
          '"use-fireproof": "https://esm.sh/use-vibes@0.16.2"',
        );
      });
    });
  });
});
