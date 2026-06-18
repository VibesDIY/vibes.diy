import { describe, it, expect } from "vitest";
import {
  buildEmbedSnippet,
  RUNTIME_PREVIEW_IFRAME_ALLOW,
  RUNTIME_PREVIEW_IFRAME_SANDBOX,
} from "../../pkg/app/lib/iframe-policy.js";

describe("buildEmbedSnippet", () => {
  const snippet = buildEmbedSnippet({
    embedUrl: "https://vibes.diy/embed/alice/myapp",
    title: "myapp — made on vibes.diy",
  });

  it("points the iframe at the embed URL", () => {
    expect(snippet).toContain(`src="https://vibes.diy/embed/alice/myapp"`);
  });

  // The whole point of generating the snippet from shared constants: the pasted
  // markup must never drift from the policy the live runtime iframe runs under.
  it("uses the exact shared sandbox + allow policy tokens", () => {
    expect(snippet).toContain(`sandbox="${RUNTIME_PREVIEW_IFRAME_SANDBOX}"`);
    expect(snippet).toContain(`allow="${RUNTIME_PREVIEW_IFRAME_ALLOW}"`);
  });

  it("is responsive and lazy by default", () => {
    expect(snippet).toContain("width:100%");
    expect(snippet).toContain("aspect-ratio:16/9");
    expect(snippet).toContain(`loading="lazy"`);
  });

  it("escapes double quotes in the title so it can't break out of the attribute", () => {
    const evil = buildEmbedSnippet({ embedUrl: "https://x/embed/a/b", title: 'a"b' });
    expect(evil).toContain(`title="a&quot;b"`);
    expect(evil).not.toContain(`title="a"b"`);
  });
});
