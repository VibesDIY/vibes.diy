import type { LlmConfig } from "./types.js";

// Server-side file, like access.js — nothing is imported into App.jsx, so no
// importModule/importName (the prompt builder skips the import line for it).
export const backendConfig: LlmConfig = {
  name: "backend",
  label: "backend-js",
  description:
    "server-side backend.js file: answer HTTP/webhook requests at the app's /_api URL, react to committed data changes, and run scheduled jobs — its writes go through the app's own access rules",
};
