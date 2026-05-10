import type { LlmConfig } from "./types.js";

export const useViewerConfig: LlmConfig = {
  name: "use-viewer",
  label: "Viewer Identity",
  module: "use-vibes",
  description: "Get the current viewer's identity and capability gates",
  importModule: "use-vibes",
  importName: "useViewer",
};
