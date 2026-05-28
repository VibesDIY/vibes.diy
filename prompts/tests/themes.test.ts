import { describe, it, expect } from "vitest";
import {
  composeDesignMd,
  getColorsetCatalogNames,
  getThemeBySlug,
  getThemeCatalogNames,
  getThemeText,
  makeBaseSystemPrompt,
  parseColorsetYaml,
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

  it("accepts a response missing enrichedPrompt", () => {
    // Under Claude tool_mode the schema's `required: ["enrichedPrompt"]` is
    // best-effort, not enforced. Validation must still accept the response so
    // we keep skills (esp. use-viewer) — rejecting the whole turn over a
    // missing preamble means the generated vibe never imports useViewer and
    // every viewer's `can("write")` defaults to false. Regression caught:
    // tightening this to required broke owner-write affordances in /chat/
    // because the chat path runs pre-alloc anew on a fresh chat.
    const ok = preAllocParsed({
      skills: ["fireproof", "use-viewer"],
      pairs: [{ title: "Test", slug: "test" }],
      iconDescription: "a fox",
      theme: "atlas",
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

describe("colorset composer", () => {
  // Same shape as the YAML we ship in prompts/pkg/themes/colors/.
  const colorsetYaml = [
    "name: Sample",
    "colors:",
    '  primary: "#ff0000"',
    '  background: "#fafafa"',
    "colorsDark:",
    '  primary: "#ff5555"',
    '  background: "#111111"',
  ].join("\n");

  it("parseColorsetYaml extracts name + light + dark maps", () => {
    const cs = parseColorsetYaml(colorsetYaml);
    expect(cs.name).toBe("Sample");
    expect(cs.colors.primary).toBe("#ff0000");
    expect(cs.colors.background).toBe("#fafafa");
    expect(cs.colorsDark?.primary).toBe("#ff5555");
  });

  it("composeDesignMd injects colors into frontmatter and substitutes {{token}}", () => {
    const structural = [
      "---",
      "name: Structural",
      "typography:",
      "  body-md:",
      "    fontFamily: Inter",
      "---",
      "",
      "Primary action uses `{{primary}}` on `{{background}}`.",
    ].join("\n");
    const out = composeDesignMd(structural, parseColorsetYaml(colorsetYaml));
    // Frontmatter gets colors:/colorsDark: injected right after name.
    expect(out).toMatch(/name: Structural\ncolors:\n {2}primary: "#ff0000"/);
    expect(out).toMatch(/colorsDark:\n {2}primary: "#ff5555"/);
    // Typography stays in place.
    expect(out).toMatch(/typography:\n {2}body-md:\n {4}fontFamily: Inter/);
    // Prose placeholders are substituted with light-mode values.
    expect(out).toContain("Primary action uses `#ff0000` on `#fafafa`.");
  });

  it("composeDesignMd leaves unknown tokens as {{token}} for visibility", () => {
    const structural = "---\nname: T\n---\n\nUses `{{nonexistent}}`.";
    const out = composeDesignMd(structural, parseColorsetYaml(colorsetYaml));
    expect(out).toContain("`{{nonexistent}}`");
  });

  it("getColorsetCatalogNames mirrors the structural theme catalog", () => {
    const themeNames = getThemeCatalogNames();
    const colorNames = getColorsetCatalogNames();
    expect(colorNames.size).toBe(themeNames.size);
    for (const slug of themeNames) expect(colorNames.has(slug)).toBe(true);
  });
});

describe("makeBaseSystemPrompt colorTheme injection", () => {
  it("wires colorTheme through validation + into the result", async () => {
    const result = await makeBaseSystemPrompt("test-model", {
      skills: ["fireproof"],
      theme: "atlas",
      colorTheme: "matrix",
      fetch: fetchAsResponse,
    });
    expect(result.theme).toBe("atlas");
    expect(result.colorTheme).toBe("matrix");
    // The <theme-design-md> wrapper must be present — the composer's actual
    // output is covered by the unit tests in the `colorset composer` block,
    // which don't depend on file I/O.
    expect(result.systemPrompt).toContain("<theme-design-md>");
  });

  it("defaults colorTheme to theme when omitted", async () => {
    const result = await makeBaseSystemPrompt("test-model", {
      skills: ["fireproof"],
      theme: "atlas",
      fetch: fetchAsResponse,
    });
    expect(result.theme).toBe("atlas");
    expect(result.colorTheme).toBe("atlas");
  });

  it("drops unknown colorTheme slugs silently and falls back to theme", async () => {
    const result = await makeBaseSystemPrompt("test-model", {
      skills: ["fireproof"],
      theme: "atlas",
      colorTheme: "not-real",
      fetch: fetchAsResponse,
    });
    expect(result.colorTheme).toBe("atlas");
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
