import fs from "fs";
import path from "path";
import { describe, it, expect, vi } from "vitest";
import { OpenRouterParser } from "../../pkg/parser/openrouter-parser.js";
import { createCodeBlockHandler } from "../../pkg/parser/handlers/code-block-handler.js";
import { ParserEvent } from "../../pkg/parser/parser-evento.js";

describe("Parser register style tests", () => {
  const fixture = fs.readFileSync(
    path.join(__dirname, "fixtures/openai-fireproof-stream-response.txt"),
    "utf8"
  );

  it("should emit code events and upstream usage/meta", () => {
    const orParser = new OpenRouterParser();
    orParser.register(createCodeBlockHandler());

    const events = vi.fn();

    // All events come through orParser.onEvent now
    orParser.onEvent((evt: ParserEvent) => {
      switch (evt.type) {
        case "or.meta": events({ type: "meta", payload: evt }); break;
        case "or.usage": events({ type: "usage", payload: evt }); break;
        case "or.done": events({ type: "done", payload: evt }); break;
        case "text.fragment":
        case "code.start":
        case "code.fragment":
        case "code.end":
          events(evt);
          break;
      }
    });

    orParser.processChunk(fixture);

    // Assert meta comes first
    expect(events.mock.calls[0][0]).toMatchObject({
      type: "meta",
      payload: { type: "or.meta", model: "openai/gpt-4o", provider: "OpenAI" },
    });

    // Assert text fragment events for markdown before code
    const textFragments = events.mock.calls.filter((c) => c[0].type === "text.fragment");
    expect(textFragments.length).toBeGreaterThan(0);
    // First text should be start of the response
    expect(textFragments[0][0].fragment).toBe("This");

    // Assert code block events
    const codeStarts = events.mock.calls.filter((c) => c[0].type === "code.start");
    expect(codeStarts.length).toBe(1);
    expect(codeStarts[0][0]).toMatchObject({
      type: "code.start",
      language: "jsx",
    });

    const codeFragments = events.mock.calls.filter((c) => c[0].type === "code.fragment");
    expect(codeFragments.length).toBeGreaterThan(0);
    // Code should contain useFireproof import
    const allCode = codeFragments.map((c) => c[0].fragment).join("");
    expect(allCode).toContain("useFireproof");

    const codeEnds = events.mock.calls.filter((c) => c[0].type === "code.end");
    expect(codeEnds.length).toBe(1);

    // Assert done event
    const doneEvents = events.mock.calls.filter((c) => c[0].type === "done");
    expect(doneEvents.length).toBe(1);
    expect(doneEvents[0][0].payload).toMatchObject({
      type: "or.done",
      finishReason: "stop",
    });

    // Assert usage at end
    const usageEvents = events.mock.calls.filter((c) => c[0].type === "usage");
    expect(usageEvents.length).toBe(1);
    expect(usageEvents[0][0].payload).toMatchObject({
      type: "or.usage",
      promptTokens: 89,
      completionTokens: 228,
      totalTokens: 317,
    });
  });

  it("should emit events in correct order: meta -> content -> done -> usage", () => {
    const orParser = new OpenRouterParser();
    orParser.register(createCodeBlockHandler());

    const eventTypes: string[] = [];

    orParser.onEvent((evt: ParserEvent) => {
      switch (evt.type) {
        case "or.meta": eventTypes.push("meta"); break;
        case "or.usage": eventTypes.push("usage"); break;
        case "or.done": eventTypes.push("done"); break;
        case "text.fragment":
        case "code.start":
        case "code.fragment":
        case "code.end":
          eventTypes.push(evt.type);
          break;
      }
    });

    orParser.processChunk(fixture);

    // Meta should be first
    expect(eventTypes[0]).toBe("meta");

    // Usage and done should be at end
    const lastFew = eventTypes.slice(-3);
    expect(lastFew).toContain("done");
    expect(lastFew).toContain("usage");

    // Code block sequence should be: code.start -> code.fragment(s) -> code.end
    const codeStartIdx = eventTypes.indexOf("code.start");
    const codeEndIdx = eventTypes.indexOf("code.end");
    expect(codeStartIdx).toBeGreaterThan(0);
    expect(codeEndIdx).toBeGreaterThan(codeStartIdx);

    // All code.fragments should be between code.start and code.end
    for (let i = 0; i < eventTypes.length; i++) {
      if (eventTypes[i] === "code.fragment") {
        expect(i).toBeGreaterThan(codeStartIdx);
        expect(i).toBeLessThan(codeEndIdx);
      }
    }
  });
});
