import { describe, it, expect } from "vitest";
import { buildGlobalCSS } from "../../base/theme/global-styles.js";

describe("global CSS snapshot", () => {
  it("output is stable across refactors", () => {
    const css = buildGlobalCSS();
    // Snapshot captures exact output including whitespace
    expect(css).toMatchSnapshot();
  });

  it("contains all expected sections", () => {
    const css = buildGlobalCSS();
    // Verify key CSS rules are present (order-independent)
    expect(css).toContain(":root {");
    expect(css).toContain("@keyframes fadeIn");
    expect(css).toContain("@keyframes bounceIn");
    expect(css).toContain("@keyframes buttonGlimmer");
    expect(css).toContain("@keyframes toast-in");
    expect(css).toContain("@keyframes moving-stripes");
    expect(css).toContain("html { margin: 0; padding: 0; }");
    expect(css).toContain("font-family: \"Inter\"");
    expect(css).toContain("scrollbar-width: thin");
    expect(css).toContain("::-webkit-scrollbar");
    expect(css).toContain("::selection");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("select {");
    expect(css).toContain(".animate-fade-in");
    expect(css).toContain(".accent-00");
    expect(css).toContain(".text-accent-00");
    expect(css).toContain(".decorative-00");
    expect(css).toContain(".bg-primary");
    expect(css).toContain(".light-gradient");
    expect(css).toContain(".ai-markdown p");
    expect(css).toContain(".page-grid-background");
    expect(css).toContain(".vibes-login-button");
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain("--vibes-tc-string");
    expect(css).toContain("--vibes-hover-tint");
  });
});
