import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { makeBaseSystemPrompt } from "../../pkg/prompts.js";
import { UserSettings } from "../../pkg/settings.js";
import { VibesDiyEnv } from "~/vibes.diy/app/config/env.js";

// Mock the import.meta.glob function
vi.mock("~/vibes.diy/app/prompts.js", async () => {
  // Create a mock implementation that simulates the behavior of the original
  const llmsModules = {
    "./llms/module1.json": {
      default: { llmsTxtUrl: "https://example.com/llm1.txt", label: "llm1" },
    },
    "./llms/module2.json": {
      default: { llmsTxtUrl: "https://example.com/llm2.txt", label: "llm2" },
    },
  };

  // Return the actual implementation with our mocked modules
  return {
    makeBaseSystemPrompt: async (
      model: string,
      sessionDoc?: Partial<UserSettings>,
    ) => {
      let concatenatedLlmsTxt = "";
      const llmsList = Object.values(llmsModules).map((mod) => mod.default);

      // Simulate the LLM text fetching and caching
      for (const llm of llmsList) {
        concatenatedLlmsTxt += `
<${llm.label}-docs>
Mock documentation for ${llm.label}
</${llm.label}-docs>
`;
      }

      // Get style prompt from session document if available
      const stylePrompt = sessionDoc?.stylePrompt || "DIY zine";

      // Get user prompt from session document if available
      const userPrompt = sessionDoc?.userPrompt || "";

      return `
You are an AI assistant tasked with creating React components. You should create components that:
- Use modern React practices and follow the rules of hooks
- Don't use any TypeScript, just use JavaScript
- Use Tailwind CSS for mobile-first accessible styling, have a ${stylePrompt} vibe
- For dynamic components, like autocomplete, don't use external libraries, implement your own
- Avoid using external libraries unless they are essential for the component to function
- Always import the libraries you need at the top of the file
- Use Fireproof for data persistence
- Use \`callAI\` to fetch AI (set \`stream: true\` to enable streaming), use Structured JSON Outputs like this: \`callAI(prompt, { schema: { properties: { todos: { type: 'array', items: { type: 'string' } } } } })\` and save final responses as individual Fireproof documents.
- For file uploads use drag and drop and store using the \`doc._files\` API
- Don't try to generate png or base64 data, use placeholder image APIs instead
- Consider and potentially reuse/extend code from previous responses if relevant
- Always output the full component code, keep the explanation short and concise
- Keep your component file shorter than 99 lines of code
- In the UI, include a vivid description of the app's purpose and detailed instructions how to use it, in italic text.
- Include a "Demo data" button that adds a handful of documents to the database (maybe via AI or a mock api) to illustrate usage and schema

${concatenatedLlmsTxt}

${
  userPrompt
    ? `${userPrompt}

`
    : ""
}IMPORTANT: You are working in one JavaScript file, use tailwind classes for styling.

Provide a title and brief explanation followed by the component code. The component should demonstrate proper Fireproof integration with real-time updates and proper data persistence. Follow it with a longer description of the app's purpose and detailed instructions how to use it (with occasional bold or italic for emphasis). 

Begin the component with the import statements. Use react, use-fireproof, and call-ai:

\`\`\`js
import React, { ... } from "react"
import { useFireproof } from "use-fireproof"
import { callAI } from "call-ai"
// other imports only when requested
\`\`\`
`;
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Settings and Prompt Integration", () => {
  it("generates a base system prompt with default values when no settings provided", async () => {
    const model = "test-model";
    const prompt = await makeBaseSystemPrompt(model, {
      fallBackUrl: VibesDiyEnv.PROMPT_FALL_BACKURL(),
      callAiEndpoint: VibesDiyEnv.CALLAI_ENDPOINT(),
    });

    // Check that the prompt includes the default style
    expect(prompt).toContain("have a DIY zine vibe");

    // Should not contain any user prompt content
    expect(prompt).not.toContain("Custom user instructions");
  });

  it("uses style prompt from settings document when provided", async () => {
    const model = "test-model";
    const settingsDoc = {
      _id: "user_settings",
      stylePrompt: "synthwave (80s digital aesthetic)",
      fallBackUrl: VibesDiyEnv.PROMPT_FALL_BACKURL(),
      callAiEndpoint: VibesDiyEnv.CALLAI_ENDPOINT(),
    };

    const prompt = await makeBaseSystemPrompt(model, settingsDoc);

    // Check that the prompt includes the custom style
    expect(prompt).toContain("have a synthwave (80s digital aesthetic) vibe");
    expect(prompt).not.toContain("DIY zine");
  });

  it("includes user prompt from settings document when provided", async () => {
    const model = "test-model";
    const userPromptText =
      "Always include a dark mode toggle in your components";
    const settingsDoc = {
      _id: "user_settings",
      userPrompt: userPromptText,
      fallBackUrl: VibesDiyEnv.PROMPT_FALL_BACKURL(),
      callAiEndpoint: VibesDiyEnv.CALLAI_ENDPOINT(),
    };

    const prompt = await makeBaseSystemPrompt(model, settingsDoc);

    // Check that the prompt includes the user prompt
    expect(prompt).toContain(userPromptText);
  });

  it("combines both style and user prompts when both are provided", async () => {
    const model = "test-model";
    const stylePromptText = "brutalist web (raw, grid-heavy)";
    const userPromptText = "Include accessibility features in all components";
    const settingsDoc = {
      _id: "user_settings",
      stylePrompt: stylePromptText,
      userPrompt: userPromptText,
      fallBackUrl: VibesDiyEnv.PROMPT_FALL_BACKURL(),
      callAiEndpoint: VibesDiyEnv.CALLAI_ENDPOINT(),
    };

    const prompt = await makeBaseSystemPrompt(model, settingsDoc);

    // Check that the prompt includes both custom settings
    expect(prompt).toContain(`have a ${stylePromptText} vibe`);
    expect(prompt).toContain(userPromptText);
    expect(prompt).not.toContain("DIY zine");
  });

  it("handles empty settings document gracefully", async () => {
    const model = "test-model";
    const settingsDoc = {
      _id: "user_settings",
      fallBackUrl: VibesDiyEnv.PROMPT_FALL_BACKURL(),
      callAiEndpoint: VibesDiyEnv.CALLAI_ENDPOINT(),
    };

    const prompt = await makeBaseSystemPrompt(model, settingsDoc);

    // Should fall back to defaults
    expect(prompt).toContain("have a DIY zine vibe");
  });

  it("includes LLM documentation in the prompt", async () => {
    const model = "test-model";
    const prompt = await makeBaseSystemPrompt(model, {
      fallBackUrl: VibesDiyEnv.PROMPT_FALL_BACKURL(),
      callAiEndpoint: VibesDiyEnv.CALLAI_ENDPOINT(),
    });

    // Check that the LLM documentation is included
    expect(prompt).toContain("<llm1-docs>");
    expect(prompt).toContain("<llm2-docs>");
    expect(prompt).toContain("Mock documentation for llm1");
    expect(prompt).toContain("Mock documentation for llm2");
  });
});
