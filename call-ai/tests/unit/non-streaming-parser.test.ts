import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { NonStreamingOpenRouterParser, ParserEvent, OrMeta, OrDelta, OrDone, OrUsage, OrJson } from "@vibes.diy/call-ai-base";

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

    it("should emit correct events", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: ParserEvent[] = [];
      parser.onEvent((evt) => events.push(evt));
      parser.parse(JSON.parse(fixture));

      const meta = events.find((e) => e.type === "or.meta") as OrMeta;
      const delta = events.find((e) => e.type === "or.delta") as OrDelta;
      const done = events.find((e) => e.type === "or.done") as OrDone;
      const usage = events.find((e) => e.type === "or.usage") as OrUsage;
      const jsonEvent = events.find((e) => e.type === "or.json") as OrJson;

      expect(meta).toBeDefined();
      expect(meta.model).toBe("meta-llama/llama-3.3-70b-instruct");
      expect(meta.provider).toBe("SambaNova");

      expect(delta).toBeDefined();
      expect(delta.content).toContain("Hitchhiker's Guide");
      expect(delta.content).toContain("Douglas Adams");
      expect(delta.seq).toBe(0);

      expect(done).toBeDefined();
      expect(done.finishReason).toBe("stop");

      expect(usage).toBeDefined();
      expect(usage.promptTokens).toBe(21);
      expect(usage.completionTokens).toBe(79);
      expect(usage.totalTokens).toBe(100);

      expect(jsonEvent).toBeDefined();
      const raw = jsonEvent.json as Record<string, unknown>;
      expect(raw.model).toBe("meta-llama/llama-3.3-70b-instruct");
    });
  });

  describe("DeepSeek response parsing", () => {
    const fixture = fs.readFileSync(path.join(fixturesDir, "deepseek-response.json"), "utf8");

    it("should parse DeepSeek response correctly", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: ParserEvent[] = [];
      parser.onEvent((evt) => events.push(evt));
      parser.parse(JSON.parse(fixture));

      const meta = events.find((e) => e.type === "or.meta") as OrMeta;
      const delta = events.find((e) => e.type === "or.delta") as OrDelta;
      const done = events.find((e) => e.type === "or.done") as OrDone;
      const usage = events.find((e) => e.type === "or.usage") as OrUsage;

      expect(meta).toBeDefined();
      expect(meta.model).toBe("deepseek/deepseek-chat");
      expect(meta.provider).toBe("Nebius");

      expect(delta).toBeDefined();
      expect(delta.content).toContain("The Alchemist");

      expect(done).toBeDefined();
      expect(done.finishReason).toBe("stop");

      expect(usage).toBeDefined();
      expect(usage.totalTokens).toBe(98);
    });
  });

  describe("Gemini response parsing", () => {
    const fixture = fs.readFileSync(path.join(fixturesDir, "gemini-response.json"), "utf8");

    it("should parse Gemini response correctly", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: ParserEvent[] = [];
      parser.onEvent((evt) => events.push(evt));
      parser.parse(JSON.parse(fixture));

      const meta = events.find((e) => e.type === "or.meta") as OrMeta;
      const delta = events.find((e) => e.type === "or.delta") as OrDelta;

      expect(meta).toBeDefined();
      expect(meta.model).toBe("google/gemini-2.0-flash-001");
      expect(meta.provider).toBe("Google");

      expect(delta).toBeDefined();
      const parsed = JSON.parse(delta.content);
      expect(parsed.author).toBe("Ursula K. Le Guin");
    });
  });

  describe("Event order", () => {
    const fixture = fs.readFileSync(path.join(fixturesDir, "llama3-response.json"), "utf8");

    it("should emit events in correct order: json, meta, delta, done, usage, stream-end", () => {
      const parser = new NonStreamingOpenRouterParser();
      const eventTypes: string[] = [];

      parser.onEvent((evt) => eventTypes.push(evt.type));
      parser.parse(JSON.parse(fixture));

      expect(eventTypes).toEqual(["or.json", "or.meta", "or.delta", "or.done", "or.usage", "or.stream-end"]);
    });
  });

  describe("Edge cases", () => {
    it("should handle response without usage", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: ParserEvent[] = [];

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
      const events: ParserEvent[] = [];

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
      const events: ParserEvent[] = [];

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
