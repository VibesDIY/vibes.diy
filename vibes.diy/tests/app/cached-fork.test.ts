import { describe, it, expect } from "vitest";
import {
  SYSTEM_CACHE_HANDLE,
  isSystemCacheHandle,
  normalizeTransform,
  cachedForkKey,
  cachedForkRef,
  cachedForkHref,
  isReadableCachedGrant,
  resolveCachedRead,
  type CachedForkRef,
} from "@vibes.diy/api-types";

describe("isSystemCacheHandle", () => {
  it("recognizes the reserved handle and rejects everything else", () => {
    expect(isSystemCacheHandle(SYSTEM_CACHE_HANDLE)).toBe(true);
    expect(isSystemCacheHandle("meghan")).toBe(false);
    expect(isSystemCacheHandle(undefined)).toBe(false);
    expect(isSystemCacheHandle("")).toBe(false);
  });

  it("is a valid lowercase slug so it can own ordinary public apps", () => {
    expect(SYSTEM_CACHE_HANDLE).toMatch(/^[a-z0-9-]{1,32}$/);
  });
});

describe("normalizeTransform", () => {
  it("strips a leading ▸ chip marker", () => {
    expect(normalizeTransform("▸ Make it a drum kit")).toBe("make it a drum kit");
    expect(normalizeTransform("▸Make it a drum kit")).toBe("make it a drum kit");
  });

  it("lowercases, collapses whitespace, trims, and drops trailing punctuation", () => {
    expect(normalizeTransform("  Make   IT  a Drum Kit!! ")).toBe("make it a drum kit");
    expect(normalizeTransform("Add a high score…")).toBe("add a high score");
    expect(normalizeTransform("make\nit\tloud?")).toBe("make it loud");
  });

  it("dedupes trivially-different strings to the same canonical form", () => {
    expect(normalizeTransform("▸ Make it a drum kit.")).toBe(normalizeTransform("make it a DRUM   kit"));
  });
});

describe("cachedForkKey", () => {
  const source = { ownerHandle: SYSTEM_CACHE_HANDLE, appSlug: "bloom" } as const;

  it("is deterministic for identical inputs", () => {
    expect(cachedForkKey({ source, transform: "Make it a drum kit" })).toBe(
      cachedForkKey({ source, transform: "Make it a drum kit" })
    );
  });

  it("dedupes transforms that normalize to the same string", () => {
    expect(cachedForkKey({ source, transform: "▸ Make it a drum kit." })).toBe(
      cachedForkKey({ source, transform: "make it a DRUM kit" })
    );
  });

  it("produces a slug-safe key inside the 32-char budget", () => {
    const key = cachedForkKey({
      source: { ownerHandle: SYSTEM_CACHE_HANDLE, appSlug: "a-really-long-source-slug-name" },
      transform: "Make it a wildly elaborate transform with lots and lots of words in it",
      model: "claude-opus-4-8",
    });
    expect(key).toMatch(/^[a-z0-9-]+$/);
    expect(key.length).toBeLessThanOrEqual(32);
    expect(key.startsWith("cf-")).toBe(true);
  });

  it("keys differ by source, transform, fsId, and model", () => {
    const base = cachedForkKey({ source, transform: "Make it loud" });
    expect(cachedForkKey({ source: { ...source, appSlug: "other" }, transform: "Make it loud" })).not.toBe(base);
    expect(cachedForkKey({ source, transform: "Make it quiet" })).not.toBe(base);
    expect(cachedForkKey({ source: { ...source, fsId: "v2" }, transform: "Make it loud" })).not.toBe(base);
    expect(cachedForkKey({ source, transform: "Make it loud", model: "claude-opus-4-8" })).not.toBe(base);
  });

  it("does not alias across the field boundary (NUL/concat safety)", () => {
    // "ab" + "c" must not collide with "a" + "bc".
    const k1 = cachedForkKey({ source: { ownerHandle: SYSTEM_CACHE_HANDLE, appSlug: "ab" }, transform: "c" });
    const k2 = cachedForkKey({ source: { ownerHandle: SYSTEM_CACHE_HANDLE, appSlug: "a" }, transform: "bc" });
    expect(k1).not.toBe(k2);
  });
});

describe("cachedForkRef / cachedForkHref", () => {
  it("addresses the fork under the system handle", () => {
    const ref = cachedForkRef({ source: { ownerHandle: SYSTEM_CACHE_HANDLE, appSlug: "bloom" }, transform: "Make it loud" });
    expect(ref.ownerHandle).toBe(SYSTEM_CACHE_HANDLE);
    expect(ref.appSlug).toBe(
      cachedForkKey({ source: { ownerHandle: SYSTEM_CACHE_HANDLE, appSlug: "bloom" }, transform: "Make it loud" })
    );
    expect(cachedForkHref(ref)).toBe(`/vibe/${SYSTEM_CACHE_HANDLE}/${ref.appSlug}`);
  });
});

describe("isReadableCachedGrant", () => {
  it("treats public/owner/granted as readable", () => {
    for (const g of ["public-access", "owner", "granted-access.viewer", "granted-access.editor", "accepted-email-invite"]) {
      expect(isReadableCachedGrant(g)).toBe(true);
    }
  });

  it("treats missing/gated grants as NOT readable (so they fall to the write lane)", () => {
    for (const g of ["not-found", "not-grant", "revoked-access", "pending-request", "req-login.request", "req-login.invite"]) {
      expect(isReadableCachedGrant(g)).toBe(false);
    }
  });
});

describe("resolveCachedRead", () => {
  const source = { ownerHandle: SYSTEM_CACHE_HANDLE, appSlug: "bloom" } as const;

  it("returns a read (navigate) when the cached fork exists and is readable", async () => {
    const seen: CachedForkRef[] = [];
    const decision = await resolveCachedRead({
      source,
      transform: "Make it a drum kit",
      lookup: async (ref) => {
        seen.push(ref);
        return true;
      },
    });
    expect(decision.kind).toBe("read");
    if (decision.kind === "read") {
      expect(decision.ref.ownerHandle).toBe(SYSTEM_CACHE_HANDLE);
      expect(decision.href).toBe(cachedForkHref(decision.ref));
    }
    expect(seen).toHaveLength(1);
    // The lookup is handed the content-address ref, not the source.
    expect(seen[0].appSlug).toBe(cachedForkKey({ source, transform: "Make it a drum kit" }));
  });

  it("falls through to the write lane on a cache miss", async () => {
    const decision = await resolveCachedRead({ source, transform: "Make it a drum kit", lookup: async () => false });
    expect(decision.kind).toBe("write");
  });

  it("soft-fails to the write lane when the lookup throws (reads never fail loud)", async () => {
    const decision = await resolveCachedRead({
      source,
      transform: "Make it a drum kit",
      lookup: async () => {
        throw new Error("network down");
      },
    });
    expect(decision.kind).toBe("write");
  });
});
