import type { LlmConfig } from "./types.js";

// Server-side reactors (#2856). No importModule/importName: backend.js handlers
// are authored as exports of a file, not imported from a package — so the prompt
// builder includes the doc text without an import line (like web-audio's
// browser-built-in entry). Opt-in only (not in getDefaultSkills): emit a
// backend.js only when the app needs server-side logic.
export const backendJsConfig: LlmConfig = {
  name: "backend-js",
  label: "Backend handlers",
  description: "Server-side fetch/scheduled/onChange reactors for webhooks, OAuth, polling, and post-write side effects",
};
