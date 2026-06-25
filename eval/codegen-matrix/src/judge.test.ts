import { describe, it, expect } from "vitest";
import { parseDevVars, resolveDevVars, buildFeaturePrompt, buildDesignPrompt, parseJudge } from "./judge.js";

describe("parseDevVars", () => {
  it("extracts the LLM url + key", () => {
    const text = "FOO=bar\nLLM_BACKEND_URL=https://llm.example/v1/chat\nLLM_BACKEND_API_KEY=sk-123\n";
    expect(parseDevVars(text)).toEqual({ llmUrl: "https://llm.example/v1/chat", llmKey: "sk-123" });
  });
  it("throws when missing", () => {
    expect(() => parseDevVars("FOO=bar")).toThrow(/LLM_BACKEND/);
  });
});

describe("resolveDevVars", () => {
  const fileText = "LLM_BACKEND_URL=https://file.example\nLLM_BACKEND_API_KEY=sk-file";

  it("uses env vars when set (cloud agent env, no .dev.vars file)", () => {
    const env = { LLM_BACKEND_URL: "https://env.example", LLM_BACKEND_API_KEY: "sk-env" };
    expect(resolveDevVars(env, undefined)).toEqual({ llmUrl: "https://env.example", llmKey: "sk-env" });
  });

  it("prefers env vars over the file when both are present", () => {
    const env = { LLM_BACKEND_URL: "https://env.example", LLM_BACKEND_API_KEY: "sk-env" };
    expect(resolveDevVars(env, fileText).llmUrl).toBe("https://env.example");
  });

  it("falls back to the file when env vars are absent (local dev)", () => {
    expect(resolveDevVars({}, fileText)).toEqual({ llmUrl: "https://file.example", llmKey: "sk-file" });
  });

  it("ignores a partial env (only one of the two set) and falls back to the file", () => {
    expect(resolveDevVars({ LLM_BACKEND_URL: "https://env.example" }, fileText).llmUrl).toBe("https://file.example");
  });

  it("throws a clear error when neither env nor file provides the keys", () => {
    expect(() => resolveDevVars({}, undefined)).toThrow(/environment variables.*\.dev\.vars/s);
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

describe("parseJudge", () => {
  it("names the /chat/completions cause when the body is HTML", () => {
    const r = parseJudge("<!DOCTYPE html>\n<html><body>Not Found</body></html>");
    expect(r.score).toBeNull();
    expect(r.reason).toMatch(/chat\/completions/);
  });
  it("names the cause when the body is empty", () => {
    const r = parseJudge("");
    expect(r.score).toBeNull();
    expect(r.reason).toMatch(/chat\/completions/);
  });
  it("parses a well-formed judge object", () => {
    const r = parseJudge(`{"score":4,"reason":"good"}`);
    expect(r.score).toBe(4);
    expect(r.reason).toBe("good");
  });
  it("returns the actionable reason without throwing when raw is undefined", () => {
    const r = parseJudge(undefined);
    expect(r.score).toBeNull();
    expect(r.reason).toMatch(/chat\/completions/);
  });
});
