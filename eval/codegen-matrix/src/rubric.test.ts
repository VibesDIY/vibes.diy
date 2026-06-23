import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rules, runRubric } from "./rubric.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT = resolve(__dirname, "../../../prompts/pkg/system-prompt.md");

const passing = `import React, { useState } from "react";
import { useFireproof } from "use-fireproof";

const c = { page: "bg-slate-100", ink: "text-slate-900" };

export default function App() {
  const [n, setN] = useState(0);
  return (
    <div className={c.page}>
      <svg viewBox="0 0 24 24" width="24" height="24" />
      <button onClick={() => setN(n + 1)}>{n}</button>
    </div>
  );
}
`;

describe("runRubric", () => {
  it("passes a clean App.jsx", () => {
    const r = runRubric({ "App.jsx": passing });
    expect(r.failedRules).toEqual([]);
    expect(r.passed).toBe(r.total);
  });

  it("fails when export default is missing", () => {
    const r = runRubric({ "App.jsx": passing.replace("export default function App()", "function App()") });
    expect(r.failedRules).toContain("export-default-app");
  });

  it("fails on a raw bracket color in JSX className", () => {
    const r = runRubric({ "App.jsx": passing.replace("className={c.page}", 'className="bg-[#f1f5f9]"') });
    expect(r.failedRules).toContain("no-raw-bracket-colors");
  });

  it("fails on an emoji in the UI", () => {
    const r = runRubric({ "App.jsx": passing.replace(">{n}<", ">🚀{n}<") });
    expect(r.failedRules).toContain("no-emoji");
  });

  it("fails when access logic lives inside App.jsx (no access.js present)", () => {
    const withAccess = passing.replace("const [n, setN]", "function access(ctx) { return true; }\n  const [n, setN]");
    const r = runRubric({ "App.jsx": withAccess });
    expect(r.failedRules).toContain("access-in-separate-file");
  });
});

describe("rubric drift guard", () => {
  it("every rule's promptAnchor still appears in the system prompt", () => {
    const prompt = readFileSync(SYSTEM_PROMPT, "utf-8");
    const missing = rules.filter((rule) => !prompt.includes(rule.promptAnchor)).map((r) => r.name);
    expect(missing, `anchors missing from system-prompt.md: ${missing.join(", ")}`).toEqual([]);
  });
});
