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
  renderRootCssBlock,
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

describe("canonical token vocabulary", () => {
  // Older yamls and the comp-* dialect map onto the Stitch-aligned canonical
  // names at parse time so any palette is interchangeable across any theme.

  it("aliases legacy names (bg/fg/comp-*) onto canonical slots", () => {
    const yaml = [
      "name: Legacy",
      "colors:",
      '  bg: "#111"',
      '  fg: "#fff"',
      '  fg-muted: "#aaa"',
      '  comp-bg: "#222"',
      '  comp-accent: "#f00"',
      '  comp-border: "#333"',
      '  danger: "#ff0000"',
    ].join("\n");
    const cs = parseColorsetYaml(yaml);
    expect(cs.colors.background).toBe("#111");
    expect(cs.colors["text-primary"]).toBe("#fff");
    expect(cs.colors["text-secondary"]).toBe("#aaa");
    expect(cs.colors.surface).toBe("#222");
    expect(cs.colors.primary).toBe("#f00");
    expect(cs.colors.border).toBe("#333");
    expect(cs.colors.error).toBe("#ff0000");
    // Legacy names should not also appear under their original keys.
    expect(cs.colors.bg).toBeUndefined();
    expect(cs.colors.fg).toBeUndefined();
    expect(cs.extras).toBeUndefined();
  });

  it("preserves canonical names that are already in the source", () => {
    const yaml = [
      "name: Stitch-style",
      "colors:",
      '  background: "#fff"',
      '  surface: "#fafafa"',
      '  primary: "#3b82f6"',
      '  secondary: "#10b981"',
      '  accent: "#f59e0b"',
      '  text-primary: "#111"',
      '  text-secondary: "#555"',
      '  text-disabled: "#aaa"',
      '  border: "#ddd"',
      '  success: "#22c55e"',
      '  warning: "#f59e0b"',
      '  error: "#ef4444"',
      '  neutral: "#6b7280"',
    ].join("\n");
    const cs = parseColorsetYaml(yaml);
    for (const token of [
      "background",
      "surface",
      "primary",
      "secondary",
      "accent",
      "text-primary",
      "text-secondary",
      "text-disabled",
      "border",
      "success",
      "warning",
      "error",
      "neutral",
    ]) {
      expect(cs.colors[token]).toBeDefined();
    }
    expect(cs.extras).toBeUndefined();
  });

  it("routes non-canonical, non-aliased tokens to extras", () => {
    const yaml = [
      "name: Bespoke",
      "colors:",
      '  bg: "#000"',
      '  dial-chassis: "#222"',
      '  accent-amber: "#fa0"',
      '  comp-accent-text: "#111"',
    ].join("\n");
    const cs = parseColorsetYaml(yaml);
    expect(cs.colors.background).toBe("#000");
    expect(cs.extras).toBeDefined();
    expect(cs.extras?.["dial-chassis"]).toBe("#222");
    expect(cs.extras?.["accent-amber"]).toBe("#fa0");
    // comp-accent-text is "on-accent", not a Stitch concept — stays in extras.
    expect(cs.extras?.["comp-accent-text"]).toBe("#111");
  });

  it("reads an explicit extras: block", () => {
    const yaml = [
      "name: Explicit",
      "colors:",
      '  background: "#fff"',
      '  text-primary: "#111"',
      "extras:",
      '  wood-frame: "#8b4513"',
      '  brass-mid: "#cfa562"',
    ].join("\n");
    const cs = parseColorsetYaml(yaml);
    expect(cs.colors.background).toBe("#fff");
    expect(cs.extras?.["wood-frame"]).toBe("#8b4513");
    expect(cs.extras?.["brass-mid"]).toBe("#cfa562");
  });

  it("direct canonical wins over alias when source defines both", () => {
    const yaml = [
      "name: Conflict",
      "colors:",
      '  bg: "#111"',
      '  background: "#222"',
    ].join("\n");
    const cs = parseColorsetYaml(yaml);
    // The canonical key wins; the alias value is preserved in extras so the
    // theme can still reference {{bg}} in prose if it wants.
    expect(cs.colors.background).toBe("#222");
    expect(cs.extras?.bg).toBe("#111");
  });

  it("applies the same alias resolution to colorsDark", () => {
    const yaml = [
      "name: WithDark",
      "colors:",
      '  bg: "#fff"',
      '  fg: "#111"',
      "colorsDark:",
      '  bg: "#000"',
      '  fg: "#fff"',
    ].join("\n");
    const cs = parseColorsetYaml(yaml);
    expect(cs.colors.background).toBe("#fff");
    expect(cs.colorsDark?.background).toBe("#000");
    expect(cs.colorsDark?.["text-primary"]).toBe("#fff");
  });
});

