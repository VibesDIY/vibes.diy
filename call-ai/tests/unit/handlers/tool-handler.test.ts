import { describe, it, expect } from "vitest";

import { ParserEvento, ParserEvent } from "@vibes.diy/call-ai-base";
import { createToolHandler, ToolStart, ToolArguments, ToolComplete } from "@vibes.diy/call-ai-base";

describe("toolHandler", () => {
  function createEvento() {
    const evento = new ParserEvento();
    // Use factory to get isolated state per test
    evento.push(createToolHandler());
    return evento;
  }

  function collectToolEvents(evento: ParserEvento) {
    const starts: ToolStart[] = [];
    const args: ToolArguments[] = [];
    const completes: ToolComplete[] = [];

    evento.onEvent((event) => {
      if (event.type === "tool.start") starts.push(event as ToolStart);
      if (event.type === "tool.arguments") args.push(event as ToolArguments);
      if (event.type === "tool.complete") completes.push(event as ToolComplete);
    });

    return { starts, args, completes };
  }

  describe("tool_calls in delta (streaming format)", () => {
    it("emits tool.start when tool call with id/name appears", () => {
      const evento = createEvento();
      const { starts } = collectToolEvents(evento);

      evento.trigger({
        type: "or.json",
        json: {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_123",
                    function: { name: "test_func", arguments: "{" },
                  },
                ],
              },
            },
          ],
        },
      });

      expect(starts).toHaveLength(1);
      expect(starts[0]).toMatchObject({
        type: "tool.start",
        index: 0,
        callId: "call_123",
        functionName: "test_func",
      });
    });

    it("emits tool.arguments for argument fragments", () => {
      const evento = createEvento();
      const { args } = collectToolEvents(evento);

      evento.trigger({
        type: "or.json",
        json: {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_123",
                    function: { name: "func", arguments: '{"foo":' },
                  },
                ],
              },
            },
          ],
        },
      });

      evento.trigger({
        type: "or.json",
        json: {
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
        },
      });

      expect(args).toHaveLength(2);
      expect(args[0]).toMatchObject({ type: "tool.arguments", index: 0, fragment: '{"foo":' });
      expect(args[1]).toMatchObject({ type: "tool.arguments", index: 0, fragment: '"bar"}' });
    });

    it("handles multiple parallel tool calls", () => {
      const evento = createEvento();
      const { starts, args } = collectToolEvents(evento);

      // Tool call 1
      evento.trigger({
        type: "or.json",
        json: {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_1",
                    function: { name: "func1", arguments: "{1}" },
                  },
                ],
              },
            },
          ],
        },
      });

      // Tool call 2
      evento.trigger({
        type: "or.json",
        json: {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 1,
                    id: "call_2",
                    function: { name: "func2", arguments: "{2}" },
                  },
                ],
              },
            },
          ],
        },
      });

      expect(starts).toHaveLength(2);
      expect(starts[0]).toMatchObject({ index: 0, callId: "call_1", functionName: "func1" });
      expect(starts[1]).toMatchObject({ index: 1, callId: "call_2", functionName: "func2" });

      expect(args).toHaveLength(2);
      expect(args[0]).toMatchObject({ index: 0, fragment: "{1}" });
      expect(args[1]).toMatchObject({ index: 1, fragment: "{2}" });
    });

    it("emits tool.complete on or.done for accumulated streaming tool calls", () => {
      const evento = createEvento();
      const { starts, args, completes } = collectToolEvents(evento);

      // First chunk - start with id and name
      evento.trigger({
        type: "or.json",
        json: {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_stream",
                    function: { name: "get_data", arguments: '{"foo":' },
                  },
                ],
              },
            },
          ],
        },
      });

      // Second chunk - more arguments
      evento.trigger({
        type: "or.json",
        json: {
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
        },
      });

      // No complete yet
      expect(completes).toHaveLength(0);
      expect(starts).toHaveLength(1);
      expect(args).toHaveLength(2);

      // Stream ends with finish_reason
      evento.trigger({ type: "or.done", finishReason: "tool_calls" });

      // Now complete should be emitted
      expect(completes).toHaveLength(1);
      expect(completes[0]).toMatchObject({
        type: "tool.complete",
        callId: "call_stream",
        functionName: "get_data",
        arguments: '{"foo":"bar"}',
      });
    });

    it("emits tool.complete on or.stream-end for accumulated streaming tool calls", () => {
      const evento = createEvento();
      const { completes } = collectToolEvents(evento);

      // Stream tool call
      evento.trigger({
        type: "or.json",
        json: {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_end",
                    function: { name: "test_fn", arguments: '{"x":1}' },
                  },
                ],
              },
            },
          ],
        },
      });

      expect(completes).toHaveLength(0);

      // Stream end event
      evento.trigger({ type: "or.stream-end" });

      expect(completes).toHaveLength(1);
      expect(completes[0]).toMatchObject({
        callId: "call_end",
        functionName: "test_fn",
        arguments: '{"x":1}',
      });
    });

    it("handles multiple parallel streaming tool calls with completion", () => {
      const evento = createEvento();
      const { completes } = collectToolEvents(evento);

      // Tool call 1 start
      evento.trigger({
        type: "or.json",
        json: {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_a",
                    function: { name: "func_a", arguments: '{"a":' },
                  },
                ],
              },
            },
          ],
        },
      });

      // Tool call 2 start
      evento.trigger({
        type: "or.json",
        json: {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 1,
                    id: "call_b",
                    function: { name: "func_b", arguments: '{"b":' },
                  },
                ],
              },
            },
          ],
        },
      });

      // Tool call 1 more args
      evento.trigger({
        type: "or.json",
        json: {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    function: { arguments: "1}" },
                  },
                ],
              },
            },
          ],
        },
      });

      // Tool call 2 more args
      evento.trigger({
        type: "or.json",
        json: {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 1,
                    function: { arguments: "2}" },
                  },
                ],
              },
            },
          ],
        },
      });

      expect(completes).toHaveLength(0);

      // Complete
      evento.trigger({ type: "or.done", finishReason: "tool_calls" });

      expect(completes).toHaveLength(2);
      expect(completes[0]).toMatchObject({ callId: "call_a", functionName: "func_a", arguments: '{"a":1}' });
      expect(completes[1]).toMatchObject({ callId: "call_b", functionName: "func_b", arguments: '{"b":2}' });
    });
  });

  describe("tool_calls in message (non-streaming format)", () => {
    it("emits tool.complete for complete tool calls in message", () => {
      const evento = createEvento();
      const { completes } = collectToolEvents(evento);

      evento.trigger({
        type: "or.json",
        json: {
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: "call_456",
                    type: "function",
                    function: { name: "get_weather", arguments: '{"city":"NYC"}' },
                  },
                ],
              },
            },
          ],
        },
      });

      expect(completes).toHaveLength(1);
      expect(completes[0]).toMatchObject({
        type: "tool.complete",
        callId: "call_456",
        functionName: "get_weather",
        arguments: '{"city":"NYC"}',
      });
    });

    it("emits tool.complete for multiple tool calls in message", () => {
      const evento = createEvento();
      const { completes } = collectToolEvents(evento);

      evento.trigger({
        type: "or.json",
        json: {
          choices: [
            {
              message: {
                tool_calls: [
                  { id: "c1", type: "function", function: { name: "func1", arguments: "{}" } },
                  { id: "c2", type: "function", function: { name: "func2", arguments: '{"x":1}' } },
                ],
              },
            },
          ],
        },
      });

      expect(completes).toHaveLength(2);
      expect(completes[0]).toMatchObject({ callId: "c1", functionName: "func1" });
      expect(completes[1]).toMatchObject({ callId: "c2", functionName: "func2" });
    });
  });

  describe("ignores non-tool payloads", () => {
    it("ignores or.json without tool_calls", () => {
      const evento = createEvento();
      const { starts, args, completes } = collectToolEvents(evento);

      evento.trigger({
        type: "or.json",
        json: { choices: [{ delta: { content: "Hello" } }] },
      });

      expect(starts).toHaveLength(0);
      expect(args).toHaveLength(0);
      expect(completes).toHaveLength(0);
    });

    it("ignores non or.json events", () => {
      const evento = createEvento();
      const { starts, args, completes } = collectToolEvents(evento);

      evento.trigger({ type: "or.done", finishReason: "stop" });
      evento.trigger({ type: "or.delta", seq: 0, content: "hello" });

      expect(starts).toHaveLength(0);
      expect(args).toHaveLength(0);
      expect(completes).toHaveLength(0);
    });
  });
});
