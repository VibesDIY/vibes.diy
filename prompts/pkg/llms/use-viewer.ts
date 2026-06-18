import type { LlmConfig } from "./types.js";

export const useViewerConfig: LlmConfig = {
  name: "use-viewer",
  label: "Viewer Identity",
  description: "Get the current viewer's identity and capability gates",
  importModule: "use-vibes",
  importName: "useViewer",
};