describe("composeDesignMd derives canonical defaults", () => {
  // composeDesignMd should never emit a design.md missing a canonical slot:
  // text-disabled / warning / success / error / neutral all derive from
  // either sibling tokens or hardcoded fallbacks.

  it("fills missing state colors with hardcoded fallbacks", () => {
    const cs = parseColorsetYaml(
      ["name: Sparse", "colors:", '  background: "#fff"', '  text-primary: "#111"'].join("\n")
    );
    const out = composeDesignMd("---\nname: T\n---\n\nBody.", cs);
    expect(out).toMatch(/warning: "#f59e0b"/);
    expect(out).toMatch(/success: "#22c55e"/);
    expect(out).toMatch(/error: "#ef4444"/);
    expect(out).toMatch(/neutral: "#6b7280"/);
    expect(out).toMatch(/text-disabled: "#9ca3af"/);
  });

  it("cross-fills primary ↔ accent when only one is defined", () => {
    const csOnlyAccent = parseColorsetYaml(
      ["name: A", "colors:", '  accent: "#ff0000"'].join("\n")
    );
    const outA = composeDesignMd("---\nname: T\n---\n\n{{primary}} {{accent}}", csOnlyAccent);
    expect(outA).toContain("#ff0000 #ff0000");

    const csOnlyPrimary = parseColorsetYaml(
      ["name: B", "colors:", '  primary: "#00ff00"'].join("\n")
    );
    const outB = composeDesignMd("---\nname: T\n---\n\n{{primary}} {{accent}}", csOnlyPrimary);
    expect(outB).toContain("#00ff00 #00ff00");
  });

  it("derives text-disabled from text-secondary when omitted", () => {
    const cs = parseColorsetYaml(
      ["name: T", "colors:", '  text-primary: "#111"', '  text-secondary: "#777"'].join("\n")
    );
    const out = composeDesignMd("---\nname: T\n---\n\n{{text-disabled}}", cs);
    expect(out).toContain("#777");
  });

  it("emits an extras: block in the frontmatter", () => {
    const cs = parseColorsetYaml(
      [
        "name: Themed",
        "colors:",
        '  background: "#000"',
        "extras:",
        '  dial-chassis: "#222"',
      ].join("\n")
    );
    const out = composeDesignMd("---\nname: T\n---\n\nBody.", cs);
    expect(out).toMatch(/extras:\n {2}dial-chassis: "#222"/);
  });

  it("resolves {{legacy-token}} in prose via the alias map", () => {
    // A theme.md authored against the old vocabulary keeps working: the
    // substituter falls back to the alias map when the literal name isn't
    // in either colors or extras.
    const cs = parseColorsetYaml(
      ["name: T", "colors:", '  background: "#abcdef"', '  text-primary: "#fedcba"'].join("\n")
    );
    const out = composeDesignMd(
      "---\nname: T\n---\n\n{{bg}} on {{fg}}",
      cs
    );
    expect(out).toContain("#abcdef on #fedcba");
  });

  it("resolves {{extra-token}} from the extras bucket", () => {
    const cs = parseColorsetYaml(
      ["name: T", "colors:", '  background: "#000"', "extras:", '  dial-led-active: "#0f0"'].join(
        "\n"
      )
    );
    const out = composeDesignMd("---\nname: T\n---\n\nLED `{{dial-led-active}}`.", cs);
    expect(out).toContain("`#0f0`");
  });
});

