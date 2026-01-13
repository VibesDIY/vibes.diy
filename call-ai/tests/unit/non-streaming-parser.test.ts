import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { NonStreamingOpenRouterParser, OrEvent } from "../../pkg/parser/index.js";

/**
 * NonStreamingOpenRouterParser Tests
 *
 * Tests parser handling of non-streaming OpenRouter JSON responses using real fixtures.
 * No fetch mocking - tests parser directly with JSON fixtures.
 */

describe("NonStreamingOpenRouterParser", () => {
  const fixturesDir = path.join(__dirname, "../integration/fixtures");

  describe("Llama3 response parsing", () => {
    const fixture = fs.readFileSync(path.join(fixturesDir, "llama3-response.json"), "utf8");

    it("should emit or.meta with model info", () => {
      const parser = new NonStreamingOpenRouterParser();
      let meta: OrEvent | null = null;

      parser.onEvent((evt) => {
        if (evt.type === "or.meta") meta = evt;
      });

      parser.parseString(fixture);

      expect(meta).not.toBeNull();
      expect(meta?.type).toBe("or.meta");
      if (meta?.type === "or.meta") {
        expect(meta.model).toBe("meta-llama/llama-3.3-70b-instruct");
        expect(meta.provider).toBe("SambaNova");
      }
    });

    it("should emit or.delta with content", () => {
      const parser = new NonStreamingOpenRouterParser();
      let delta: OrEvent | null = null;

      parser.onEvent((evt) => {
        if (evt.type === "or.delta") delta = evt;
      });

      parser.parseString(fixture);

      expect(delta).not.toBeNull();
      expect(delta?.type).toBe("or.delta");
      if (delta?.type === "or.delta") {
        expect(delta.content).toContain("Hitchhiker's Guide");
        expect(delta.content).toContain("Douglas Adams");
        expect(delta.seq).toBe(0);
      }
    });

    it("should emit or.done with finish_reason", () => {
      const parser = new NonStreamingOpenRouterParser();
      let done: OrEvent | null = null;

      parser.onEvent((evt) => {
        if (evt.type === "or.done") done = evt;
      });

      parser.parseString(fixture);

      expect(done).not.toBeNull();
      if (done?.type === "or.done") {
        expect(done.finishReason).toBe("stop");
      }
    });

    it("should emit or.usage with token counts", () => {
      const parser = new NonStreamingOpenRouterParser();
      let usage: OrEvent | null = null;

      parser.onEvent((evt) => {
        if (evt.type === "or.usage") usage = evt;
      });

      parser.parseString(fixture);

      expect(usage).not.toBeNull();
      if (usage?.type === "or.usage") {
        expect(usage.promptTokens).toBe(21);
        expect(usage.completionTokens).toBe(79);
        expect(usage.totalTokens).toBe(100);
      }
    });

    it("should emit or.json with raw response", () => {
      const parser = new NonStreamingOpenRouterParser();
      let jsonEvent: OrEvent | null = null;

      parser.onEvent((evt) => {
        if (evt.type === "or.json") jsonEvent = evt;
      });

      parser.parseString(fixture);

      expect(jsonEvent).not.toBeNull();
      if (jsonEvent?.type === "or.json") {
        const raw = jsonEvent.json as Record<string, unknown>;
        expect(raw.model).toBe("meta-llama/llama-3.3-70b-instruct");
      }
    });
  });

  describe("DeepSeek response parsing", () => {
    const fixture = fs.readFileSync(path.join(fixturesDir, "deepseek-response.json"), "utf8");

    it("should parse DeepSeek response correctly", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: OrEvent[] = [];

      parser.onEvent((evt) => events.push(evt));
      parser.parseString(fixture);

      const meta = events.find((e) => e.type === "or.meta");
      const delta = events.find((e) => e.type === "or.delta");
      const done = events.find((e) => e.type === "or.done");
      const usage = events.find((e) => e.type === "or.usage");

      expect(meta?.type).toBe("or.meta");
      if (meta?.type === "or.meta") {
        expect(meta.model).toBe("deepseek/deepseek-chat");
        expect(meta.provider).toBe("Nebius");
      }

      expect(delta?.type).toBe("or.delta");
      if (delta?.type === "or.delta") {
        expect(delta.content).toContain("The Alchemist");
      }

      expect(done?.type).toBe("or.done");
      if (done?.type === "or.done") {
        expect(done.finishReason).toBe("stop");
      }

      expect(usage?.type).toBe("or.usage");
      if (usage?.type === "or.usage") {
        expect(usage.totalTokens).toBe(98);
      }
    });
  });

  describe("Gemini response parsing", () => {
    const fixture = fs.readFileSync(path.join(fixturesDir, "gemini-response.json"), "utf8");

    it("should parse Gemini response correctly", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: OrEvent[] = [];

      parser.onEvent((evt) => events.push(evt));
      parser.parseString(fixture);

      const meta = events.find((e) => e.type === "or.meta");
      const delta = events.find((e) => e.type === "or.delta");

      expect(meta?.type).toBe("or.meta");
      if (meta?.type === "or.meta") {
        expect(meta.model).toBe("google/gemini-2.0-flash-001");
        expect(meta.provider).toBe("Google");
      }

      expect(delta?.type).toBe("or.delta");
      if (delta?.type === "or.delta") {
        // Gemini response contains JSON
        expect(() => JSON.parse(delta.content)).not.toThrow();
        const parsed = JSON.parse(delta.content);
        expect(parsed.author).toBe("Ursula K. Le Guin");
      }
    });
  });

  describe("Event order", () => {
    const fixture = fs.readFileSync(path.join(fixturesDir, "llama3-response.json"), "utf8");

    it("should emit events in correct order: json, meta, delta, done, usage", () => {
      const parser = new NonStreamingOpenRouterParser();
      const eventTypes: string[] = [];

      parser.onEvent((evt) => eventTypes.push(evt.type));
      parser.parseString(fixture);

      expect(eventTypes).toEqual(["or.json", "or.meta", "or.delta", "or.done", "or.usage"]);
    });
  });

  describe("Edge cases", () => {
    it("should handle response without usage", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: OrEvent[] = [];

      const responseWithoutUsage = {
        id: "test-id",
        model: "test-model",
        choices: [{ message: { content: "Hello" }, finish_reason: "stop" }],
      };

      parser.onEvent((evt) => events.push(evt));
      parser.parse(responseWithoutUsage);

      const usage = events.find((e) => e.type === "or.usage");
      expect(usage).toBeUndefined();
    });

    it("should handle empty content", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: OrEvent[] = [];

      const responseWithEmptyContent = {
        id: "test-id",
        model: "test-model",
        choices: [{ message: { content: "" }, finish_reason: "stop" }],
      };

      parser.onEvent((evt) => events.push(evt));
      parser.parse(responseWithEmptyContent);

      const delta = events.find((e) => e.type === "or.delta");
      expect(delta).toBeUndefined();
    });

    it("should handle response without id (no meta emitted)", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: OrEvent[] = [];

      const responseWithoutId = {
        model: "test-model",
        choices: [{ message: { content: "Hello" }, finish_reason: "stop" }],
      };

      parser.onEvent((evt) => events.push(evt));
      parser.parse(responseWithoutId);

      const meta = events.find((e) => e.type === "or.meta");
      expect(meta).toBeUndefined();
    });
  });
});
