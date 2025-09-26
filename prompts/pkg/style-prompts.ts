import stylePromptsJson from "./style-prompts.json" with { type: "json" };

export interface StylePrompt {
  name: string;
  prompt: string;
}

export const stylePrompts: StylePrompt[] = stylePromptsJson;

// Export the first style prompt (Memphis) as the default
export const defaultStylePrompt = stylePrompts[0].prompt;
