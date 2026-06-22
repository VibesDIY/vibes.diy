import type { LlmConfig } from "./types.js";

export const useVibeConfig: LlmConfig = {
  name: "use-vibe",
  label: "Vibe Write Gating",
  description: "Gate write surfaces on the app's own access.js via useVibe().can",
  importModule: "use-vibes",
  importName: "useVibe",
};
