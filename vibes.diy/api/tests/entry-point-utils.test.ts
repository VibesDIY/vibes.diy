import { describe, expect, it } from "vitest";
import { calcEntryPointUrl, extractHostToBindings } from "@vibes.diy/api-svc";

describe("entry-point-utils", () => {
  describe("calcEntryPointUrl", () => {
    const bindings = {
      appSlug: "myapp",
      userSlug: "myuser",
      fsId: "abc123",
    };

    it("builds URL from bindings with https", () => {
      const result = calcEntryPointUrl({
        hostnameBase: "vibes.app",
        protocol: "https",
        bindings,
      });
      expect(result).toBe("https://myapp--myuser.vibes.app/~abc123~/");
    });

    it("builds URL from bindings with http", () => {
      const result = calcEntryPointUrl({
        hostnameBase: "localhost:8080",
        protocol: "http",
        bindings,
      });
      expect(result).toBe("http://myapp--myuser.localhost:8080/~abc123~/");
    });

    it("handles different hostname bases", () => {
      const result = calcEntryPointUrl({
        hostnameBase: "custom.domain.com",
        protocol: "https",
        bindings,
      });
      expect(result).toBe("https://myapp--myuser.custom.domain.com/~abc123~/");
    });
  });

  describe("extractHostToBindings", () => {
    it("extracts appSlug and userSlug from hostname", () => {
      const result = extractHostToBindings({
        matchURL: "https://myapp--myuser.vibes.app/",
      });
      expect(result.Unwrap()).toEqual({
        url: "https://myapp--myuser.vibes.app/",
        appSlug: "myapp",
        userSlug: "myuser",
        path: "/",
      });
    });

    it("extracts appSlug, userSlug and path", () => {
      const result = extractHostToBindings({
        matchURL: "https://myapp--myuser.vibes.app/some/path",
      });
      expect(result.Unwrap()).toEqual({
        url: "https://myapp--myuser.vibes.app/some/path",
        appSlug: "myapp",
        userSlug: "myuser",
        path: "/some/path",
      });
    });

    it("extracts fsId from path: /~z...~", () => {
      const result = extractHostToBindings({
        matchURL: "https://myapp--myuser.vibes.app/~zabc12345~",
      });
      expect(result.Unwrap()).toEqual({
        url: "https://myapp--myuser.vibes.app/~zabc12345~",
        appSlug: "myapp",
        userSlug: "myuser",
        fsId: "zabc12345",
        path: "/",
      });
    });

    it("extracts fsId from path: /~z...~/", () => {
      const result = extractHostToBindings({
        matchURL: "https://myapp--myuser.vibes.app/~zabc12345~/",
      });
      expect(result.Unwrap()).toEqual({
        url: "https://myapp--myuser.vibes.app/~zabc12345~/",
        appSlug: "myapp",
        userSlug: "myuser",
        fsId: "zabc12345",
        path: "/",
      });
    });

    it("extracts fsId from path: /~z...~/some", () => {
      const result = extractHostToBindings({
        matchURL: "https://myapp--myuser.vibes.app/~zabc12345~/some",
      });
      expect(result.Unwrap()).toEqual({
        url: "https://myapp--myuser.vibes.app/~zabc12345~/some",
        appSlug: "myapp",
        userSlug: "myuser",
        fsId: "zabc12345",
        path: "/some",
      });
    });

    it("extracts fsId from path: /~z...~/some/thing", () => {
      const result = extractHostToBindings({
        matchURL: "https://myapp--myuser.vibes.app/~zabc12345~/some/thing",
      });
      expect(result.Unwrap()).toEqual({
        url: "https://myapp--myuser.vibes.app/~zabc12345~/some/thing",
        appSlug: "myapp",
        userSlug: "myuser",
        fsId: "zabc12345",
        path: "/some/thing",
      });
    });

    it("does not extract fsId without ~ delimiters", () => {
      const result = extractHostToBindings({
        matchURL: "https://myapp--myuser.vibes.app/zabc12345/some",
      });
      expect(result.Unwrap()).toEqual({
        url: "https://myapp--myuser.vibes.app/zabc12345/some",
        appSlug: "myapp",
        userSlug: "myuser",
        path: "/zabc12345/some",
      });
    });

    it("lowercases appSlug and userSlug", () => {
      const result = extractHostToBindings({
        matchURL: "https://MyApp--MyUser.vibes.app/",
      });
      expect(result.Unwrap()).toEqual({
        url: "https://MyApp--MyUser.vibes.app/",
        appSlug: "myapp",
        userSlug: "myuser",
        path: "/",
      });
    });

    it("handles hyphenated slugs", () => {
      const result = extractHostToBindings({
        matchURL: "https://my-cool-app--some-user.vibes.app/",
      });
      expect(result.Unwrap()).toEqual({
        url: "https://my-cool-app--some-user.vibes.app/",
        appSlug: "my-cool-app",
        userSlug: "some-user",
        path: "/",
      });
    });

    it("returns None when hostname does not match pattern", () => {
      const result = extractHostToBindings({
        matchURL: "https://invalid.vibes.app/path",
      });
      expect(result.IsNone()).toBe(true);
    });

    it("returns None when hostname has single dash instead of double", () => {
      const result = extractHostToBindings({
        matchURL: "https://myapp-myuser.vibes.app/path",
      });
      expect(result.IsNone()).toBe(true);
    });

    it("returns None for invalid hostname format", () => {
      const result = extractHostToBindings({
        matchURL: "https://other.domain.com/path",
      });
      expect(result.IsNone()).toBe(true);
    });

    it("extracts fsId with mixed case (real data)", () => {
      const result = extractHostToBindings({
        matchURL:
          "http://partly-daily-tropical--negative-learn-generally.localhost.vibesdiy.net/~zFJwyDDJWMu3qBw3ujoQa15bpHrPciZTc1sYuTz7UC8wB~/",
      });
      expect(result.Unwrap()).toEqual({
        url: "http://partly-daily-tropical--negative-learn-generally.localhost.vibesdiy.net/~zFJwyDDJWMu3qBw3ujoQa15bpHrPciZTc1sYuTz7UC8wB~/",
        appSlug: "partly-daily-tropical",
        userSlug: "negative-learn-generally",
        fsId: "zFJwyDDJWMu3qBw3ujoQa15bpHrPciZTc1sYuTz7UC8wB",
        path: "/",
      });
    });

    it("extracts fsId with mixed case and path", () => {
      const result = extractHostToBindings({
        matchURL: "http://myapp--myuser.vibes.app/~zABC123xyz~/some/path",
      });
      expect(result.Unwrap()).toEqual({
        url: "http://myapp--myuser.vibes.app/~zABC123xyz~/some/path",
        appSlug: "myapp",
        userSlug: "myuser",
        fsId: "zABC123xyz",
        path: "/some/path",
      });
    });

    it("roundtrip: calcEntryPointUrl -> extractHostToBindings", () => {
      const bindings = {
        appSlug: "testapp",
        userSlug: "testuser",
        fsId: "zabc12345678",
      };

      const url = calcEntryPointUrl({
        hostnameBase: "vibes.app",
        protocol: "https",
        bindings,
      });

      expect(url).toBe("https://testapp--testuser.vibes.app/~zabc12345678~/");

      const extracted = extractHostToBindings({
        matchURL: url,
      });

      expect(extracted.Unwrap()).toEqual({
        url,
        appSlug: "testapp",
        userSlug: "testuser",
        fsId: "zabc12345678",
        path: "/",
      });
    });
  });
});
