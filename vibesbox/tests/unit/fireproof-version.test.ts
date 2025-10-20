import { describe, expect, it } from "vitest";
import worker from "./__mocks__/worker";

describe("Fireproof Version Parameter", () => {
  // Helper to create request with version parameter
  const createRequestWithVersion = (version?: string) => {
    const url = new URL("https://vibesbox.dev/");
    if (version) {
      url.searchParams.set("v_fp", version);
    }
    return new Request(url.toString());
  };

  // Helper to extract Fireproof version from HTML
  const extractFireproofVersion = (html: string): string | null => {
    // Look for the use-fireproof import in the import map
    const importMapMatch = html.match(
      /<script type="importmap">([\s\S]*?)<\/script>/,
    );
    if (!importMapMatch) return null;

    try {
      const importMap = JSON.parse(importMapMatch[1]);
      const fireproofUrl = importMap?.imports?.["use-fireproof"];
      if (!fireproofUrl) return null;

      // Extract version from URL like https://esm.sh/use-fireproof@0.23.14
      const versionMatch = fireproofUrl.match(
        /@([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)/,
      );
      return versionMatch ? versionMatch[1] : null;
    } catch {
      return null;
    }
  };

  describe("Default version", () => {
    it("should use default version when no parameter provided", async () => {
      const request = createRequestWithVersion();
      const response = await worker.fetch(request);
      const html = await response.text();

      // Should contain Fireproof import
      expect(html).toContain("use-fireproof");

      // Extract and verify version
      const version = extractFireproofVersion(html);
      expect(version).toBeTruthy();
      expect(version).toMatch(/^[0-9]+\.[0-9]+\.[0-9]+/); // Valid semver
    });
  });

  describe("Custom version parameter", () => {
    it("should use custom version when valid semver provided", async () => {
      const request = createRequestWithVersion("0.22.0");
      const response = await worker.fetch(request);
      const html = await response.text();

      const version = extractFireproofVersion(html);
      expect(version).toBe("0.22.0");
    });

    it("should handle prerelease versions", async () => {
      const request = createRequestWithVersion("0.24.0-beta");
      const response = await worker.fetch(request);
      const html = await response.text();

      const version = extractFireproofVersion(html);
      expect(version).toBe("0.24.0-beta");
    });

    it("should handle versions with build metadata", async () => {
      const request = createRequestWithVersion("1.0.0+build123");
      const response = await worker.fetch(request);
      const html = await response.text();

      const version = extractFireproofVersion(html);
      expect(version).toBe("1.0.0+build123");
    });
  });

  describe("Invalid version handling", () => {
    it("should fall back to default for invalid version", async () => {
      const request = createRequestWithVersion("invalid");
      const response = await worker.fetch(request);
      const html = await response.text();

      const version = extractFireproofVersion(html);
      expect(version).toBeTruthy();
      expect(version).not.toBe("invalid");
      expect(version).toMatch(/^[0-9]+\.[0-9]+\.[0-9]+/); // Valid semver
    });

    it("should fall back to default for malformed version", async () => {
      const request = createRequestWithVersion("1.2");
      const response = await worker.fetch(request);
      const html = await response.text();

      const version = extractFireproofVersion(html);
      expect(version).toBeTruthy();
      expect(version).not.toBe("1.2");
    });

    it("should handle empty version parameter", async () => {
      const request = createRequestWithVersion("");
      const response = await worker.fetch(request);
      const html = await response.text();

      const version = extractFireproofVersion(html);
      expect(version).toBeTruthy();
      expect(version).toMatch(/^[0-9]+\.[0-9]+\.[0-9]+/);
    });
  });

  describe("Version forwarding in wrapper", () => {
    it("should forward version parameter to iframe src", async () => {
      const url = new URL("https://vibesbox.dev/vibe/test-slug");
      url.searchParams.set("v_fp", "0.21.0");
      const request = new Request(url.toString());

      const response = await worker.fetch(request);
      const html = await response.text();

      // Check that iframe src includes the version parameter
      expect(html).toContain("v_fp=0.21.0");
    });

    it("should not include version param in iframe src when using default", async () => {
      const request = new Request("https://vibesbox.dev/vibe/test-slug");
      const response = await worker.fetch(request);
      const html = await response.text();

      // When using default, iframe src should be just "/"
      const iframeSrcMatch = html.match(/iframeSrc\s*=\s*['"]([^'"]+)['"]/);
      expect(iframeSrcMatch).toBeTruthy();
      expect(iframeSrcMatch![1]).toBe("/");
    });
  });

  describe("Semver validation", () => {
    const validVersions = [
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

        const extractedVersion = extractFireproofVersion(html);
        expect(extractedVersion).toBe(version);
      });
    });

    const invalidVersions = [
      "1",
      "1.2",
      "1.2.3.4",
      "01.2.3",
      "1.02.3",
      "1.2.03",
      "1.2-alpha",
      "v1.2.3",
    ];

    invalidVersions.forEach((version) => {
      it(`should reject invalid semver: ${version}`, async () => {
        const request = createRequestWithVersion(version);
        const response = await worker.fetch(request);
        const html = await response.text();

        const extractedVersion = extractFireproofVersion(html);
        expect(extractedVersion).not.toBe(version);
        expect(extractedVersion).toMatch(/^[0-9]+\.[0-9]+\.[0-9]+/); // Falls back to valid default
      });
    });
  });
});
