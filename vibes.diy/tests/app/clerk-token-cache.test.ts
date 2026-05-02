import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearCachedClerkToken,
  EXP_MARGIN_SEC,
  readCachedClerkToken,
  readUsableCachedToken,
  TOKEN_STORAGE_KEY,
  writeCachedClerkToken,
} from "~/vibes.diy/app/vibes-diy-provider.js";

// Build a JWT-shaped string whose payload decodes to {exp}. The cache helpers
// only inspect `exp`, so header + signature can be arbitrary.
function makeJwt(exp: number): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ exp })}.sig`;
}

describe("clerk-token cache", () => {
  beforeEach(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  });
  afterEach(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  });

  describe("write/read round-trip", () => {
    it("writeCachedClerkToken stores {token, exp} parsed from JWT payload", () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const jwt = makeJwt(exp);
      writeCachedClerkToken(jwt);
      const cached = readCachedClerkToken();
      expect(cached).toEqual({ token: jwt, exp });
    });

    it("readCachedClerkToken returns undefined when storage is empty", () => {
      expect(readCachedClerkToken()).toBeUndefined();
    });

    it("readCachedClerkToken returns undefined for malformed JSON", () => {
      localStorage.setItem(TOKEN_STORAGE_KEY, "{not json");
      expect(readCachedClerkToken()).toBeUndefined();
    });

    it("readCachedClerkToken returns undefined for shape-mismatched payload", () => {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ token: "x", expiresAt: 1 }));
      expect(readCachedClerkToken()).toBeUndefined();
    });

    it("writeCachedClerkToken ignores tokens missing a payload segment", () => {
      writeCachedClerkToken("only-one-segment");
      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });
  });

  describe("readUsableCachedToken", () => {
    const nowSec = () => Math.floor(Date.now() / 1000);

    it("returns None when no token is cached", () => {
      const result = readUsableCachedToken({ clerkLoaded: true, clerkSignedIn: true, nowSec: nowSec() });
      expect(result.IsNone()).toBe(true);
    });

    it("returns None when cached token is already expired", () => {
      const exp = nowSec() - 10;
      writeCachedClerkToken(makeJwt(exp));
      const result = readUsableCachedToken({ clerkLoaded: true, clerkSignedIn: true, nowSec: nowSec() });
      expect(result.IsNone()).toBe(true);
    });

    it("returns None when cached token expires inside EXP_MARGIN_SEC", () => {
      const exp = nowSec() + EXP_MARGIN_SEC - 1;
      writeCachedClerkToken(makeJwt(exp));
      const result = readUsableCachedToken({ clerkLoaded: true, clerkSignedIn: true, nowSec: nowSec() });
      expect(result.IsNone()).toBe(true);
    });

    it("returns Some(token) when cached token is comfortably valid and Clerk has not loaded yet", () => {
      const exp = nowSec() + 3600;
      const jwt = makeJwt(exp);
      writeCachedClerkToken(jwt);
      // Pre-Clerk-load fast path: clerkLoaded=false, clerkSignedIn=false.
      const result = readUsableCachedToken({ clerkLoaded: false, clerkSignedIn: false, nowSec: nowSec() });
      expect(result.IsSome()).toBe(true);
      expect(result.Unwrap()).toBe(jwt);
    });

    it("returns Some(token) when cached token is valid and Clerk reports signed-in", () => {
      const exp = nowSec() + 3600;
      const jwt = makeJwt(exp);
      writeCachedClerkToken(jwt);
      const result = readUsableCachedToken({ clerkLoaded: true, clerkSignedIn: true, nowSec: nowSec() });
      expect(result.IsSome()).toBe(true);
      expect(result.Unwrap()).toBe(jwt);
    });

    // Regression test for the bug fixed by b61781c8: a still-unexpired JWT
    // must not be returned once Clerk reports signed-out, and the stale entry
    // must be wiped so a parallel reader cannot resurrect it.
    it("returns None and wipes localStorage when Clerk is loaded + signed-out", () => {
      const exp = nowSec() + 3600;
      writeCachedClerkToken(makeJwt(exp));
      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).not.toBeNull();
      const result = readUsableCachedToken({ clerkLoaded: true, clerkSignedIn: false, nowSec: nowSec() });
      expect(result.IsNone()).toBe(true);
      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });

    it("clearCachedClerkToken removes the entry", () => {
      writeCachedClerkToken(makeJwt(nowSec() + 3600));
      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).not.toBeNull();
      clearCachedClerkToken();
      expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });
  });
});
