import { describe, it, expect } from "vitest";
import { handleRequest, parseBackends } from "./index.ts";
import type { StableEntryCtx } from "./index.ts";

const CTX_WITH_BACKENDS: StableEntryCtx = {
  backends: { dev: "https://dev-v2.vibesdiy.net", staging: "https://staging.vibesdiy.net" },
  backend: "https://vibes.diy",
};

const CTX_NO_BACKENDS: StableEntryCtx = {
  backends: null,
  backend: "https://vibes.diy",
};

describe("parseBackends", () => {
  it("returns null for undefined", () => {
    expect(parseBackends()).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseBackends("")).toBeNull();
  });

  it("parses valid JSON", () => {
    const result = parseBackends('{"dev":"https://dev.example.com/"}');
    expect(result).toEqual({ dev: "https://dev.example.com" });
  });

  it("returns null for invalid JSON", () => {
    expect(parseBackends("not json")).toBeNull();
  });

  it("returns null for non-object JSON", () => {
    expect(parseBackends("[1,2,3]")).toBeNull();
  });

  it("returns null for invalid key", () => {
    expect(parseBackends('{"UPPER":"https://example.com"}')).toBeNull();
  });

  it("returns null for key with spaces", () => {
    expect(parseBackends('{"bad key":"https://example.com"}')).toBeNull();
  });

  it("allows dashes and underscores in keys", () => {
    const result = parseBackends('{"dev-v2":"https://dev.example.com","my_staging":"https://staging.example.com"}');
    expect(result).toEqual({
      "dev-v2": "https://dev.example.com",
      my_staging: "https://staging.example.com",
    });
  });

  it("normalizes backend URLs", () => {
    const result = parseBackends('{"dev":"https://example.com/"}');
    expect(result).toEqual({ dev: "https://example.com" });
  });
});

describe("handleRequest", () => {
  it("returns config with keys for options.json", () => {
    const url = new URL("https://vibes.diy/.stable-entry/options.json");
    const result = handleRequest(url, undefined, CTX_WITH_BACKENDS);
    expect(result).toEqual({ type: "config", keys: ["dev", "staging"] });
  });

  it("returns empty keys when no backends configured", () => {
    const url = new URL("https://vibes.diy/.stable-entry/options.json");
    const result = handleRequest(url, undefined, CTX_NO_BACKENDS);
    expect(result).toEqual({ type: "config", keys: [] });
  });

  it("sets backend cookie for valid _backend param", () => {
    const url = new URL("https://vibes.diy/some/page?_backend=dev");
    const result = handleRequest(url, undefined, CTX_WITH_BACKENDS);
    expect(result).toEqual({ type: "set-backend", key: "dev", redirect: "/some/page" });
  });

  it("clears backend cookie for empty _backend param", () => {
    const url = new URL("https://vibes.diy/?_backend=");
    const result = handleRequest(url, undefined, CTX_WITH_BACKENDS);
    expect(result).toEqual({ type: "clear-backend", redirect: "/" });
  });

  it("clears backend cookie for unknown _backend key", () => {
    const url = new URL("https://vibes.diy/?_backend=nonexistent");
    const result = handleRequest(url, undefined, CTX_WITH_BACKENDS);
    expect(result).toEqual({ type: "clear-backend", redirect: "/" });
  });

  it("strips _backend from redirect but preserves other params", () => {
    const url = new URL("https://vibes.diy/page?foo=bar&_backend=dev&baz=1");
    const result = handleRequest(url, undefined, CTX_WITH_BACKENDS);
    expect(result.type).toBe("set-backend");
    if (result.type === "set-backend") {
      expect(result.redirect).not.toContain("_backend");
      expect(result.redirect).toContain("foo=bar");
      expect(result.redirect).toContain("baz=1");
    }
  });

  it("proxies to cookie-selected backend", () => {
    const url = new URL("https://vibes.diy/some/path");
    const result = handleRequest(url, "dev", CTX_WITH_BACKENDS);
    expect(result).toEqual({ type: "proxy", targetUrl: "https://dev-v2.vibesdiy.net/some/path" });
  });

  it("proxies to default backend when no cookie", () => {
    const url = new URL("https://vibes.diy/some/path");
    const result = handleRequest(url, undefined, CTX_WITH_BACKENDS);
    expect(result).toEqual({ type: "proxy", targetUrl: "https://vibes.diy/some/path" });
  });

  it("proxies to default backend when cookie key is unknown", () => {
    const url = new URL("https://vibes.diy/");
    const result = handleRequest(url, "nonexistent", CTX_WITH_BACKENDS);
    expect(result).toEqual({ type: "proxy", targetUrl: "https://vibes.diy/" });
  });

  it("proxies to default backend when no backends configured", () => {
    const url = new URL("https://vibes.diy/path");
    const result = handleRequest(url, "dev", CTX_NO_BACKENDS);
    expect(result).toEqual({ type: "proxy", targetUrl: "https://vibes.diy/path" });
  });

  it("preserves query params in proxy URL", () => {
    const url = new URL("https://vibes.diy/path?foo=bar");
    const result = handleRequest(url, undefined, CTX_WITH_BACKENDS);
    expect(result).toEqual({ type: "proxy", targetUrl: "https://vibes.diy/path?foo=bar" });
  });
});
