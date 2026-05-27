import { describe, it, expect } from "vitest";
import { URI } from "@adviser/cement";

// Documents the assumption behind logout.tsx's same-origin check.
//
// The concern: does explicit default port (http :80 / https :443) break
// origin equality? These tests confirm native URL strips default ports
// from .origin correctly, so no manual normalization is needed there.
//
// URI.from quirk: internally it substitutes "http" as the parse protocol,
// so only port 80 is recognized as a default. An explicit :443 on an
// https URL is NOT stripped from .host. Use .hostname (no port) when
// doing same-origin checks via URI — logout.tsx does this.

describe("URL.origin default-port normalization", () => {
  it("http :80 is stripped from origin", () => {
    expect(new URL("http://example.com:80/path").origin).toBe("http://example.com");
  });

  it("https :443 is stripped from origin", () => {
    expect(new URL("https://example.com:443/path").origin).toBe("https://example.com");
  });

  it("non-default port is preserved in origin", () => {
    expect(new URL("https://example.com:8080/path").origin).toBe("https://example.com:8080");
  });

  it("same-origin check works across http :80 vs no-port", () => {
    const referrer = new URL("http://vibes.diy:80/app");
    const current = new URL("http://vibes.diy/logout");
    expect(referrer.origin).toBe(current.origin);
  });

  it("cross-origin is correctly rejected", () => {
    const referrer = new URL("https://attacker.com/logout");
    const current = new URL("https://vibes.diy/logout");
    expect(referrer.origin).not.toBe(current.origin);
  });
});

describe("URI.from (cement) port behavior", () => {
  it("http :80 stripped — http parse shares same default", () => {
    expect(URI.from("http://example.com:80/path").host).toBe("example.com");
  });

  it("https :443 NOT stripped — cement parses as http internally, 443 is not http default", () => {
    // This documents a cement quirk: explicit :443 survives in .host for https.
    // Use .hostname for same-origin checks to avoid this edge case.
    expect(URI.from("https://example.com:443/path").host).toBe("example.com:443");
  });

  it("URI.from hostname always omits port — safe for same-origin checks", () => {
    expect(URI.from("https://example.com:443/path").hostname).toBe("example.com");
    expect(URI.from("https://example.com/path").hostname).toBe("example.com");
  });

  it("non-default port preserved in .host but not .hostname", () => {
    expect(URI.from("https://example.com:8080/path").host).toBe("example.com:8080");
    expect(URI.from("https://example.com:8080/path").hostname).toBe("example.com");
  });
});
