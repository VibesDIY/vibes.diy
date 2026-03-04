import * as mod from "@vibes.diy/prompts";
import { describe, expect, it, vi } from "vitest";
import { Result } from "@adviser/cement";
import { createMockFetchFromPkgFiles } from "./helpers/load-mock-data.js";

const opts = {
  fetch: createMockFetchFromPkgFiles(),
  callAi: {
    ModuleAndOptionsSelection: vi.fn().mockResolvedValue(
      Result.Ok(
        JSON.stringify({
          choices: [{ message: { content: "Mocked response" } }],
        })
      )
    ),
  },
};

describe("makeBaseSystemPrompt dependency selection", () => {
  it("when override is false/absent, uses schema-driven selection (test mode => all); includes core libs", async () => {
    const result = await mod.makeBaseSystemPrompt("anthropic/claude-sonnet-4.5", {
      ...opts,
      _id: "user_settings",
    });
    // Should include at least the core libs
    expect(result.systemPrompt).toMatch(/<useFireproof-docs>/);
    expect(result.systemPrompt).toMatch(/<callAI-docs>/);
    // Should include corresponding import lines
    expect(result.systemPrompt).toMatch(/import\s+\{\s*useFireproof\s*\}\s+from\s+"use-fireproof"/);
    expect(result.systemPrompt).toMatch(/import\s+\{\s*callAI\s*\}\s+from\s+"call-ai"/);
  });

  it("honors explicit dependencies only when override=true", async () => {
    const result = await mod.makeBaseSystemPrompt("anthropic/claude-sonnet-4.5", {
      _id: "user_settings",
      dependencies: ["fireproof"],
      dependenciesUserOverride: true,
      ...opts,
    });
    expect(result.systemPrompt).toMatch(/<useFireproof-docs>/);
    expect(result.systemPrompt).not.toMatch(/<callAI-docs>/);
    // Import statements reflect chosen modules only
    expect(result.systemPrompt).toMatch(/import\s+\{\s*useFireproof\s*\}\s+from\s+"use-fireproof"/);
    expect(result.systemPrompt).not.toMatch(/from\s+"call-ai"/);
  });

  it("ignores explicit dependencies when override=false (still schema-driven)", async () => {
    const result = await mod.makeBaseSystemPrompt("anthropic/claude-sonnet-4.5", {
      _id: "user_settings",
      dependencies: ["fireproof"],
      dependenciesUserOverride: false,
      ...opts,
    });
    // Should include at least both core libs
    expect(result.systemPrompt).toMatch(/<useFireproof-docs>/);
    expect(result.systemPrompt).toMatch(/<callAI-docs>/);
  });
});
