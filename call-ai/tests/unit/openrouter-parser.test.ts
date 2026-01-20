import { readFileSync } from "node:fs";

import { OpenRouterParser } from "@vibes.diy/call-ai-base";
import { describe, it, expect, vi } from "vitest";

import { feedFixtureRandomly } from "./test-utils.js";
import { OrDelta, OrDone, OrMeta, OrUsage } from "@vibes.diy/call-ai-base";

const openAiStreamFixture = readFileSync(new URL("./fixtures/openai-stream-response.json", import.meta.url), "utf8");

const fireproofStreamFixture = readFileSync(
  new URL("../integration/fixtures/openai-fireproof-stream-response.txt", import.meta.url),
  "utf8",
);

// Helper to create a parser
function createOpenRouterParser() {
  return new OpenRouterParser();
}

describe("OpenRouterParser", () => {
  it("emits delta events for content", () => {
    const parser = createOpenRouterParser();
    const deltas: OrDelta[] = [];
    parser.onEvent((evt) => {
      if (evt.type === "or.delta") deltas.push(evt);
    });

    parser.processChunk(
      'data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,"system_fingerprint":"fp","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"}}]}\n',
    );

    expect(deltas).toHaveLength(1);
    expect(deltas[0].content).toBe("Hello");
    expect(deltas[0].seq).toBe(0);
  });

  it("emits meta on first chunk", () => {
    const parser = createOpenRouterParser();
    const metas: OrMeta[] = [];
    parser.onEvent((evt) => {
      if (evt.type === "or.meta") metas.push(evt);
    });

    parser.processChunk(
      'data: {"id":"gen-123","provider":"OpenAI","model":"openai/gpt-4o","created":1742583676,"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}\n',
    );

    expect(metas).toHaveLength(1);
    expect(metas[0]).toMatchObject({
      type: "or.meta",
      id: "gen-123",
      provider: "OpenAI",
      model: "openai/gpt-4o",
      created: 1742583676,
      systemFingerprint: "fp_test",
    });
  });

  it("emits meta only once", () => {
    const parser = createOpenRouterParser();
    const metas: OrMeta[] = [];
    parser.onEvent((evt) => {
      if (evt.type === "or.meta") metas.push(evt);
    });

    parser.processChunk(
      'data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,"system_fingerprint":"fp","choices":[{"delta":{"content":"A"}}]}\n',
    );
    parser.processChunk(
      'data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,"system_fingerprint":"fp","choices":[{"delta":{"content":"B"}}]}\n',
    );

    expect(metas).toHaveLength(1);
  });

  it("emits usage on final chunk", () => {
    const parser = createOpenRouterParser();
    const usages: OrUsage[] = [];
    parser.onEvent((evt) => {
      if (evt.type === "or.usage") usages.push(evt);
    });

    parser.processChunk(
      'data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,"system_fingerprint":"fp","choices":[{"delta":{"content":""}}],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30,"cost":0.001}}\n',
    );

    expect(usages).toHaveLength(1);
    expect(usages[0]).toMatchObject({
      type: "or.usage",
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      cost: 0.001,
    });
  });

  it("emits done with finish_reason", () => {
    const parser = createOpenRouterParser();
    const dones: OrDone[] = [];
    parser.onEvent((evt) => {
      if (evt.type === "or.done") dones.push(evt);
    });

    parser.processChunk(
      'data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,"system_fingerprint":"fp","choices":[{"delta":{"content":""},"finish_reason":"stop"}]}\n',
    );

    expect(dones).toHaveLength(1);
    expect(dones[0]).toMatchObject({
      type: "or.done",
      finishReason: "stop",
    });
  });

  it("handles empty content deltas (no event)", () => {
    const parser = createOpenRouterParser();
    const deltas: OrDelta[] = [];
    parser.onEvent((evt) => {
      if (evt.type === "or.delta") deltas.push(evt);
    });

    parser.processChunk(
      'data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,"system_fingerprint":"fp","choices":[{"delta":{"role":"assistant","content":""}}]}\n',
    );

    expect(deltas).toHaveLength(0);
  });

  it("increments seq for each delta", () => {
    const parser = createOpenRouterParser();
    const deltas: OrDelta[] = [];
    parser.onEvent((evt) => {
      if (evt.type === "or.delta") deltas.push(evt);
    });

    parser.processChunk(
      'data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,"system_fingerprint":"fp","choices":[{"delta":{"content":"A"}}]}\n',
    );
    parser.processChunk(
      'data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,"system_fingerprint":"fp","choices":[{"delta":{"content":"B"}}]}\n',
    );
    parser.processChunk(
      'data: {"id":"gen-1","provider":"OpenAI","model":"gpt-4","created":123,"system_fingerprint":"fp","choices":[{"delta":{"content":"C"}}]}\n',
    );

    expect(deltas.map((d) => d.seq)).toEqual([0, 1, 2]);
    expect(deltas.map((d) => d.content)).toEqual(["A", "B", "C"]);
  });

  describe("with fixtures (random chunking)", () => {
    it("extracts all deltas from openai-stream fixture", () => {
      const parser = createOpenRouterParser();
      const deltas: OrDelta[] = [];
      const metas: OrMeta[] = [];
      const usages: OrUsage[] = [];
      const dones: OrDone[] = [];

      parser.onEvent((evt) => {
        switch (evt.type) {
          case "or.delta":
            deltas.push(evt);
            break;
          case "or.meta":
            metas.push(evt);
            break;
          case "or.usage":
            usages.push(evt);
            break;
          case "or.done":
            dones.push(evt);
            break;
        }
      });

      feedFixtureRandomly(parser, openAiStreamFixture, { seed: 12345 });

      // Should have metadata
      expect(metas).toHaveLength(1);
      expect(metas[0].provider).toBe("OpenAI");
      expect(metas[0].model).toBe("openai/gpt-4o");

      // Should have deltas (some chunks have empty content)
      expect(deltas.length).toBeGreaterThan(0);

      // Combined content should form valid JSON
      const combinedContent = deltas.map((d) => d.content).join("");
      expect(combinedContent).toContain("title");
      expect(combinedContent).toContain("author");

      // Should have usage
      expect(usages).toHaveLength(1);
      expect(usages[0].promptTokens).toBe(80);
      expect(usages[0].completionTokens).toBe(30);
      expect(usages[0].totalTokens).toBe(110);

      // Should have done
      expect(dones).toHaveLength(1);
      expect(dones[0].finishReason).toBe("stop");
    });

    it("extracts all deltas from fireproof fixture", () => {
      const parser = createOpenRouterParser();
      const deltas: OrDelta[] = [];
      const usages: OrUsage[] = [];

      parser.onEvent((evt) => {
        if (evt.type === "or.delta") deltas.push(evt);
        if (evt.type === "or.usage") usages.push(evt);
      });

      feedFixtureRandomly(parser, fireproofStreamFixture, { seed: 67890 });

      // Should have many deltas
      expect(deltas.length).toBeGreaterThan(100);

      // Combined content should contain expected code
      const combinedContent = deltas.map((d) => d.content).join("");
      expect(combinedContent).toContain("import { useFireproof }");
      expect(combinedContent).toContain("function App()");

      // Should have usage with cost
      expect(usages).toHaveLength(1);
      expect(usages[0].cost).toBeDefined();
    });
  });
});
