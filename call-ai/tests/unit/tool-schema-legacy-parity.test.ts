import { describe, it, expect } from "vitest";
import { createSchemaParser } from "../../pkg/parser/index.js";
import { feedFixtureToParser, toSSE } from "../test-helpers.js";

describe("ToolSchemaParser - Legacy Tool Call Parity", () => {
  it("should assemble tool call from multiple chunks", () => {
    const parser = createSchemaParser();
    const fragments: string[] = [];
    let completeArgs: string | null = null;
    let startEvent: { callId: string; functionName?: string } | null = null;

    parser.onToolCallStart((evt) => {
      startEvent = { callId: evt.callId, functionName: evt.functionName };
    });

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
                  function: { name: "test_func", arguments: '{"foo":' },
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

    // Verify start event
    expect(startEvent).toEqual({ callId: "call_123", functionName: "test_func" });

    // Verify argument fragments
    expect(fragments).toEqual(['{"foo":', '"bar"}']);

    // Verify complete assembled arguments
    expect(completeArgs).toBe('{"foo":"bar"}');
    expect(JSON.parse(completeArgs!)).toEqual({ foo: "bar" });
  });

  it("should handle tool call arguments split mid-token", () => {
    const parser = createSchemaParser();
    let completeArgs: string | null = null;

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
                  id: "call_456",
                  function: { name: "test", arguments: '{"message": "Hello ' },
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
                  function: { arguments: 'World"}' },
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

    expect(completeArgs).toBe('{"message": "Hello World"}');
    expect(JSON.parse(completeArgs!)).toEqual({ message: "Hello World" });
  });

  it("should handle multiple parallel tool calls", () => {
    const parser = createSchemaParser();
    const completedCalls: Array<{ callId: string; arguments: string }> = [];

    parser.onToolCallComplete((evt) => {
      completedCalls.push({ callId: evt.callId, arguments: evt.arguments });
    });

    const fixture =
      toSSE({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_a",
                  function: { name: "func_a", arguments: '{"a":' },
                },
                {
                  index: 1,
                  id: "call_b",
                  function: { name: "func_b", arguments: '{"b":' },
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
                  function: { arguments: "1}" },
                },
                {
                  index: 1,
                  function: { arguments: "2}" },
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

    expect(completedCalls).toHaveLength(2);
    expect(completedCalls[0]).toEqual({ callId: "call_a", arguments: '{"a":1}' });
    expect(completedCalls[1]).toEqual({ callId: "call_b", arguments: '{"b":2}' });
  });

  it("should handle fragmented SSE with random chunk sizes", () => {
    const parser = createSchemaParser();
    let completeArgs: string | null = null;

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
                  id: "call_789",
                  function: { name: "get_weather", arguments: '{"city":"San Francisco","unit":"celsius"}' },
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

    // Use very small chunks to stress test buffering
    feedFixtureToParser(parser, fixture, 3);

    expect(completeArgs).toBe('{"city":"San Francisco","unit":"celsius"}');
    expect(JSON.parse(completeArgs!)).toEqual({ city: "San Francisco", unit: "celsius" });
  });
});
