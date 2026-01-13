import { describe, it, expect } from "vitest";
import { createBaseParser, createSchemaParser, OrEvent } from "../../pkg/parser/index.js";
import { feedFixtureToParser, toSSE } from "../test-helpers.js";

describe("Parser-based streaming tests", () => {
  describe("createBaseParser - OpenRouter format", () => {
    it("should handle basic text streaming with or.delta events", () => {
      const parser = createBaseParser();
      const deltas: string[] = [];

      parser.onEvent((evt: OrEvent) => {
        if (evt.type === "or.delta") deltas.push(evt.content);
      });

      const fixture =
        toSSE({ choices: [{ delta: { content: "Hello" } }] }) +
        toSSE({ choices: [{ delta: { content: " world" } }] }) +
        "data: [DONE]\n\n";

      feedFixtureToParser(parser, fixture);

      expect(deltas).toEqual(["Hello", " world"]);
    });

    it("should handle content_block_delta format (Claude format)", () => {
      const parser = createBaseParser();
      const deltas: string[] = [];

      parser.onEvent((evt: OrEvent) => {
        if (evt.type === "or.delta") deltas.push(evt.content);
      });

      const fixture =
        toSSE({
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Streaming" },
        }) +
        toSSE({
          type: "content_block_delta",
          delta: { type: "text_delta", text: " content" },
        }) +
        "data: [DONE]\n\n";

      feedFixtureToParser(parser, fixture);

      expect(deltas).toEqual(["Streaming", " content"]);
    });

    it("should emit or.json for all JSON payloads including errors", () => {
      const parser = createBaseParser();
      const jsonPayloads: unknown[] = [];

      parser.onEvent((evt: OrEvent) => {
        if (evt.type === "or.json") jsonPayloads.push(evt.json);
      });

      const fixture = toSSE({ error: { message: "Rate limit exceeded", status: 429 } });

      feedFixtureToParser(parser, fixture);

      expect(jsonPayloads).toHaveLength(1);
      expect(jsonPayloads[0]).toEqual({
        error: { message: "Rate limit exceeded", status: 429 },
      });
    });

    it("should emit or.done with finish_reason", () => {
      const parser = createBaseParser();
      const doneEvents: string[] = [];

      parser.onEvent((evt: OrEvent) => {
        if (evt.type === "or.done") doneEvents.push(evt.finishReason);
      });

      const fixture =
        toSSE({ choices: [{ delta: { content: "Hi" } }] }) +
        toSSE({ choices: [{ finish_reason: "stop" }] }) +
        "data: [DONE]\n\n";

      feedFixtureToParser(parser, fixture);

      expect(doneEvents).toEqual(["stop"]);
    });

    it("should emit or.meta on first chunk with id", () => {
      const parser = createBaseParser();
      let meta: { id?: string; model?: string } | null = null;

      parser.onEvent((evt: OrEvent) => {
        if (evt.type === "or.meta") meta = { id: evt.id, model: evt.model };
      });

      const fixture =
        toSSE({
          id: "chatcmpl-123",
          model: "gpt-4",
          choices: [{ delta: { content: "Hi" } }],
        }) +
        "data: [DONE]\n\n";

      feedFixtureToParser(parser, fixture);

      expect(meta).toEqual({ id: "chatcmpl-123", model: "gpt-4" });
    });

    it("should emit or.stream-end on [DONE]", () => {
      const parser = createBaseParser();
      let streamEnded = false;

      parser.onEvent((evt: OrEvent) => {
        if (evt.type === "or.stream-end") streamEnded = true;
      });

      const fixture =
        toSSE({ choices: [{ delta: { content: "Hi" } }] }) +
        "data: [DONE]\n\n";

      feedFixtureToParser(parser, fixture);

      expect(streamEnded).toBe(true);
    });
  });

  describe("createSchemaParser - Tool calls", () => {
    it("should handle tool_use streaming with chunked arguments", () => {
      const parser = createSchemaParser();
      const fragments: string[] = [];
      let completeArgs: string | null = null;

      parser.onToolCallArguments((evt) => {
        fragments.push(evt.fragment);
      });

      parser.onToolCallComplete((evt) => {
        completeArgs = evt.arguments;
      });

      const fixture =
        toSSE({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_123",
                    function: { name: "test", arguments: '{"foo":' },
                  },
                ],
              },
            },
          ],
        }) +
        toSSE({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { arguments: '"bar"}' },
                  },
                ],
              },
            },
          ],
        }) +
        toSSE({
          choices: [
            {
              finish_reason: "tool_calls",
            },
          ],
        }) +
        "data: [DONE]\n\n";

      feedFixtureToParser(parser, fixture);

      expect(fragments).toEqual(['{"foo":', '"bar"}']);
      expect(completeArgs).toBe('{"foo":"bar"}');
    });

    it("should emit toolCallStart with function name", () => {
      const parser = createSchemaParser();
      let startEvent: { callId: string; functionName?: string } | null = null;

      parser.onToolCallStart((evt) => {
        startEvent = { callId: evt.callId, functionName: evt.functionName };
      });

      const fixture =
        toSSE({
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_456",
                    function: { name: "get_weather", arguments: "{}" },
                  },
                ],
              },
            },
          ],
        }) +
        toSSE({ choices: [{ finish_reason: "tool_calls" }] }) +
        "data: [DONE]\n\n";

      feedFixtureToParser(parser, fixture);

      expect(startEvent).toEqual({ callId: "call_456", functionName: "get_weather" });
    });
  });

  describe("Edge cases - fragmentation resilience", () => {
    it("should handle chunks split mid-JSON", () => {
      const parser = createBaseParser();
      const deltas: string[] = [];

      parser.onEvent((evt: OrEvent) => {
        if (evt.type === "or.delta") deltas.push(evt.content);
      });

      const fixture =
        toSSE({ choices: [{ delta: { content: "Hello" } }] }) +
        toSSE({ choices: [{ delta: { content: " world" } }] }) +
        "data: [DONE]\n\n";

      // Use very small chunks to test buffering (3 bytes at a time)
      feedFixtureToParser(parser, fixture, 3);

      expect(deltas).toEqual(["Hello", " world"]);
    });

    it("should handle single-byte chunks", () => {
      const parser = createBaseParser();
      const deltas: string[] = [];

      parser.onEvent((evt: OrEvent) => {
        if (evt.type === "or.delta") deltas.push(evt.content);
      });

      const fixture =
        toSSE({ choices: [{ delta: { content: "A" } }] }) +
        "data: [DONE]\n\n";

      // Feed one byte at a time
      feedFixtureToParser(parser, fixture, 1);

      expect(deltas).toEqual(["A"]);
    });
  });
});
