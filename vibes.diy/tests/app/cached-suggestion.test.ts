import { describe, it, expect } from "vitest";
import {
  normalizeTransform,
  cachedSuggestionKey,
  isCachedSuggestionKeyShape,
  cachedVibeHref,
  isReadableCachedGrant,
  resolveCachedRead,
  type CachedSuggestionHit,
} from "@vibes.diy/api-types";

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

describe("cachedSuggestionKey", () => {
  const source = { ownerHandle: "meghan", appSlug: "bloom" } as const;

  it("is deterministic for identical inputs", () => {
    expect(cachedSuggestionKey({ source, transform: "Make it a drum kit" })).toBe(
      cachedSuggestionKey({ source, transform: "Make it a drum kit" })
    );
  });

  it("dedupes transforms that normalize to the same string", () => {
    expect(cachedSuggestionKey({ source, transform: "▸ Make it a drum kit." })).toBe(
      cachedSuggestionKey({ source, transform: "make it a DRUM kit" })
    );
  });

  it("produces a key inside the 32-char budget", () => {
    const key = cachedSuggestionKey({
      source: { ownerHandle: "a-really-long-owner-handle-name", appSlug: "a-really-long-source-slug-name" },
      transform: "Make it a wildly elaborate transform with lots and lots of words in it",
      model: "claude-opus-4-8",
    });
    expect(key).toMatch(/^[a-z0-9-]+$/);
    expect(key.length).toBeLessThanOrEqual(32);
    expect(key.startsWith("cf-")).toBe(true);
  });

  it("keys differ by source owner, slug, transform, fsId, and model", () => {
    const base = cachedSuggestionKey({ source, transform: "Make it loud" });
    expect(cachedSuggestionKey({ source: { ...source, ownerHandle: "casey" }, transform: "Make it loud" })).not.toBe(base);
    expect(cachedSuggestionKey({ source: { ...source, appSlug: "other" }, transform: "Make it loud" })).not.toBe(base);
    expect(cachedSuggestionKey({ source, transform: "Make it quiet" })).not.toBe(base);
    expect(cachedSuggestionKey({ source: { ...source, fsId: "v2" }, transform: "Make it loud" })).not.toBe(base);
    expect(cachedSuggestionKey({ source, transform: "Make it loud", model: "claude-opus-4-8" })).not.toBe(base);
  });

  it("does not alias across the field boundary (concat safety)", () => {
    // owner "ab" + slug "c" must not collide with owner "a" + slug "bc".
    const k1 = cachedSuggestionKey({ source: { ownerHandle: "ab", appSlug: "c" }, transform: "x" });
    const k2 = cachedSuggestionKey({ source: { ownerHandle: "a", appSlug: "bc" }, transform: "x" });
    expect(k1).not.toBe(k2);
  });
});

describe("isCachedSuggestionKeyShape", () => {
  it("accepts the canonical content-address shape produced by cachedSuggestionKey", () => {
    const key = cachedSuggestionKey({ source: { ownerHandle: "meghan", appSlug: "bloom" }, transform: "Make it loud" });
    expect(isCachedSuggestionKeyShape(key)).toBe(true);
    expect(isCachedSuggestionKeyShape("cf-1bekku3-13qsuzt")).toBe(true);
  });

  it("rejects attacker-controlled input so the public read endpoint never logs it raw", () => {
    // The read endpoint's schema only requires `key: string`, so these are all
    // values a non-UI caller could send. None may be echoed into prod logs.
    expect(isCachedSuggestionKeyShape("a custom prompt with PII: jane@example.com")).toBe(false);
    expect(isCachedSuggestionKeyShape("CF-UPPER-CASE")).toBe(false);
    expect(isCachedSuggestionKeyShape("cf-onlyonepart")).toBe(false);
    expect(isCachedSuggestionKeyShape("")).toBe(false);
    expect(isCachedSuggestionKeyShape("cf-" + "a".repeat(40) + "-b")).toBe(false); // over the 32-char budget
    expect(isCachedSuggestionKeyShape("cf-abc-d\nef")).toBe(false); // embedded newline
  });
});

describe("cachedVibeHref", () => {
  it("points at the source vibe at a staged version (same owner/slug, specific fsId)", () => {
    const hit: CachedSuggestionHit = { ownerHandle: "meghan", appSlug: "bloom", fsId: "z3abc" };
    expect(cachedVibeHref(hit)).toBe("/vibe/meghan/bloom/z3abc");
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
  const source = { ownerHandle: "meghan", appSlug: "bloom", fsId: "v1" } as const;

  it("returns a read (navigate to the staged version) on a hit", async () => {
    const seen: { key: string; source: typeof source }[] = [];
    const staged: CachedSuggestionHit = { ownerHandle: "meghan", appSlug: "bloom", fsId: "z3staged" };
    const decision = await resolveCachedRead({
      source,
      transform: "Make it a drum kit",
      lookup: async (req) => {
        seen.push(req as { key: string; source: typeof source });
        return staged;
      },
    });
    expect(decision.kind).toBe("read");
    if (decision.kind === "read") {
      expect(decision.hit).toEqual(staged);
      expect(decision.href).toBe(cachedVibeHref(staged));
    }
    expect(seen).toHaveLength(1);
    // The lookup is handed the content-address key + the source.
    expect(seen[0].key).toBe(cachedSuggestionKey({ source, transform: "Make it a drum kit" }));
    expect(seen[0].source).toEqual(source);
  });

  it("falls through to the write lane on a cache miss (null)", async () => {
    const decision = await resolveCachedRead({ source, transform: "Make it a drum kit", lookup: async () => null });
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
