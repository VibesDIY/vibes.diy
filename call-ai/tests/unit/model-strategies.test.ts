import { describe, it, expect } from "vitest";
import {
  openAIStrategy,
  geminiStrategy,
  claudeStrategy,
  systemMessageStrategy,
  defaultStrategy,
} from "../../pkg/strategies/model-strategies.js";
import type { Message } from "call-ai";

const testSchema = {
  name: "test_result",
  properties: {
    capital: { type: "string" },
    population: { type: "number" },
  },
  required: ["capital"],
};

describe("Model Strategies", () => {
  describe("openAIStrategy", () => {
    it("should prepare request with json_schema response format", () => {
      const result = openAIStrategy.prepareRequest(testSchema, []);

      expect(result).toHaveProperty("response_format");
      expect(result.response_format).toHaveProperty("type", "json_schema");
      expect(result.response_format.json_schema).toHaveProperty("name", "test_result");
      expect(result.response_format.json_schema).toHaveProperty("strict", true);
      expect(result.response_format.json_schema.schema).toHaveProperty("properties");
    });

    it("should add additionalProperties: false to schema", () => {
      const result = openAIStrategy.prepareRequest(testSchema, []);

      expect(result.response_format.json_schema.schema).toHaveProperty("additionalProperties", false);
    });

    it("should use 'result' as default name if not provided", () => {
      const schemaWithoutName = { properties: { foo: { type: "string" } } };
      const result = openAIStrategy.prepareRequest(schemaWithoutName, []);

      expect(result.response_format.json_schema.name).toBe("result");
    });

    it("should pass through string content unchanged", () => {
      const content = '{"capital": "Paris"}';
      expect(openAIStrategy.processResponse(content)).toBe(content);
    });

    it("should stringify non-string content", () => {
      const content = { capital: "Paris" };
      expect(openAIStrategy.processResponse(content)).toBe('{"capital":"Paris"}');
    });
  });

  describe("geminiStrategy", () => {
    it("should use same prepareRequest as openAI", () => {
      const result = geminiStrategy.prepareRequest(testSchema, []);

      expect(result).toHaveProperty("response_format");
      expect(result.response_format).toHaveProperty("type", "json_schema");
    });

    it("should extract JSON from code blocks", () => {
      const content = '```json\n{"capital": "Paris"}\n```';
      expect(geminiStrategy.processResponse(content)).toBe('{"capital": "Paris"}');
    });

    it("should extract JSON without language specifier", () => {
      const content = '```\n{"capital": "Paris"}\n```';
      expect(geminiStrategy.processResponse(content)).toBe('{"capital": "Paris"}');
    });

    it("should pass through plain JSON unchanged", () => {
      const content = '{"capital": "Paris"}';
      expect(geminiStrategy.processResponse(content)).toBe(content);
    });
  });

  describe("claudeStrategy", () => {
    it("should prepare request with tools array", () => {
      const result = claudeStrategy.prepareRequest(testSchema, []);

      expect(result).toHaveProperty("tools");
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools[0]).toHaveProperty("type", "function");
      expect(result.tools[0].function).toHaveProperty("name", "test_result");
    });

    it("should include tool_choice", () => {
      const result = claudeStrategy.prepareRequest(testSchema, []);

      expect(result).toHaveProperty("tool_choice");
      expect(result.tool_choice).toHaveProperty("type", "function");
      expect(result.tool_choice.function).toHaveProperty("name", "test_result");
    });

    it("should use default function name if not provided", () => {
      const schemaWithoutName = { properties: { foo: { type: "string" } } };
      const result = claudeStrategy.prepareRequest(schemaWithoutName, []);

      expect(result.tools[0].function.name).toBe("generate_structured_data");
    });

    it("should process tool_use response type", () => {
      const toolUseContent = {
        type: "tool_use",
        input: { capital: "Paris" },
      };
      const result = claudeStrategy.processResponse(toolUseContent);
      expect(result).toBe('{"capital":"Paris"}');
    });

    it("should extract JSON from code blocks", () => {
      const content = '```json\n{"capital": "Paris"}\n```';
      expect(claudeStrategy.processResponse(content)).toBe('{"capital": "Paris"}');
    });
  });

  describe("systemMessageStrategy", () => {
    it("should prepend system message with schema instructions", () => {
      const messages: Message[] = [{ role: "user", content: "Get info about France" }];
      const result = systemMessageStrategy.prepareRequest(testSchema, messages);

      expect(result).toHaveProperty("messages");
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe("system");
      expect(result.messages[0].content).toContain("JSON");
      expect(result.messages[0].content).toContain("capital");
    });

    it("should not add system message if one already exists", () => {
      const messages: Message[] = [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Get info" },
      ];
      const result = systemMessageStrategy.prepareRequest(testSchema, messages);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].content).toBe("You are helpful");
    });

    it("should extract JSON from code blocks", () => {
      const content = '```json\n{"capital": "Paris"}\n```';
      expect(systemMessageStrategy.processResponse(content)).toBe('{"capital": "Paris"}');
    });

    it("should extract raw JSON object from content", () => {
      // The regex matches {...} anywhere in the string
      const content = '{"capital": "Paris"}';
      expect(systemMessageStrategy.processResponse(content)).toBe('{"capital": "Paris"}');
    });

    it("should return original if JSON is embedded with prefix text", () => {
      // Current behavior: regex captures from first { to last }
      // so embedded JSON with prefix returns the whole thing
      const content = 'Here is the data: {"capital": "Paris"}';
      // The regex /\{[\s\S]*\}/ matches from first { to end
      expect(systemMessageStrategy.processResponse(content)).toBe(content);
    });
  });

  describe("defaultStrategy", () => {
    it("should throw error on prepareRequest", () => {
      expect(() => defaultStrategy.prepareRequest({} as any, [])).toThrow("Schema strategy not implemented");
    });

    it("should pass through string content", () => {
      expect(defaultStrategy.processResponse("hello")).toBe("hello");
    });

    it("should stringify non-string content", () => {
      expect(defaultStrategy.processResponse({ foo: "bar" })).toBe('{"foo":"bar"}');
    });
  });
});
