/**
 * Parse one-shot output: each code file is a fenced block immediately preceded
 * by a line that is just its filename (App.jsx / access.js). Mirrors the vibes
 * prompt's "filename on its own line before each block" convention, minus
 * SEARCH/REPLACE. A fence with no filename line is ignored.
 */
const FILENAME_RE = /^[\w./-]+\.(?:jsx?|tsx?|css|js)$/;

export function parseFiles(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const name = lines[i].trim();
    if (!FILENAME_RE.test(name)) continue;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") j++;
    if (j >= lines.length || !lines[j].trimStart().startsWith("```")) continue;
    const body: string[] = [];
    let k = j + 1;
    for (; k < lines.length; k++) {
      if (lines[k].trimStart().startsWith("```")) break;
      body.push(lines[k]);
    }
    out[name] = body.join("\n").trim();
    i = k;
  }
  return out;
}
