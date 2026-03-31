import type { LlmConfig } from "./types.js";

export const fireproofConfig: LlmConfig = {
  name: "fireproof",
  label: "useFireproof",
  module: "use-fireproof",
  description: "local-first database with encrypted live sync",
  importModule: "use-fireproof",
  importName: "useFireproof",
};
