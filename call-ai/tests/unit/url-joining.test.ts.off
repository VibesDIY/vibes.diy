import { describe, test, expect } from "vitest";
import { joinUrlParts } from "../../pkg/utils.js";

describe("URL joining utility", () => {
  test("handles base URL with trailing slash", () => {
    const result = joinUrlParts("https://vibes-diy-api.com/", "/api/v1/chat/completions");
    expect(result).toBe("https://vibes-diy-api.com/api/v1/chat/completions");
  });

  test("handles base URL without trailing slash", () => {
    const result = joinUrlParts("https://vibes-diy-api.com", "/api/v1/chat/completions");
    expect(result).toBe("https://vibes-diy-api.com/api/v1/chat/completions");
  });

  test("handles path without leading slash", () => {
    const result = joinUrlParts("https://vibes-diy-api.com/", "api/v1/chat/completions");
    expect(result).toBe("https://vibes-diy-api.com/api/v1/chat/completions");
  });

  test("handles both without slashes", () => {
    const result = joinUrlParts("https://vibes-diy-api.com", "api/v1/chat/completions");
    expect(result).toBe("https://vibes-diy-api.com/api/v1/chat/completions");
  });

  test("handles empty base URL", () => {
    const result = joinUrlParts("", "/api/v1/chat/completions");
    expect(result).toBe("/api/v1/chat/completions");
  });

  test("handles empty path", () => {
    const result = joinUrlParts("https://vibes-diy-api.com/", "");
    expect(result).toBe("https://vibes-diy-api.com/");
  });

  test("prevents double slashes in the problematic case", () => {
    // This is the specific case mentioned in the issue
    const result = joinUrlParts("https://vibes-diy-api.com/", "/api/v1/chat/completions");
    expect(result).not.toContain("//api");
    expect(result).toBe("https://vibes-diy-api.com/api/v1/chat/completions");
  });
});
