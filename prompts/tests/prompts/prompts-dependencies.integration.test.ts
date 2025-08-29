import { describe, it, expect, beforeAll, vi } from "vitest";
import * as mod from "@vibes.diy/prompts";

// Ensure real implementation
// (vi as any).doUnmock?.("~/vibes.diy/app/prompts");
//vi.unmock("~/vibes.diy/app/prompts.js");
vi.resetModules();

// let makeBaseSystemPrompt: typeof mod.makeBaseSystemPrompt;
// let preloadLlmsText: () => Promise<void>;

beforeAll(async () => {
  // const mod = await import("~/vibes.diy/app/prompts.js");
  // makeBaseSystemPrompt = mod.makeBaseSystemPrompt;
  // preloadLlmsText = mod.preloadLlmsText;
});

const opts = {
  fallBackUrl: new URL("https://example.com/fallback"),
  callAiEndpoint: "https://example.com/call-ai",
};

describe("makeBaseSystemPrompt dependency selection", () => {
  it("when override is false/absent, uses schema-driven selection (test mode => all); includes core libs", async () => {
    // await preloadLlmsText();
    const prompt = await mod.makeBaseSystemPrompt("anthropic/claude-sonnet-4", {
      ...opts,
      _id: "user_settings",
    });
    // Should include at least the core libs
    expect(prompt).toMatch(/<useFireproof-docs>/);
    expect(prompt).toMatch(/<callAI-docs>/);
    // Should include corresponding import lines
    expect(prompt).toMatch(
      /import\s+\{\s*useFireproof\s*\}\s+from\s+"use-fireproof"/,
    );
    expect(prompt).toMatch(/import\s+\{\s*callAI\s*\}\s+from\s+"call-ai"/);
  });

  it("honors explicit dependencies only when override=true", async () => {
    // await preloadLlmsText();
    const prompt = await mod.makeBaseSystemPrompt("anthropic/claude-sonnet-4", {
      _id: "user_settings",
      dependencies: ["fireproof"],
      dependenciesUserOverride: true,
      ...opts,
    });
    expect(prompt).toMatch(/<useFireproof-docs>/);
    expect(prompt).not.toMatch(/<callAI-docs>/);
    // Import statements reflect chosen modules only
    expect(prompt).toMatch(
      /import\s+\{\s*useFireproof\s*\}\s+from\s+"use-fireproof"/,
    );
    expect(prompt).not.toMatch(/from\s+"call-ai"/);
  });

  it("ignores explicit dependencies when override=false (still schema-driven)", async () => {
    // await preloadLlmsText();
    const prompt = await mod.makeBaseSystemPrompt("anthropic/claude-sonnet-4", {
      _id: "user_settings",
      dependencies: ["fireproof"],
      dependenciesUserOverride: false,
      ...opts,
    });
    // Should include at least both core libs
    expect(prompt).toMatch(/<useFireproof-docs>/);
    expect(prompt).toMatch(/<callAI-docs>/);
  });
});
