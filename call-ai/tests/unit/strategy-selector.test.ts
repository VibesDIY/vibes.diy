import { describe, it, expect } from "vitest";
import { chooseSchemaStrategy } from "../../pkg/strategies/strategy-selector.js";

const testSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    count: { type: "number" },
  },
};

describe("chooseSchemaStrategy", () => {
  describe("no schema", () => {
    it("should return 'none' strategy when no schema provided", () => {
      const result = chooseSchemaStrategy("openai/gpt-4o", null);
      expect(result.strategy).toBe("none");
      expect(result.shouldForceStream).toBe(false);
    });

    it("should default to openrouter/auto model when no schema and no model", () => {
      const result = chooseSchemaStrategy(undefined, null);
      expect(result.model).toBe("openrouter/auto");
    });

    it("should default to openai/gpt-4o when schema provided but no model", () => {
      const result = chooseSchemaStrategy(undefined, testSchema);
      expect(result.model).toBe("openai/gpt-4o");
    });
  });

  describe("Claude models", () => {
    it("should use tool_mode for anthropic/claude-3-sonnet", () => {
      const result = chooseSchemaStrategy("anthropic/claude-3-sonnet", testSchema);
      expect(result.strategy).toBe("tool_mode");
      expect(result.shouldForceStream).toBe(true);
    });

    it("should use tool_mode for anthropic/claude-3.5-sonnet", () => {
      const result = chooseSchemaStrategy("anthropic/claude-3.5-sonnet", testSchema);
      expect(result.strategy).toBe("tool_mode");
    });

    it("should use tool_mode for claude (case insensitive)", () => {
      const result = chooseSchemaStrategy("CLAUDE-something", testSchema);
      expect(result.strategy).toBe("tool_mode");
    });
  });

  describe("Gemini models", () => {
    it("should use json_schema for google/gemini-2.5-flash", () => {
      const result = chooseSchemaStrategy("google/gemini-2.5-flash", testSchema);
      expect(result.strategy).toBe("json_schema");
      expect(result.shouldForceStream).toBe(false);
    });

    it("should use json_schema for google/gemini-2.5-pro", () => {
      const result = chooseSchemaStrategy("google/gemini-2.5-pro", testSchema);
      expect(result.strategy).toBe("json_schema");
    });

    it("should use json_schema for gemini (case insensitive)", () => {
      const result = chooseSchemaStrategy("GEMINI-model", testSchema);
      expect(result.strategy).toBe("json_schema");
    });
  });

  describe("OpenAI models", () => {
    it("should use json_schema for openai/gpt-4o", () => {
      const result = chooseSchemaStrategy("openai/gpt-4o", testSchema);
      expect(result.strategy).toBe("json_schema");
      expect(result.shouldForceStream).toBe(false);
    });

    it("should use json_schema for openai/gpt-4o-mini", () => {
      const result = chooseSchemaStrategy("openai/gpt-4o-mini", testSchema);
      expect(result.strategy).toBe("json_schema");
    });

    it("should use json_schema for gpt-3.5-turbo", () => {
      const result = chooseSchemaStrategy("gpt-3.5-turbo", testSchema);
      expect(result.strategy).toBe("json_schema");
    });
  });

  describe("GPT-4 Turbo models", () => {
    it("should use system_message for openai/gpt-4-turbo", () => {
      const result = chooseSchemaStrategy("openai/gpt-4-turbo", testSchema);
      expect(result.strategy).toBe("system_message");
    });

    it("should use system_message for gpt-4-turbo-preview", () => {
      const result = chooseSchemaStrategy("gpt-4-turbo-preview", testSchema);
      expect(result.strategy).toBe("system_message");
    });
  });

  describe("Llama models", () => {
    it("should use system_message for meta-llama/llama-3-70b", () => {
      const result = chooseSchemaStrategy("meta-llama/llama-3-70b", testSchema);
      expect(result.strategy).toBe("system_message");
    });

    it("should use system_message for llama-3.1", () => {
      const result = chooseSchemaStrategy("llama-3.1-8b", testSchema);
      expect(result.strategy).toBe("system_message");
    });
  });

  describe("DeepSeek models", () => {
    it("should use system_message for deepseek/deepseek-chat", () => {
      const result = chooseSchemaStrategy("deepseek/deepseek-chat", testSchema);
      expect(result.strategy).toBe("system_message");
    });

    it("should use system_message for deepseek-coder", () => {
      const result = chooseSchemaStrategy("deepseek-coder", testSchema);
      expect(result.strategy).toBe("system_message");
    });
  });

  describe("Unknown models", () => {
    it("should default to system_message for unknown models with schema", () => {
      const result = chooseSchemaStrategy("some-unknown-model/v1", testSchema);
      expect(result.strategy).toBe("system_message");
    });

    it("should default to system_message for mistral models", () => {
      const result = chooseSchemaStrategy("mistralai/mistral-7b", testSchema);
      expect(result.strategy).toBe("system_message");
    });
  });
});
