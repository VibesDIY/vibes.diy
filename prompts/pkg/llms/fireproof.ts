import type { LlmConfig } from "./types.js";

export const fireproofConfig: LlmConfig = {
  name: "fireproof",
  label: "useFireproof",
  description: "cloud-backed document database with encrypted live sync",
  importModule: "use-fireproof",
  importName: "useFireproof",
};
