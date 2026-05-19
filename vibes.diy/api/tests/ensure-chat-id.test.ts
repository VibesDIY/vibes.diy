import { describe, it, expect } from "vitest";
import { preAllocEligible } from "../svc/intern/ensure-chat-id.js";

describe("preAllocEligible", () => {
  it("runs pre-allocation when prompt is present without appSlug", () => {
    expect(preAllocEligible({ prompt: "make a todo app" })).toBe(true);
  });

  it("runs pre-allocation even when appSlug is also provided", () => {
    // Regression #1820: --app-slug was blocking theme/skill pre-allocation for new apps.
    // Pre-alloc eligibility depends only on the prompt being present, not the slug.
    expect(preAllocEligible({ prompt: "make a todo app", appSlug: "my-todo-app" })).toBe(true);
  });

  it("skips pre-allocation when prompt is absent", () => {
    expect(preAllocEligible({ appSlug: "my-app" })).toBe(false);
  });

  it("skips pre-allocation when prompt is empty", () => {
    expect(preAllocEligible({ prompt: "" })).toBe(false);
  });
});
