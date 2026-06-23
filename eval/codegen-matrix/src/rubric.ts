import type { RubricResult } from "./cell.js";

export interface RubricRule {
  /** Stable id used in failedRules + tests. */
  readonly name: string;
  /** Verbatim phrase from prompts/pkg/system-prompt.md this rule is derived from. */
  readonly promptAnchor: string;
  /** True = rule satisfied. `files` maps relative path -> contents. */
  readonly check: (files: Readonly<Record<string, string>>) => boolean;
}

function app(files: Readonly<Record<string, string>>): string {
  return files["App.jsx"] ?? files["/App.jsx"] ?? "";
}

// Emoji detection: pictographic ranges + variation selectors. Plain SVG/text passes.
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;

// A raw bracket color (bg-[#hex] / text-[#hex] / border-[#hex]) appearing inside a
// className attribute. The system prompt requires these to go through a classNames object.
const RAW_BRACKET_IN_CLASSNAME_RE = /className=(?:"|\{\s*"|\{\s*`)[^"`}]*\b(?:bg|text|border)-\[#[0-9a-fA-F]/;

export const rules: readonly RubricRule[] = [
  {
    name: "export-default-app",
    promptAnchor: "export default function App()",
    check: (f) => /export\s+default\s+function\s+App\s*\(/.test(app(f)),
  },
  {
    name: "es-imports-no-globals",
    promptAnchor: "Never reference React or other libraries as globals",
    check: (f) => /^\s*import\s.+from\s+["']/m.test(app(f)) && !/\bwindow\.React\b/.test(app(f)),
  },
  {
    name: "no-raw-bracket-colors",
    promptAnchor: "Never put raw bracket colors directly in JSX",
    check: (f) => !RAW_BRACKET_IN_CLASSNAME_RE.test(app(f)),
  },
  {
    name: "no-emoji",
    promptAnchor: "Never use emojis in the UI",
    check: (f) => !EMOJI_RE.test(app(f)),
  },
  {
    name: "access-in-separate-file",
    promptAnchor: "never put access function code inside",
    // If App.jsx declares an access function, that's a violation regardless of
    // whether access.js exists — access logic must live in access.js only.
    check: (f) => !/\b(?:function\s+access\s*\(|const\s+access\s*=)/.test(app(f)),
  },
];

export function runRubric(files: Readonly<Record<string, string>>): RubricResult {
  const failedRules = rules.filter((r) => !r.check(files)).map((r) => r.name);
  return { passed: rules.length - failedRules.length, total: rules.length, failedRules };
}
