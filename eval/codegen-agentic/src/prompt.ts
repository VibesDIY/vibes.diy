import type { ModeName } from "./cell.js";

const ONESHOT_IO =
  "\n\n## Output\nEmit each complete file as a fenced code block with the filename on its own line " +
  "immediately before it (e.g. a line `App.jsx` then a ```jsx block, then a line `access.js` then a ```js block). " +
  "Emit whole files, not diffs. Output only the files (a short intro line is fine).";

const AGENTIC_IO =
  "\n\n## Output\nWrite each file by calling the `write_file` tool with `{ path, contents }` (e.g. path `App.jsx`, " +
  "then `access.js` if needed). The tool returns a build + structural check; if it reports problems, call `write_file` " +
  "again with corrected contents. Stop once the check passes.";

export function buildPrompt(mode: ModeName, systemPrompt: string, userPrompt: string): { instructions: string; input: string } {
  return { instructions: systemPrompt + (mode === "oneshot" ? ONESHOT_IO : AGENTIC_IO), input: userPrompt };
}
