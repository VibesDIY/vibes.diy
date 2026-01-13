import { describe, it, expect } from "vitest";
import { createSchemaParser, ToolCallCompleteEvent, ToolCallStartEvent, ToolCallArgumentsEvent, ToolSchemaAccumulator } from "../../pkg/parser/index.js";

describe("ToolSchemaParser", () => {
  it("should assemble tool call from multiple chunks", () => {
    const parser = createSchemaParser();
    const completed: ToolCallCompleteEvent[] = [];
    parser.onToolCallComplete((evt) => completed.push(evt));

    // Chunk 1: Start + partial arguments
    // arguments: '{"foo":'
    const chunk1 = JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: "call_123",
            function: { name: "test_func", arguments: '{"foo":' }
          }]
        }
      }]
    });
    parser.processChunk(`data: ${chunk1}\n\n`);

    // Chunk 2: Rest of arguments
    // arguments: '"bar"}'
    const chunk2 = JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            function: { arguments: '"bar"}' }
          }]
        }
      }]
    });
    parser.processChunk(`data: ${chunk2}\n\n`);

    // Chunk 3: Finish reason
    const chunk3 = JSON.stringify({
      choices: [{ finish_reason: "tool_calls" }]
    });
    parser.processChunk(`data: ${chunk3}\n\n`);

    expect(completed).toHaveLength(1);
    expect(completed[0].callId).toBe("call_123");
    expect(completed[0].arguments).toBe('{"foo":"bar"}');
  });

  it("should emit start and argument events", () => {
    const parser = createSchemaParser();
    const starts: ToolCallStartEvent[] = [];
    const args: ToolCallArgumentsEvent[] = [];
    
    parser.onToolCallStart((evt) => starts.push(evt));
    parser.onToolCallArguments((evt) => args.push(evt));

    const chunk1 = JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: "call_1",
            function: { name: "func", arguments: "{" }
          }]
        }
      }]
    });
    parser.processChunk(`data: ${chunk1}\n\n`);

    const chunk2 = JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            function: { arguments: "}" }
          }]
        }
      }]
    });
    parser.processChunk(`data: ${chunk2}\n\n`);

    expect(starts).toHaveLength(1);
    expect(starts[0].functionName).toBe("func");
    
    expect(args).toHaveLength(2);
    expect(args[0].fragment).toBe("{");
    expect(args[1].fragment).toBe("}");
  });

  it("should handle multiple tool calls (parallel)", () => {
    const parser = createSchemaParser();
    const completed: ToolCallCompleteEvent[] = [];
    parser.onToolCallComplete((evt) => completed.push(evt));

    // Call 1 start
    const chunk1 = JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: "call_1",
            function: { arguments: "{1}" }
          }]
        }
      }]
    });
    parser.processChunk(`data: ${chunk1}\n\n`);

    // Call 2 start
    const chunk2 = JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{
            index: 1,
            id: "call_2",
            function: { arguments: "{2}" }
          }]
        }
      }]
    });
    parser.processChunk(`data: ${chunk2}\n\n`);

    // Finish
    const chunk3 = JSON.stringify({
      choices: [{ finish_reason: "tool_calls" }]
    });
    parser.processChunk(`data: ${chunk3}\n\n`);

    expect(completed).toHaveLength(2);
    const result1 = completed.find(c => c.callId === "call_1");
    const result2 = completed.find(c => c.callId === "call_2");
    
    expect(result1?.arguments).toBe("{1}");
    expect(result2?.arguments).toBe("{2}");
  });

  it("should handle finalize() for streams without finish_reason", () => {
    const parser = createSchemaParser();
    const completed: ToolCallCompleteEvent[] = [];
    parser.onToolCallComplete((evt) => completed.push(evt));

    const chunk1 = JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: "call_1",
            function: { arguments: "{}" }
          }]
        }
      }]
    });
    parser.processChunk(`data: ${chunk1}\n\n`);
    
    // Simulate stream end without explicit finish_reason chunk
    parser.finalize();

    expect(completed).toHaveLength(1);
    expect(completed[0].arguments).toBe("{}");
  });

  it("should ignore content-only chunks", () => {
    const parser = createSchemaParser();
    const completed: ToolCallCompleteEvent[] = [];
    parser.onToolCallComplete((evt) => completed.push(evt));

    // Content chunk
    const chunk = JSON.stringify({
      choices: [{
        delta: { content: "Hello" }
      }]
    });
    parser.processChunk(`data: ${chunk}\n\n`);

    expect(completed).toHaveLength(0);
  });
  
  it("should handle split JSON arguments (regression test for chunk boundaries)", () => {
    const parser = createSchemaParser();
    const completed: ToolCallCompleteEvent[] = [];
    parser.onToolCallComplete((evt) => completed.push(evt));

    // Chunk 1: "arguments": "{\"key\": "
    const chunk1 = JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: "c1",
            function: { arguments: '{"key": ' }
          }]
        }
      }]
    });
    parser.processChunk(`data: ${chunk1}\n\n`);

    // Chunk 2: "arguments": "\"val\"}"
    const chunk2 = JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            function: { arguments: '"val"}' }
          }]
        }
      }]
    });
    parser.processChunk(`data: ${chunk2}\n\n`);

    const chunk3 = JSON.stringify({
      choices: [{ finish_reason: "tool_calls" }]
    });
    parser.processChunk(`data: ${chunk3}\n\n`);

    expect(completed).toHaveLength(1);
    expect(completed[0].arguments).toBe('{"key": "val"}');
  });

  it("should not emit duplicates when finalize follows finish_reason", () => {
    const parser = createSchemaParser();
    const completed: ToolCallCompleteEvent[] = [];
    parser.onToolCallComplete((evt) => completed.push(evt));

    const chunk = JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: "call_nodup",
            function: { arguments: '{"foo": "bar"}' }
          }]
        }
      }]
    });
    parser.processChunk(`data: ${chunk}\n\n`);

    const finish = JSON.stringify({ choices: [{ finish_reason: "tool_calls" }] });
    parser.processChunk(`data: ${finish}\n\n`);

    parser.finalize();

    expect(completed).toHaveLength(1);
    expect(completed[0].callId).toBe("call_nodup");
  });
});

describe("ToolSchemaAccumulator", () => {
  it("should capture tool schema JSON via delegated parser", () => {
    const parser = createSchemaParser();
    const accumulator = new ToolSchemaAccumulator(parser);

    const chunk = JSON.stringify({
      choices: [{
        delta: {
          tool_calls: [{
            index: 0,
            id: "acc_1",
            function: { arguments: '{"alpha": 1}' }
          }]
        }
      }]
    });
    accumulator.processChunk(`data: ${chunk}\n\n`);

    const finish = JSON.stringify({ choices: [{ finish_reason: "tool_calls" }] });
    accumulator.processChunk(`data: ${finish}\n\n`);

    expect(accumulator.result).toBe('{"alpha": 1}');
  });
});
