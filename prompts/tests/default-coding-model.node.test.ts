import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// #1474 — DEFAULT_CODING_MODEL is resolved from the DEFAULT_CODING_MODEL env var
// at module load, falling back to the hardcoded literal. We reset the module
// registry between cases so each import re-reads the environment.
describe("DEFAULT_CODING_MODEL env override (#1474)", () => {
  let original: string | undefined;

  beforeEach(() => {
    original = process.env.DEFAULT_CODING_MODEL;
    vi.resetModules();
  });

  afterEach(() => {
    if (original === undefined) delete process.env.DEFAULT_CODING_MODEL;
    else process.env.DEFAULT_CODING_MODEL = original;
    vi.resetModules();
  });

  it("falls back to the hardcoded default when the env var is unset", async () => {
    delete process.env.DEFAULT_CODING_MODEL;
    vi.resetModules();
    const mod = await import("../pkg/prompts.js");
    expect(mod.DEFAULT_CODING_MODEL_FALLBACK).toBe("anthropic/claude-opus-4.5");
    expect(mod.DEFAULT_CODING_MODEL).toBe("anthropic/claude-opus-4.5");
  });

  it("honors the env override when the env var is set", async () => {
    process.env.DEFAULT_CODING_MODEL = "anthropic/claude-opus-4.8";
    vi.resetModules();
    const mod = await import("../pkg/prompts.js");
    expect(mod.DEFAULT_CODING_MODEL).toBe("anthropic/claude-opus-4.8");
    // The literal fallback constant is unchanged.
    expect(mod.DEFAULT_CODING_MODEL_FALLBACK).toBe("anthropic/claude-opus-4.5");
  });
});
