import type { LlmConfig } from "./types.js";

// Web Audio is a browser built-in — no import. importModule/importName are
// intentionally omitted so generateImportStatements skips this entry.
export const webAudioConfig: LlmConfig = {
  name: "web-audio",
  label: "Web Audio API",
  module: "web-audio",
  description:
    "Web Audio fundamentals; echo/delay with effects in the feedback path; mic monitoring with a metronome; audio‑clock scheduling; timing design for multi‑channel drum machines and MIDI synths with accurate voice overlap.",
};
