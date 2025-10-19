import { describe, it, expect } from "vitest";
import {
  parseSubdomain,
  isValidSubdomain,
  generateInstallId,
  constructSubdomain,
  type ParsedSubdomain,
} from "@vibes.diy/hosting";

describe("Subdomain Parser", () => {
  describe("parseSubdomain", () => {
    it("should parse catalog title subdomain (no underscore)", () => {
      const result = parseSubdomain("my-app.vibesdiy.app");

      expect(result).toEqual({
        appSlug: "my-app",
        installId: undefined,
        isInstance: false,
        fullSubdomain: "my-app",
      });
    });

    it("should parse app instance subdomain (with underscore)", () => {
      const result = parseSubdomain("my-app_abc123.vibesdiy.app");

      expect(result).toEqual({
        appSlug: "my-app",
        installId: "abc123",
        isInstance: true,
        fullSubdomain: "my-app_abc123",
      });
    });

    it("should handle complex app slugs", () => {
      const result = parseSubdomain("weather-dashboard-v2.vibesdiy.app");

      expect(result.appSlug).toBe("weather-dashboard-v2");
      expect(result.isInstance).toBe(false);
    });

    it("should handle UUID install IDs", () => {
      const result = parseSubdomain(
        "todo-app_550e8400-e29b-41d4-a716-446655440000.vibesdiy.app",
      );

      expect(result.appSlug).toBe("todo-app");
      expect(result.installId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(result.isInstance).toBe(true);
    });

    it("should handle multiple underscores by treating them as part of install ID", () => {
      const result = parseSubdomain("my-app_user_special-id.vibesdiy.app");

      expect(result.appSlug).toBe("my-app");
      expect(result.installId).toBe("user_special-id");
      expect(result.isInstance).toBe(true);
    });

    it("should handle subdomains with numbers and hyphens", () => {
      const result = parseSubdomain("app-123_install-456.vibesdiy.app");

      expect(result.appSlug).toBe("app-123");
      expect(result.installId).toBe("install-456");
      expect(result.isInstance).toBe(true);
    });

    it("should work with different domain suffixes", () => {
      const result1 = parseSubdomain("my-app.vibesdiy.work");
      const result2 = parseSubdomain("my-app_123.custom-domain.com");

      expect(result1.appSlug).toBe("my-app");
      expect(result2.appSlug).toBe("my-app");
      expect(result2.installId).toBe("123");
    });

    it("should handle edge case of underscore at end", () => {
      const result = parseSubdomain("my-app_.vibesdiy.app");

      expect(result.appSlug).toBe("my-app");
      expect(result.installId).toBe("");
      expect(result.isInstance).toBe(true);
    });

    it("should parse new v-slug--installId format", () => {
      const result = parseSubdomain("v-my-app--abc123.vibesdiy.net");

      expect(result.appSlug).toBe("my-app");
      expect(result.installId).toBe("abc123");
      expect(result.isInstance).toBe(true);
      expect(result.fullSubdomain).toBe("v-my-app--abc123");
    });

    it("should parse new format with complex install ID", () => {
      const result = parseSubdomain(
        "v-weather-dashboard--550e8400-e29b-41d4-a716-446655440000.vibesdiy.net",
      );

      expect(result.appSlug).toBe("weather-dashboard");
      expect(result.installId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(result.isInstance).toBe(true);
    });

    it("should handle new format with multiple double dashes", () => {
      const result = parseSubdomain("v-my-app--test--more.vibesdiy.net");

      expect(result.appSlug).toBe("my-app");
      expect(result.installId).toBe("test--more");
      expect(result.isInstance).toBe(true);
    });

    it("should handle catalog title with v- prefix", () => {
      const result = parseSubdomain("v-my-app.vibesdiy.net");

      expect(result.appSlug).toBe("my-app");
      expect(result.installId).toBe(undefined);
      expect(result.isInstance).toBe(false);
      expect(result.fullSubdomain).toBe("v-my-app");
    });
  });

  describe("isValidSubdomain", () => {
    it("should validate correct catalog title subdomain", () => {
      const parsed: ParsedSubdomain = {
        appSlug: "my-app",
        installId: undefined,
        isInstance: false,
        fullSubdomain: "my-app",
      };

      expect(isValidSubdomain(parsed)).toBe(true);
    });

    it("should validate correct app instance subdomain", () => {
      const parsed: ParsedSubdomain = {
        appSlug: "my-app",
        installId: "abc123",
        isInstance: true,
        fullSubdomain: "my-app_abc123",
      };

      expect(isValidSubdomain(parsed)).toBe(true);
    });

    it("should reject empty app slug", () => {
      const parsed: ParsedSubdomain = {
        appSlug: "",
        installId: undefined,
        isInstance: false,
        fullSubdomain: "",
      };

      expect(isValidSubdomain(parsed)).toBe(false);
    });

    it("should reject whitespace-only app slug", () => {
      const parsed: ParsedSubdomain = {
        appSlug: "   ",
        installId: undefined,
        isInstance: false,
        fullSubdomain: "   ",
      };

      expect(isValidSubdomain(parsed)).toBe(false);
    });

    it("should reject instance with empty install ID", () => {
      const parsed: ParsedSubdomain = {
        appSlug: "my-app",
        installId: "",
        isInstance: true,
        fullSubdomain: "my-app_",
      };

      expect(isValidSubdomain(parsed)).toBe(false);
    });

    it("should reject instance with whitespace-only install ID", () => {
      const parsed: ParsedSubdomain = {
        appSlug: "my-app",
        installId: "   ",
        isInstance: true,
        fullSubdomain: "my-app_   ",
      };

      expect(isValidSubdomain(parsed)).toBe(false);
    });

    it("should reject reserved subdomain names", () => {
      const reservedNames = ["www", "api", "admin", "app"];

      reservedNames.forEach((name) => {
        const parsed: ParsedSubdomain = {
          appSlug: name,
          installId: undefined,
          isInstance: false,
          fullSubdomain: name,
        };

        expect(isValidSubdomain(parsed)).toBe(false);
      });
    });

    it("should reject reserved subdomain names case-insensitive", () => {
      const parsed: ParsedSubdomain = {
        appSlug: "WWW",
        installId: undefined,
        isInstance: false,
        fullSubdomain: "WWW",
      };

      expect(isValidSubdomain(parsed)).toBe(false);
    });
  });

  describe("generateInstallId", () => {
    it("should generate a 12-character alphanumeric ID", () => {
      const id = generateInstallId();

      // Should be exactly 12 characters, only alphanumeric
      expect(id).toHaveLength(12);
      expect(id).toMatch(/^[0-9a-z]+$/);
    });

    it("should generate unique IDs", () => {
      const id1 = generateInstallId();
      const id2 = generateInstallId();

      expect(id1).not.toBe(id2);
      expect(id1).toHaveLength(12);
      expect(id2).toHaveLength(12);
    });

    it("should generate multiple unique IDs in sequence", () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        const id = generateInstallId();
        expect(id).toHaveLength(12);
        expect(id).toMatch(/^[0-9a-z]+$/);
        ids.add(id);
      }

      expect(ids.size).toBe(100); // All should be unique
    });
  });

  describe("constructSubdomain", () => {
    it("should construct catalog title subdomain (no install ID)", () => {
      const result = constructSubdomain("my-app");

      expect(result).toBe("my-app");
    });

    it("should construct app instance subdomain (with install ID)", () => {
      const result = constructSubdomain("my-app", "abc123");

      expect(result).toBe("v-my-app--abc123");
    });

    it("should handle complex slugs and IDs", () => {
      const result = constructSubdomain(
        "weather-dashboard-v2",
        "550e8400-e29b-41d4-a716-446655440000",
      );

      expect(result).toBe(
        "v-weather-dashboard-v2--550e8400-e29b-41d4-a716-446655440000",
      );
    });

    it("should work with install IDs containing underscores", () => {
      const result = constructSubdomain("my-app", "user_special-id");

      expect(result).toBe("v-my-app--user_special-id");
    });

    it("should throw error for empty string install ID", () => {
      expect(() => constructSubdomain("my-app", "")).toThrow(
        "Install ID cannot be empty string - would create invalid subdomain",
      );
    });
  });

  describe("Round-trip parsing", () => {
    it("should parse and reconstruct catalog title correctly", () => {
      const original = "my-awesome-app";
      const parsed = parseSubdomain(`${original}.vibesdiy.app`);
      const reconstructed = constructSubdomain(
        parsed.appSlug,
        parsed.installId,
      );

      expect(reconstructed).toBe(original);
    });

    it("should parse legacy format and generate new format", () => {
      const original = "todo-app_abc-123";
      const parsed = parseSubdomain(`${original}.vibesdiy.app`);
      const reconstructed = constructSubdomain(
        parsed.appSlug,
        parsed.installId,
      );

      // Should parse correctly from old format
      expect(parsed.appSlug).toBe("todo-app");
      expect(parsed.installId).toBe("abc-123");
      expect(parsed.isInstance).toBe(true);

      // Should generate new format
      expect(reconstructed).toBe("v-todo-app--abc-123");
    });

    it("should handle complex parsing scenarios", () => {
      const testCases = [
        {
          input: "simple-app",
          expected: "simple-app",
          isInstance: false,
        },
        {
          input: "complex-app-name-v2",
          expected: "complex-app-name-v2",
          isInstance: false,
        },
        {
          input: "app_simple-id",
          expected: "v-app--simple-id",
          isInstance: true,
          appSlug: "app",
          installId: "simple-id",
        },
        {
          input: "app_550e8400-e29b-41d4-a716-446655440000",
          expected: "v-app--550e8400-e29b-41d4-a716-446655440000",
          isInstance: true,
          appSlug: "app",
          installId: "550e8400-e29b-41d4-a716-446655440000",
        },
        {
          input: "app_user_nested_id",
          expected: "v-app--user_nested_id",
          isInstance: true,
          appSlug: "app",
          installId: "user_nested_id",
        },
      ];

      testCases.forEach((testCase) => {
        const parsed = parseSubdomain(`${testCase.input}.vibesdiy.app`);
        const reconstructed = constructSubdomain(
          parsed.appSlug,
          parsed.installId,
        );

        expect(parsed.isInstance).toBe(testCase.isInstance);
        if (testCase.isInstance) {
          expect(parsed.appSlug).toBe(testCase.appSlug);
          expect(parsed.installId).toBe(testCase.installId);
        }
        expect(reconstructed).toBe(testCase.expected);
      });
    });
  });
});