describe("composeDesignMd appends token-discipline block", () => {
  // The generic system-prompt.md tells the LLM to use Tailwind bracket
  // notation with hex literals (e.g. `bg-[#242424]`). When a theme is active
  // we override that by appending a concrete :root block + classNames
  // example so the model has the operative instruction in front of it.

  it("emits a :root block listing every canonical variable", () => {
    const cs = parseColorsetYaml(
      [
        "name: Broadsheet",
        "colors:",
        '  background: "#ffffff"',
        '  text-primary: "#111111"',
        '  text-secondary: "#666666"',
        '  accent: "#666666"',
        '  border: "#cccccc"',
      ].join("\n")
    );
    const out = composeDesignMd("---\nname: Broadsheet\n---\n\nBody.", cs);
    expect(out).toContain("Required CSS variables");
    expect(out).toContain("--background: #ffffff");
    expect(out).toContain("--text-primary: #111111");
    expect(out).toContain("--text-secondary: #666666");
    expect(out).toContain("--accent: #666666");
    expect(out).toContain("--border: #cccccc");
  });

  it("classNames example references var(--token), never hex literals", () => {
    const cs = parseColorsetYaml(
      ["name: T", "colors:", '  background: "#fff"', '  text-primary: "#111"'].join("\n")
    );
    const out = composeDesignMd("---\nname: T\n---\n\nBody.", cs);
    expect(out).toContain("bg-[var(--background)]");
    expect(out).toContain("bg-[var(--text-primary)]");
    // The example block must not regress to hex literals inside `bg-[#...]`.
    const exampleBlock = out.slice(out.indexOf("Example `classNames`"));
    expect(exampleBlock).not.toMatch(/bg-\[#[0-9a-fA-F]/);
  });

  it("emits @prefers-color-scheme: dark when colorsDark is provided", () => {
    const cs = parseColorsetYaml(
      [
        "name: T",
        "colors:",
        '  background: "#fff"',
        "colorsDark:",
        '  background: "#000"',
      ].join("\n")
    );
    const out = composeDesignMd("---\nname: T\n---\n\nBody.", cs);
    expect(out).toContain("@media (prefers-color-scheme: dark)");
    expect(out).toContain("--background: #000");
  });

  it("omits the dark @media block when there is no colorsDark", () => {
    const cs = parseColorsetYaml(
      ["name: T", "colors:", '  background: "#fff"'].join("\n")
    );
    const out = composeDesignMd("---\nname: T\n---\n\nBody.", cs);
    expect(out).not.toContain("prefers-color-scheme: dark");
  });

  it("strips extras from the LLM-facing :root so palette swaps fully restyle the app", () => {
    // Extras baked into the app's :root can't be overridden by a future
    // palette swap (the new palette doesn't define those names), so the
    // discipline block emits canonical+structural only. The frontmatter
    // still surfaces the extras for theme context.
    const cs = parseColorsetYaml(
      [
        "name: T",
        "colors:",
        '  background: "#000"',
        "extras:",
        '  dial-led-active: "#0f0"',
      ].join("\n")
    );
    const out = composeDesignMd("---\nname: T\n---\n\nBody.", cs);
    const disciplineStart = out.indexOf("Required CSS variables");
    const disciplineBlock = out.slice(disciplineStart);
    expect(disciplineBlock).not.toContain("--dial-led-active");
    // The forbidding instruction must be in the prose so the LLM understands
    // why and doesn't smuggle bespoke tokens back in.
    expect(disciplineBlock).toContain("DO NOT introduce theme-specific tokens");
  });

  it("strips the legacy ## Colors section so it can't contradict the canonical block", () => {
    // Pre-canonical theme .md files list their old tokens here with hardcoded
    // oklch values. Leaving it in lets the LLM mix Carbon's old palette into
    // the active Atelier colorset whenever theme ≠ colorTheme.
    const structural = [
      "---",
      "name: Carbon Panel",
      "---",
      "",
      "## Brand & Style",
      "",
      "Description goes here.",
      "",
      "## Colors",
      "",
      "- **bg** (oklch(0.18 0.005 285)): Use for backgrounds.",
      "- **card** (oklch(0.25 0.005 285)): Use for supporting UI.",
      "- **accent-amber** (oklch(0.79 0.18 75)): Use for primary actions.",
      "",
      "## Typography",
      "",
      "Primary body font: sans-serif.",
    ].join("\n");
    const cs = parseColorsetYaml(
      ["name: Atelier", "colors:", '  background: "#ffefdd"'].join("\n")
    );
    const out = composeDesignMd(structural, cs);
    expect(out).not.toContain("oklch(0.18 0.005 285)");
    expect(out).not.toContain("accent-amber");
    expect(out).not.toMatch(/## Colors\n/);
    // The neighboring sections must survive the strip.
    expect(out).toContain("## Brand & Style");
    expect(out).toContain("## Typography");
  });

  it("orders the discipline block as the final operative instruction", () => {
    // The model reads the design.md top-to-bottom; recency biases compliance.
    // The discipline block MUST be the last section so the literal :root
    // overrides any prose interpretation earlier in the body.
    const cs = parseColorsetYaml(
      ["name: T", "colors:", '  background: "#abc"'].join("\n")
    );
    const out = composeDesignMd("---\nname: T\n---\n\n## Brand\n\nProse.", cs);
    const disciplineIdx = out.indexOf("Required CSS variables");
    const brandIdx = out.indexOf("## Brand");
    expect(disciplineIdx).toBeGreaterThan(brandIdx);
    // VERBATIM enforcement language must be present.
    expect(out).toContain("VERBATIM");
  });

  it("explicitly forbids inventing a dark @media block when none is provided", () => {
    const cs = parseColorsetYaml(
      ["name: T", "colors:", '  background: "#fff"'].join("\n")
    );
    const out = composeDesignMd("---\nname: T\n---\n\nBody.", cs);
    expect(out).toContain("Do NOT invent one");
  });
});

describe("renderRootCssBlock", () => {
  // Public helper used by the regenerate-with-palette flow to embed the
  // literal :root block in the user message. Must stay byte-stable so the
  // LLM-facing prompt and the design.md discipline block agree.

  it("emits a :root block with every canonical variable, plus dark @media when colorsDark is set", () => {
    const cs = parseColorsetYaml(
      [
        "name: T",
        "colors:",
        '  background: "#fff"',
        '  text-primary: "#111"',
        "colorsDark:",
        '  background: "#000"',
        '  text-primary: "#eee"',
      ].join("\n")
    );
    const block = renderRootCssBlock(cs);
    expect(block).toMatch(/^:root \{/);
    expect(block).toContain("--background: #fff;");
    expect(block).toContain("--text-primary: #111;");
    expect(block).toContain("@media (prefers-color-scheme: dark)");
    expect(block).toContain("--background: #000;");
  });

  it("omits the dark @media block when no colorsDark or extrasDark is present", () => {
    const cs = parseColorsetYaml(["name: T", "colors:", '  background: "#fff"'].join("\n"));
    expect(renderRootCssBlock(cs)).not.toContain("prefers-color-scheme: dark");
  });

  it("includes extras alongside canonical variables by default (live runtime path)", () => {
    const cs = parseColorsetYaml(
      ["name: T", "colors:", '  background: "#000"', "extras:", '  dial-led-active: "#0f0"'].join(
        "\n"
      )
    );
    const block = renderRootCssBlock(cs);
    expect(block).toContain("--background: #000;");
    expect(block).toContain("--dial-led-active: #0f0;");
  });

  it("strips extras when includeExtras=false (LLM-facing path)", () => {
    // The regenerate-with-palette and discipline-block paths both pass
    // {includeExtras:false} so the LLM never bakes bespoke tokens into the
    // app's :root — those would defeat future palette swaps.
    const cs = parseColorsetYaml(
      [
        "name: T",
        "colors:",
        '  background: "#000"',
        "extras:",
        '  gold-base: "#fc0"',
        '  stone-dark: "#222"',
        "structural:",
        '  radius: "0.75rem"',
        "structuralExtras:",
        '  shadow-deep: "0 4px 0 #000"',
      ].join("\n")
    );
    const block = renderRootCssBlock(cs, { includeExtras: false });
    // Canonical + structural canonical present.
    expect(block).toContain("--background: #000;");
    expect(block).toContain("--radius: 0.75rem;");
    // Extras (color + structural) absent.
    expect(block).not.toContain("--gold-base");
    expect(block).not.toContain("--stone-dark");
    expect(block).not.toContain("--shadow-deep");
  });
});

describe("structural (mode-agnostic) tokens", () => {
  // Structural tokens (typography, spacing, radius, border) flow through the
  // same canonical/extras split as colors, but live in their own block and
  // are emitted into the unconditional `:root` (no dark @media variant).

  it("reads a structural: block into canonical + extras buckets", () => {
    const yaml = [
      "name: T",
      "colors:",
      '  background: "#fff"',
      "structural:",
      '  font-family: "Inter, sans-serif"',
      '  radius: "0.75rem"',
      '  font-display: "Playfair Display, serif"', // non-canonical → extras
    ].join("\n");
    const cs = parseColorsetYaml(yaml);
    expect(cs.structural?.["font-family"]).toBe("Inter, sans-serif");
    expect(cs.structural?.radius).toBe("0.75rem");
    expect(cs.structural?.["font-display"]).toBeUndefined();
    expect(cs.structuralExtras?.["font-display"]).toBe("Playfair Display, serif");
  });

  it("renderRootCssBlock emits structural variables in :root (not in dark @media)", () => {
    const cs = parseColorsetYaml(
      [
        "name: T",
        "colors:",
        '  background: "#fff"',
        "colorsDark:",
        '  background: "#000"',
        "structural:",
        '  font-family: "Inter, sans-serif"',
        '  radius: "0.75rem"',
      ].join("\n")
    );
    const block = renderRootCssBlock(cs);
    expect(block).toContain('--font-family: Inter, sans-serif;');
    expect(block).toContain("--radius: 0.75rem;");
    // Structural must NOT appear inside the dark @media block since they
    // don't flip on theme.
    const darkSection = block.slice(block.indexOf("@media"));
    expect(darkSection).not.toContain("--font-family");
    expect(darkSection).not.toContain("--radius:");
  });

  it("fills the 8 canonical structural slots with defaults when yaml omits them", () => {
    const cs = parseColorsetYaml(["name: T", "colors:", '  background: "#fff"'].join("\n"));
    const block = renderRootCssBlock(cs);
    for (const token of [
      "font-family",
      "font-family-mono",
      "font-size-base",
      "radius",
      "radius-sm",
      "radius-lg",
      "spacing",
      "border-width",
    ]) {
      expect(block).toContain(`--${token}:`);
    }
  });

  it("composeDesignMd emits a structural: block in frontmatter with derived defaults", () => {
    const cs = parseColorsetYaml(
      ["name: T", "colors:", '  background: "#fff"'].join("\n")
    );
    const out = composeDesignMd("---\nname: T\n---\n\nBody.", cs);
    expect(out).toMatch(/structural:\n {2}font-family:/);
    expect(out).toMatch(/structural:[\s\S]*radius: "0.5rem"/);
  });

  it("discipline block instructs the LLM to use structural Tailwind brackets", () => {
    const cs = parseColorsetYaml(
      ["name: T", "colors:", '  background: "#fff"'].join("\n")
    );
    const out = composeDesignMd("---\nname: T\n---\n\nBody.", cs);
    expect(out).toContain("rounded-[var(--radius)]");
    expect(out).toContain("p-[var(--spacing)]");
    expect(out).toContain("font-[var(--font-family)]");
  });

  it("resolves {{font-family}} / {{radius}} placeholders in prose", () => {
    const cs = parseColorsetYaml(
      [
        "name: T",
        "colors:",
        '  background: "#fff"',
        "structural:",
        '  font-family: "Inter, sans-serif"',
        '  radius: "0.75rem"',
      ].join("\n")
    );
    const out = composeDesignMd(
      "---\nname: T\n---\n\nUse `{{font-family}}` and `{{radius}}`.",
      cs
    );
    expect(out).toContain("`Inter, sans-serif`");
    expect(out).toContain("`0.75rem`");
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
