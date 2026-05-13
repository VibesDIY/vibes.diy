import { describe, it, expect } from "vitest";
import {
  getThemeBySlug,
  getThemeCatalogNames,
  getThemeText,
  makeBaseSystemPrompt,
  parseDesignMd,
  preAllocParsed,
  vibesThemes,
} from "@vibes.diy/prompts";
import { type } from "arktype";
import { createMockFetchFromPkgFiles } from "./helpers/load-mock-data.js";

const mockFetch = createMockFetchFromPkgFiles();
const fetchAsResponse = ((url: string) => mockFetch(url)) as unknown as typeof fetch;

describe("theme catalog", () => {
  it("exposes a catalog with slug, name, accentColor, bgColor", () => {
    expect(vibesThemes.length).toBeGreaterThan(40);
    for (const t of vibesThemes) {
      expect(t.slug).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.accentColor.length).toBeGreaterThan(0);
      expect(t.bgColor.length).toBeGreaterThan(0);
    }
  });

  it("getThemeCatalogNames returns the same slug set", () => {
    const names = getThemeCatalogNames();
    for (const t of vibesThemes) expect(names.has(t.slug)).toBe(true);
    expect(names.size).toBe(vibesThemes.length);
  });

  it("getThemeBySlug returns the theme or undefined", () => {
    expect(getThemeBySlug(vibesThemes[0].slug)?.slug).toBe(vibesThemes[0].slug);
    expect(getThemeBySlug("does-not-exist")).toBeUndefined();
  });
});

describe("getThemeText", () => {
  it("loads the markdown body for a known theme slug", async () => {
    const text = await getThemeText("atlas");
    expect(typeof text).toBe("string");
    expect(text.trim().length).toBeGreaterThan(0);
  });
});

describe("parseDesignMd", () => {
  it("parses YAML frontmatter colors and font", () => {
    const md = [
      "---",
      "name: Test Theme",
      "colors:",
      '  primary: "#ff0000"',
      '  background: "#fafafa"',
      "typography:",
      "  body-md:",
      "    fontFamily: Inter",
      "---",
      "",
      "## Brand",
      "Body text.",
    ].join("\n");

    const parsed = parseDesignMd(md, "test");
    expect(parsed.slug).toBe("test");
    expect(parsed.name).toBe("Test Theme");
    expect(parsed.accentColor).toBe("#ff0000");
    expect(parsed.bgColor).toBe("#fafafa");
    expect(parsed.bodyFont).toBe("Inter");
  });

  it("falls back to slug when frontmatter is missing", () => {
    const parsed = parseDesignMd("not a real md file", "fallback-slug");
    expect(parsed.slug).toBe("fallback-slug");
    expect(parsed.name).toBe("fallback-slug");
    expect(parsed.accentColor).toBe("#666");
    expect(parsed.bgColor).toBe("#fff");
  });

  it("derives slug from name when slug not provided", () => {
    const parsed = parseDesignMd("---\nname: My Pretty Theme\n---\n");
    expect(parsed.slug).toBe("my-pretty-theme");
  });
});

describe("preAllocParsed", () => {
  it("accepts a response with theme", () => {
    const ok = preAllocParsed({
      skills: ["fireproof"],
      pairs: [{ title: "Test", slug: "test" }],
      iconDescription: "a fox",
      theme: "atlas",
    });
    expect(ok instanceof type.errors).toBe(false);
  });

  it("accepts a response without theme", () => {
    const ok = preAllocParsed({
      skills: ["fireproof"],
      pairs: [{ title: "Test", slug: "test" }],
      iconDescription: "a fox",
    });
    expect(ok instanceof type.errors).toBe(false);
  });
});

describe("makeBaseSystemPrompt theme injection", () => {
  it("injects <theme-design-md> when a known theme is supplied", async () => {
    const result = await makeBaseSystemPrompt("test-model", {
      skills: ["fireproof"],
      theme: "atlas",
      fetch: fetchAsResponse,
    });
    expect(result.theme).toBe("atlas");
    // Body between the tags depends on whether the asset loaded from disk
    // (real Atlas markdown) or via mock fetch (browser env) — assert the
    // wrapper is present and non-empty, which is what we actually care about.
    const match = result.systemPrompt.match(/<theme-design-md>([\s\S]*?)<\/theme-design-md>/);
    expect(match).toBeTruthy();
    expect((match?.[1] ?? "").trim().length).toBeGreaterThan(0);
  });

  it("drops unknown theme slugs silently", async () => {
    const result = await makeBaseSystemPrompt("test-model", {
      skills: ["fireproof"],
      theme: "nope-not-real",
      fetch: fetchAsResponse,
    });
    expect(result.theme).toBeUndefined();
    expect(result.systemPrompt).not.toContain("<theme-design-md>");
  });

  it("collapses placeholder when theme is omitted", async () => {
    const result = await makeBaseSystemPrompt("test-model", {
      skills: ["fireproof"],
      fetch: fetchAsResponse,
    });
    expect(result.theme).toBeUndefined();
    expect(result.systemPrompt).not.toContain("<theme-design-md>");
    expect(result.systemPrompt).not.toContain("{{THEME_DESIGN}}");
  });
});

describe("theme replaces defaultStylePrompt", () => {
  // The default style prompt is a baked-in neobrutalist palette. When a
  // theme is selected, the theme markdown should govern — the default
  // shouldn't also appear in the system prompt or it contradicts the theme.
  // A user-supplied stylePrompt still wins (explicit override).

  const DEFAULT_FINGERPRINT = "Neobrutalist Design System";

  it("includes defaultStylePrompt when no theme and no user stylePrompt", async () => {
    const result = await makeBaseSystemPrompt("test-model", {
      skills: ["fireproof"],
      fetch: fetchAsResponse,
    });
    expect(result.systemPrompt).toContain(DEFAULT_FINGERPRINT);
  });

  it("drops defaultStylePrompt when a theme is selected", async () => {
    const result = await makeBaseSystemPrompt("test-model", {
      skills: ["fireproof"],
      theme: "atlas",
      fetch: fetchAsResponse,
    });
    expect(result.theme).toBe("atlas");
    expect(result.systemPrompt).toContain("<theme-design-md>");
    expect(result.systemPrompt).not.toContain(DEFAULT_FINGERPRINT);
  });

  it("user-supplied stylePrompt wins over both default and theme", async () => {
    const userStyle = "USER-CUSTOM-STYLE-MARKER-12345";
    const result = await makeBaseSystemPrompt("test-model", {
      skills: ["fireproof"],
      theme: "atlas",
      stylePrompt: userStyle,
      fetch: fetchAsResponse,
    });
    expect(result.systemPrompt).toContain(userStyle);
    expect(result.systemPrompt).toContain("<theme-design-md>");
    expect(result.systemPrompt).not.toContain(DEFAULT_FINGERPRINT);
  });
});
