import { describe, it, expect } from "vitest";
import { parseDevVars, buildFeaturePrompt, buildDesignPrompt } from "./judge.js";

describe("parseDevVars", () => {
  it("extracts the LLM url + key", () => {
    const text = "FOO=bar\nLLM_BACKEND_URL=https://llm.example/v1/chat\nLLM_BACKEND_API_KEY=sk-123\n";
    expect(parseDevVars(text)).toEqual({ llmUrl: "https://llm.example/v1/chat", llmKey: "sk-123" });
  });
  it("throws when missing", () => {
    expect(() => parseDevVars("FOO=bar")).toThrow(/LLM_BACKEND/);
  });
});

describe("buildFeaturePrompt", () => {
  it("includes the user prompt and the App.jsx source", () => {
    const p = buildFeaturePrompt("build a todo", { "App.jsx": "export default function App(){}" });
    expect(p).toContain("build a todo");
    expect(p).toContain("export default function App");
  });
});

describe("buildDesignPrompt", () => {
  it("references the user prompt and the design dimensions", () => {
    const p = buildDesignPrompt("build a synth");
    expect(p).toContain("build a synth");
    expect(p).toMatch(/layout|hierarchy|contrast/i);
  });
});
