import type { LlmConfig } from "./types.js";

export const createVibeConfig: LlmConfig = {
  name: "create-vibe",
  label: "createVibe",
  description: "Hand off to the builder to generate a second, personalized vibe (interviewer / meta-vibes)",
  importModule: "use-vibes",
  importName: "createVibe",
};
