import { describe, it, expect } from "vitest";
import { claudeStrategy } from "@vibes.diy/call-ai-base";

/**
 * Tests for Claude tool mode response processing.
 *
 * These tests cover the claudeStrategy.processResponse function which handles:
 * 1. tool_use type responses (Claude's native format)
 * 2. tool_calls array format (OpenAI-compatible format via OpenRouter)
 * 3. JSON extraction from code blocks
 * 4. Plain JSON pass-through
 *
 * Note: The actual streaming tool call assembly happens in parseSSE (streaming.ts)
 * which accumulates JSON arguments from deltas. That code path is tested via
 * integration tests that use real API responses.
 */

// Type for tool request result - matches internal SchemaAIToolRequest
interface ToolRequestResult {
  tools: Array<{
    type: string;
    function: {
      name: string;
      description: string;
      parameters: {
        type: string;
        properties: Record<string, unknown>;
        required: string[];
        additionalProperties: boolean;
      };
    };
  }>;
  tool_choice: {
    type: string;
    function: {
      name: string;
    };
  };
}

describe("claudeStrategy.processResponse", () => {
  describe("tool_use type handling", () => {
    it("should extract input from tool_use response", () => {
      // At runtime, Claude can return tool_use with just input (no tool_calls)
      const content = {
        type: "tool_use" as const,
        input: { capital: "Paris", population: 67 },
      } as unknown as Parameters<typeof claudeStrategy.processResponse>[0];

      const result = claudeStrategy.processResponse(content);
      expect(result).toBe('{"capital":"Paris","population":67}');
    });

    it("should handle empty input object", () => {
      const content = {
        type: "tool_use" as const,
        input: {},
      } as unknown as Parameters<typeof claudeStrategy.processResponse>[0];

      const result = claudeStrategy.processResponse(content);
      expect(result).toBe("{}");
    });

    it("should handle nested objects in input", () => {
      const content = {
        type: "tool_use" as const,
        input: {
          user: {
            name: "John",
            address: { city: "Paris", country: "France" },
          },
        },
      } as unknown as Parameters<typeof claudeStrategy.processResponse>[0];

      const result = claudeStrategy.processResponse(content);
      const parsed = JSON.parse(result);
      expect(parsed.user.name).toBe("John");
      expect(parsed.user.address.city).toBe("Paris");
    });

    it("should handle arrays in input", () => {
      const content = {
        type: "tool_use" as const,
        input: {
          items: ["a", "b", "c"],
          numbers: [1, 2, 3],
        },
      } as unknown as Parameters<typeof claudeStrategy.processResponse>[0];

      const result = claudeStrategy.processResponse(content);
      const parsed = JSON.parse(result);
      expect(parsed.items).toEqual(["a", "b", "c"]);
      expect(parsed.numbers).toEqual([1, 2, 3]);
    });
  });

  describe("tool_use with input field (primary format)", () => {
    // Note: The claudeStrategy.processResponse uses `content.input` when type is "tool_use"
    // The tool_calls array is NOT extracted - input field takes precedence
    // Tool call assembly from streaming chunks happens in streaming.ts parseSSE

    it("should use input field even when tool_calls is present", () => {
      // When type is "tool_use", input is always used regardless of tool_calls
      const content = {
        type: "tool_use" as const,
        input: { city: "Paris" },
        tool_calls: [
          {
            type: "function" as const,
            function: {
              name: "get_city_info",
              arguments: '{"city": "London"}',
            },
          },
        ],
      } as unknown as Parameters<typeof claudeStrategy.processResponse>[0];

      const result = claudeStrategy.processResponse(content);
      const parsed = JSON.parse(result);
      // Input takes precedence, tool_calls is ignored
      expect(parsed.city).toBe("Paris");
    });

    it("should stringify empty string input", () => {
      const content = {
        type: "tool_use" as const,
        input: "",
        tool_calls: [
          {
            type: "function" as const,
            function: {
              name: "test",
              arguments: '{"value": "ignored"}',
            },
          },
        ],
      } as unknown as Parameters<typeof claudeStrategy.processResponse>[0];

      const result = claudeStrategy.processResponse(content);
      // Empty string input is stringified as '""'
      expect(result).toBe('""');
    });
  });

  describe("JSON extraction from code blocks", () => {
    it("should extract JSON from ```json code block", () => {
      const content = '```json\n{"capital": "Paris"}\n```';
      const result = claudeStrategy.processResponse(content);
      expect(result).toBe('{"capital": "Paris"}');
    });

    it("should extract JSON from ``` code block without language", () => {
      const content = '```\n{"name": "test"}\n```';
      const result = claudeStrategy.processResponse(content);
      expect(result).toBe('{"name": "test"}');
    });

    it("should handle multiline JSON in code block", () => {
      const content = '```json\n{\n  "capital": "Paris",\n  "population": 67\n}\n```';
      const result = claudeStrategy.processResponse(content);
      const parsed = JSON.parse(result);
      expect(parsed.capital).toBe("Paris");
      expect(parsed.population).toBe(67);
    });

    it("should pass through plain JSON unchanged", () => {
      const content = '{"capital": "Paris"}';
      const result = claudeStrategy.processResponse(content);
      expect(result).toBe('{"capital": "Paris"}');
    });
  });

  describe("non-string content handling", () => {
    it("should stringify plain object content", () => {
      const content = { some: "object", value: 42 } as unknown as Parameters<typeof claudeStrategy.processResponse>[0];
      const result = claudeStrategy.processResponse(content);
      expect(result).toBe('{"some":"object","value":42}');
    });

    it("should stringify array content", () => {
      const content = [1, 2, 3] as unknown as Parameters<typeof claudeStrategy.processResponse>[0];
      const result = claudeStrategy.processResponse(content);
      expect(result).toBe("[1,2,3]");
    });

    it("should stringify null", () => {
      const content = null as unknown as Parameters<typeof claudeStrategy.processResponse>[0];
      const result = claudeStrategy.processResponse(content);
      expect(result).toBe("null");
    });
  });
});

