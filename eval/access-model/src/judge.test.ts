import { describe, it, expect } from "vitest";
import { judgeSecondVisitor } from "./judge.js";

describe("judgeSecondVisitor", () => {
  it("returns the structured verdict from the model", async () => {
    const fakeCall = async () => ({ secondVisitorCanAct: true, reason: "second handle adds its own todos" });
    const v = await judgeSecondVisitor({ prompt: "A todo list app", expect: "per-visitor",
      files: { "App.jsx": "x", "access.js": "y" } }, { call: fakeCall, model: "m", endpoint: "e", apiKey: "k" });
    expect(v).toEqual({ secondVisitorCanAct: true, reason: "second handle adds its own todos" });
  });
  it("degrades to null on judge failure", async () => {
    const boom = async () => { throw new Error("429"); };
    const v = await judgeSecondVisitor({ prompt: "p", expect: "per-object", files: { "App.jsx": "x", "access.js": "y" } },
      { call: boom, model: "m", endpoint: "e", apiKey: "k", maxAttempts: 1 });
    expect(v).toBeNull();
  });
});
