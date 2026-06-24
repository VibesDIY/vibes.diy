import { describe, it, expect } from "vitest";
import { guardrailGrep } from "./guardrail.js";

describe("guardrailGrep", () => {
  it("flags added enumerated prohibitions in access guidance", () => {
    const diff = `+ Never gate the core write on the owner role.\n+ Don't use requireRole("owner") for todos.`;
    const r = guardrailGrep(diff);
    expect(r.ok).toBe(false);
    expect(r.hits.length).toBeGreaterThan(0);
  });
  it("flags naming the owner-only anti-pattern", () => {
    expect(guardrailGrep(`+ Avoid the Form-A trap (owner-only writes).`).ok).toBe(false);
  });
  it("passes affirmative shape->model guidance", () => {
    expect(guardrailGrep(`+ A todo app gives every visitor their own private channel: user:\${user.userHandle}.`).ok).toBe(true);
  });
});