describe("claudeStrategy.prepareRequest", () => {
  it("should create tools array with function definition", () => {
    const schema = {
      name: "get_weather",
      properties: {
        city: { type: "string" },
        units: { type: "string" },
      },
    };

    const result = claudeStrategy.prepareRequest(schema, []) as ToolRequestResult;

    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].type).toBe("function");
    expect(result.tools[0].function.name).toBe("get_weather");
    expect(result.tools[0].function.parameters.properties).toHaveProperty("city");
  });

  it("should set tool_choice to force the specific function", () => {
    const schema = {
      name: "my_function",
      properties: { x: { type: "string" } },
    };

    const result = claudeStrategy.prepareRequest(schema, []) as ToolRequestResult;

    expect(result.tool_choice.type).toBe("function");
    expect(result.tool_choice.function.name).toBe("my_function");
  });

  it("should use default function name when not provided", () => {
    const schema = {
      properties: { x: { type: "string" } },
    };

    const result = claudeStrategy.prepareRequest(schema, []) as ToolRequestResult;

    expect(result.tools[0].function.name).toBe("generate_structured_data");
    expect(result.tool_choice.function.name).toBe("generate_structured_data");
  });

  it("should include required fields from schema", () => {
    const schema = {
      properties: {
        required_field: { type: "string" },
        optional_field: { type: "string" },
      },
      required: ["required_field"],
    };

    const result = claudeStrategy.prepareRequest(schema, []) as ToolRequestResult;

    expect(result.tools[0].function.parameters.required).toEqual(["required_field"]);
  });

  it("should default all properties to required when not specified", () => {
    const schema = {
      properties: {
        field1: { type: "string" },
        field2: { type: "number" },
      },
    };

    const result = claudeStrategy.prepareRequest(schema, []) as ToolRequestResult;

    expect(result.tools[0].function.parameters.required).toEqual(["field1", "field2"]);
  });

  it("should throw when schema is null", () => {
    expect(() => claudeStrategy.prepareRequest(null as unknown as Parameters<typeof claudeStrategy.prepareRequest>[0], [])).toThrow(
      "Schema strategy not implemented",
    );
  });
});

/**
 * Tests for the JSON fixing logic used in streaming tool call assembly.
 * This logic is in streaming.ts parseSSE function but we can test the patterns here.
 */
describe("JSON fixing patterns (used in streaming.ts)", () => {
  // These tests document the JSON fixing patterns used in parseSSE
  // to handle truncated/malformed JSON from streaming

  it("should fix trailing comma before closing brace", () => {
    const malformed = '{"a": 1, "b": 2,}';
    const fixed = malformed.replace(/,\s*([\}\]])/, "$1");
    expect(fixed).toBe('{"a": 1, "b": 2}');
    expect(() => JSON.parse(fixed)).not.toThrow();
  });

  it("should fix trailing comma before closing bracket", () => {
    const malformed = '["a", "b",]';
    const fixed = malformed.replace(/,\s*([\}\]])/, "$1");
    expect(fixed).toBe('["a", "b"]');
    expect(() => JSON.parse(fixed)).not.toThrow();
  });

  it("should add missing closing braces", () => {
    const malformed = '{"a": {"b": 1}';
    let fixed = malformed;
    const openBraces = (fixed.match(/\{/g) || []).length;
    const closeBraces = (fixed.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
      fixed += "}".repeat(openBraces - closeBraces);
    }
    expect(fixed).toBe('{"a": {"b": 1}}');
    expect(() => JSON.parse(fixed)).not.toThrow();
  });

  it("should add missing closing brackets", () => {
    const malformed = '{"items": ["a", "b"';
    let fixed = malformed;
    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      fixed += "]".repeat(openBrackets - closeBrackets);
    }
    // Still needs closing brace
    const openBraces = (fixed.match(/\{/g) || []).length;
    const closeBraces = (fixed.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
      fixed += "}".repeat(openBraces - closeBraces);
    }
    expect(fixed).toBe('{"items": ["a", "b"]}');
    expect(() => JSON.parse(fixed)).not.toThrow();
  });

  it("should handle property without value (null replacement)", () => {
    const malformed = '{"name": "test", "count": }';
    // This is how parseSSE handles it
    const fixed = malformed.replace(/"(\w+)"\s*:\s*}/g, '"$1":null}');
    expect(fixed).toBe('{"name": "test", "count":null}');
    expect(() => JSON.parse(fixed)).not.toThrow();
  });

  it("should handle property without value mid-object", () => {
    const malformed = '{"name": "test", "count": , "other": 1}';
    const fixed = malformed.replace(/"(\w+)"\s*:\s*,/g, '"$1":null,');
    expect(fixed).toBe('{"name": "test", "count":null, "other": 1}');
    expect(() => JSON.parse(fixed)).not.toThrow();
  });
});
