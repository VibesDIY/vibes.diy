import fs from "fs";
import path from "path";
import { describe, it, expect, vi } from "vitest";
import { createBaseParser } from "../../pkg/parser/create-base-parser.js";
import { CodeBlockParser } from "../../pkg/parser/code-block-parser.js";

describe("Parser register style tests", () => {
  const fixture = fs.readFileSync(
    path.join(__dirname, "fixtures/openai-fireproof-stream-response.txt"),
    "utf8"
  );

  it("should emit code events and upstream usage/meta", () => {
    const orParser = createBaseParser();
    const codeParser = new CodeBlockParser(orParser);

    const events = vi.fn();

    // Upstream events
    orParser.onEvent((evt) => {
      switch (evt.type) {
        case "or.meta": events({ type: "meta", payload: evt }); break;
        case "or.usage": events({ type: "usage", payload: evt }); break;
        case "or.done": events({ type: "done", payload: evt }); break;
      }
    });

    // Code block events
    codeParser.onEvent((evt) => events(evt));

    codeParser.processChunk(fixture);

    // Assert meta comes first
    expect(events.mock.calls[0][0]).toMatchObject({
      type: "meta",
      payload: { type: "or.meta", model: "openai/gpt-4o", provider: "OpenAI" },
    });

    // Assert text fragment events for markdown before code
    const textFragments = events.mock.calls.filter((c) => c[0].type === "textFragment");
    expect(textFragments.length).toBeGreaterThan(0);
    // First text should be start of the response
    expect(textFragments[0][0].fragment).toBe("This");

    // Assert code block events
    const codeStarts = events.mock.calls.filter((c) => c[0].type === "codeStart");
    expect(codeStarts.length).toBe(1);
    expect(codeStarts[0][0]).toMatchObject({
      type: "codeStart",
      language: "jsx",
    });

    const codeFragments = events.mock.calls.filter((c) => c[0].type === "codeFragment");
    expect(codeFragments.length).toBeGreaterThan(0);
    // Code should contain useFireproof import
    const allCode = codeFragments.map((c) => c[0].fragment).join("");
    expect(allCode).toContain("useFireproof");

    const codeEnds = events.mock.calls.filter((c) => c[0].type === "codeEnd");
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
    const orParser = createBaseParser();
    const codeParser = new CodeBlockParser(orParser);

    const eventTypes: string[] = [];

    orParser.onEvent((evt) => {
      switch (evt.type) {
        case "or.meta": eventTypes.push("meta"); break;
        case "or.usage": eventTypes.push("usage"); break;
        case "or.done": eventTypes.push("done"); break;
      }
    });
    codeParser.onEvent((evt) => {
      eventTypes.push(evt.type);
    });

    codeParser.processChunk(fixture);

    // Meta should be first
    expect(eventTypes[0]).toBe("meta");

    // Usage and done should be at end
    const lastFew = eventTypes.slice(-3);
    expect(lastFew).toContain("done");
    expect(lastFew).toContain("usage");

    // Code block sequence should be: codeStart -> codeFragment(s) -> codeEnd
    const codeStartIdx = eventTypes.indexOf("codeStart");
    const codeEndIdx = eventTypes.indexOf("codeEnd");
    expect(codeStartIdx).toBeGreaterThan(0);
    expect(codeEndIdx).toBeGreaterThan(codeStartIdx);

    // All codeFragments should be between codeStart and codeEnd
    for (let i = 0; i < eventTypes.length; i++) {
      if (eventTypes[i] === "codeFragment") {
        expect(i).toBeGreaterThan(codeStartIdx);
        expect(i).toBeLessThan(codeEndIdx);
      }
    }
  });
});
