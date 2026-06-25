# Generation Core + Verify Gate Implementation Plan

> **For agentic workers:** Parallel execution: use `ultrapowers:ultrapowers` (this plan carries ultraplan markers). Sequential fallback: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a flag-gated, whole-file `write_file` tool-loop code-generation path to the VibesDIY server, parallel to the existing streamed SEARCH/REPLACE path, with a Workers-safe structural verify gate and frontier-designs / cheap-fixes model routing — emitting the existing WebSocket block protocol so the client preview needs zero changes.

**Architecture:** A new handler (`handleWholeFileCodegenRequest`) runs the `@openrouter/agent` `callModel` loop with a `write_file` tool. The tool's `execute` runs a Workers-safe verify (`computeStructure` + theme-token conformance + a syntax heuristic — no esbuild) and returns `{ ok, feedback }`, so the model fixes problems by calling again. The loop streams the file body via `getItemsStream()`, which an emit adapter converts into the existing `block.code.*` events. On a clean loop, the resolved `VibeFile[]` is handed to the existing `handlePromptContext({ fileSystem })` persistence path. The whole new path is gated by `USE_WHOLE_FILE_CODEGEN`; the existing path is untouched.

**Tech Stack:** TypeScript, `@openrouter/agent` (callModel + tool + stop-conditions), `zod` (via the repo's `zod/v4` shim), `@vibes.diy/eval-codegen-matrix/scoring` (pure helpers), `@vibes.diy/call-ai-v2` (block-stream types), Cloudflare Workers runtime (no esbuild / no native deps in the request path), Vitest.

**Acceptance:** waived — experimental PR; real validation is the preview deploy + reviewer judgment, and the deterministic units (verify gate, emit-protocol sequence, loop with a mocked client) are covered by the plan's committed TDD tests. A held-out exam is ill-fitted to a plan-defined server integration whose only spec-derivable behavior ("flag off → existing path unchanged") is already green at baseline.

---

## Global Constraints

These bind every task. ultrapowers forwards this block to every reviewer as their attention lens.

- **Workers-safe request path.** Nothing under `vibes.diy/api/svc/` may import `esbuild` or any native / node-only module. The eval's `build-check.ts` (esbuild) MUST NOT be imported. Verify uses only pure JS + helpers already proven Workers-safe.
- **Reuse only the pure scoring helpers.** Import `computeStructure`, `retryWithBackoff`, `isTransientError` from `@vibes.diy/eval-codegen-matrix/scoring`. Do NOT import `judgeFeature` (pulls `callAi` + `.dev.vars`) or `buildCheck` (esbuild).
- **Additive + gated.** The existing SEARCH/REPLACE path in `prompt-chat-section.ts` must remain byte-for-byte behaviorally unchanged. The new path runs only when `USE_WHOLE_FILE_CODEGEN === "true"`. Default off.
- **Exact block protocol.** The new path MUST emit the `block-stream.ts` event types (`BlockBeginMsg`, `CodeBeginMsg`, `CodeLineMsg`, `CodeEndMsg`, `BlockEndMsg`) with the same field shapes the existing client preview consumes. No client changes.
- **Fireproof rules.** Enforce `agents/rules-bag.md`; `pnpm run rules-bag:constructors` must pass before the plan is declared ready.
- **Repo hygiene.** Never push to `main`. Never manually edit version numbers in `package.json`. Run `pnpm check` and the test suite (`cd vibes.diy/tests && pnpm test`) before the final gate.
- **Concurrency-safe tests.** Same-wave tests must use unique temp paths and no shared on-disk fixtures; mock the OpenRouter client (no network).

---

## File Structure

**Create:**

- `vibes.diy/api/svc/intern/codegen-loop/verify.ts` — Workers-safe `verifyFiles`.
- `vibes.diy/api/svc/intern/codegen-loop/verify.test.ts`
- `vibes.diy/api/svc/intern/codegen-loop/emit-blocks.ts` — whole-file → block-event adapter.
- `vibes.diy/api/svc/intern/codegen-loop/emit-blocks.test.ts`
- `vibes.diy/api/svc/intern/codegen-loop/openrouter-client.ts` — server OpenRouter client factory.
- `vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.ts` — the tool-loop core.
- `vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.test.ts`
- `vibes.diy/api/svc/public/handle-whole-file-codegen.ts` — the new handler.
- `prompts/pkg/system-prompt-agentic.md` — whole-file prompt template.

**Modify:**

- `prompts/pkg/prompts.ts` — add `"agentic-whole-file"` variant to `makeBaseSystemPrompt`.
- `vibes.diy/api/svc/public/prompt-chat-section.ts` — insert the flag-gated branch (~line 2260).

---

### Task 1: Workers-safe verify module

**Type:** implementation
**Depends-on:** none

**Files:**

- Create: `vibes.diy/api/svc/intern/codegen-loop/verify.ts`
- Test: `vibes.diy/api/svc/intern/codegen-loop/verify.test.ts`

**Interfaces:**

- Produces: `verifyFiles(files: Record<string, string>, opts: { needsAccess: boolean }): VerifyResult` and `type VerifyResult = { ok: boolean; problems: string[] }`
- Consumes: `computeStructure` (from `@vibes.diy/eval-codegen-matrix/scoring`)

**Parallelization rationale:** This is the verify contract the loop (Task 5) builds against; fixing it first lets the loop and the gate be written in parallel. A good engineer isolates the gate from the loop wiring regardless of parallelism.

- [ ] **Step 1: Write the failing test**

```typescript
// verify.test.ts
import { describe, it, expect } from "vitest";
import { verifyFiles } from "./verify.js";

describe("verifyFiles", () => {
  it("passes a well-formed App.jsx", () => {
    const files = { "App.jsx": "export default function App(){ return <div>hi</div>; }" };
    expect(verifyFiles(files, { needsAccess: false })).toEqual({ ok: true, problems: [] });
  });
  it("flags a missing default export", () => {
    const files = { "App.jsx": "function App(){ return <div/>; }" };
    const r = verifyFiles(files, { needsAccess: false });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toMatch(/default export/i);
  });
  it("flags missing access.js when access is required", () => {
    const files = { "App.jsx": "export default function App(){ return <div/>; }" };
    const r = verifyFiles(files, { needsAccess: true });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toMatch(/access\.js/i);
  });
  it("flags unbalanced braces as a syntax heuristic", () => {
    const files = { "App.jsx": "export default function App(){ return <div/>; " };
    const r = verifyFiles(files, { needsAccess: false });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toMatch(/unbalanced|syntax/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy && pnpm vitest run api/svc/intern/codegen-loop/verify.test.ts`
Expected: FAIL — `verifyFiles` not found.

- [ ] **Step 3: Write the implementation**

```typescript
// verify.ts
import { computeStructure } from "@vibes.diy/eval-codegen-matrix/scoring";

export type VerifyResult = { ok: boolean; problems: string[] };

// Cheap, Workers-safe syntax heuristic: balanced (), {}, []. Not a parser —
// the authoritative parse/render check is the client render gate (Plan 2).
function balanced(code: string): boolean {
  const pairs: Record<string, string> = { ")": "(", "}": "{", "]": "[" };
  const stack: string[] = [];
  for (const ch of code) {
    if (ch === "(" || ch === "{" || ch === "[") stack.push(ch);
    else if (ch in pairs) {
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return stack.length === 0;
}

export function verifyFiles(files: Record<string, string>, opts: { needsAccess: boolean }): VerifyResult {
  const problems: string[] = [];
  const app = files["App.jsx"] ?? files["/App.jsx"];
  if (!app) return { ok: false, problems: ["App.jsx is missing"] };
  if (!/export\s+default\s+/.test(app)) problems.push("App.jsx has no default export");
  for (const [name, code] of Object.entries(files)) {
    if (!/\.(jsx?|tsx?)$/.test(name)) continue;
    if (!balanced(code)) problems.push(`${name}: unbalanced brackets (likely a syntax error)`);
  }
  const s = computeStructure(files);
  if (opts.needsAccess && !s.hasAccessJs) {
    problems.push("This app needs per-document permissions but no separate access.js was written. Add an access.js file.");
  }
  if (opts.needsAccess && s.accessInAppJsx) {
    problems.push("Access-control logic is in App.jsx; move it into a separate access.js file.");
  }
  return { ok: problems.length === 0, problems };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy && pnpm vitest run api/svc/intern/codegen-loop/verify.test.ts`
Expected: PASS (4 tests). If `computeStructure`'s `StructureSignals` field names differ from `hasAccessJs`/`accessInAppJsx`, adjust to the real names from `@vibes.diy/eval-codegen-matrix/scoring` (see `eval/codegen-matrix/src/structure.ts`).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/intern/codegen-loop/verify.ts vibes.diy/api/svc/intern/codegen-loop/verify.test.ts
git commit -m "feat(codegen-loop): Workers-safe verify gate"
```

---

### Task 2: Whole-file → block-event emit adapter

**Type:** implementation
**Depends-on:** none

**Files:**

- Create: `vibes.diy/api/svc/intern/codegen-loop/emit-blocks.ts`
- Test: `vibes.diy/api/svc/intern/codegen-loop/emit-blocks.test.ts`

**Interfaces:**

- Produces: `buildBlockEvents(files: { filename: string; lang: string; content: string }[], ids: BlockIds): PromptAndBlockMsgs[]` and `type BlockIds = { blockId: string; streamId: string; sectionIdFor: (filename: string) => string; nextSeq: () => number; blockNr: number; usage: BlockUsage }`
- Consumes: `BlockBeginMsg`, `CodeBeginMsg`, `CodeLineMsg`, `CodeEndMsg`, `BlockEndMsg`, `BlockUsage` (from `@vibes.diy/call-ai-v2`)

**Parallelization rationale:** The emit adapter is a pure transform (files → ordered block events) testable in isolation against the `block-stream.ts` types; isolating it lets the handler (Task 7) be written against a fixed event-builder contract instead of inlining the sequence. A good engineer extracts this pure mapping regardless.

- [ ] **Step 1: Write the failing test**

```typescript
// emit-blocks.test.ts
import { describe, it, expect } from "vitest";
import { buildBlockEvents } from "./emit-blocks.js";

describe("buildBlockEvents", () => {
  it("emits begin → per-file code.begin/line*/end → block.end", () => {
    let seq = 0;
    const events = buildBlockEvents([{ filename: "/App.jsx", lang: "jsx", content: "line1\nline2" }], {
      blockId: "B1",
      streamId: "P1",
      sectionIdFor: () => "S1",
      nextSeq: () => seq++,
      blockNr: 0,
      usage: { given: [], calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } },
    });
    const types = events.map((e) => e.type);
    expect(types).toEqual(["block.begin", "block.code.begin", "block.code.line", "block.code.line", "block.code.end", "block.end"]);
    const lines = events.filter((e) => e.type === "block.code.line") as { line: string; lineNr: number }[];
    expect(lines.map((l) => l.line)).toEqual(["line1", "line2"]);
    expect(lines.map((l) => l.lineNr)).toEqual([0, 1]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy && pnpm vitest run api/svc/intern/codegen-loop/emit-blocks.test.ts`
Expected: FAIL — `buildBlockEvents` not found.

- [ ] **Step 3: Write the implementation**

Mirror the sequence `handleFSPrompt` emits (`prompt-chat-section.ts:1938-1980`). Each event satisfies its `block-stream.ts` type.

```typescript
// emit-blocks.ts
import type { BlockBeginMsg, CodeBeginMsg, CodeLineMsg, CodeEndMsg, BlockEndMsg, BlockUsage } from "@vibes.diy/call-ai-v2";

export type BlockEvent = BlockBeginMsg | CodeBeginMsg | CodeLineMsg | CodeEndMsg | BlockEndMsg;
export type BlockIds = {
  blockId: string;
  streamId: string;
  sectionIdFor: (filename: string) => string;
  nextSeq: () => number;
  blockNr: number;
  usage: BlockUsage;
};

export function buildBlockEvents(files: { filename: string; lang: string; content: string }[], ids: BlockIds): BlockEvent[] {
  const now = new Date();
  const base = { blockId: ids.blockId, streamId: ids.streamId, blockNr: ids.blockNr, timestamp: now };
  const events: BlockEvent[] = [{ type: "block.begin", seq: ids.nextSeq(), ...base }];
  let codeLines = 0,
    codeBytes = 0;
  for (const file of files) {
    const sectionId = ids.sectionIdFor(file.filename);
    events.push({ type: "block.code.begin", sectionId, lang: file.lang, path: file.filename, seq: ids.nextSeq(), ...base });
    const lines = file.content.split("\n");
    lines.forEach((line, lineNr) => {
      events.push({
        type: "block.code.line",
        sectionId,
        lang: file.lang,
        path: file.filename,
        line,
        lineNr,
        seq: ids.nextSeq(),
        ...base,
      });
    });
    codeLines += lines.length;
    codeBytes += new TextEncoder().encode(file.content).length;
    events.push({
      type: "block.code.end",
      sectionId,
      lang: file.lang,
      path: file.filename,
      stats: { lines: lines.length, bytes: codeBytes },
      seq: ids.nextSeq(),
      ...base,
    });
  }
  events.push({
    type: "block.end",
    stats: {
      toplevel: { lines: 0, bytes: 0 },
      code: { lines: codeLines, bytes: codeBytes },
      image: { lines: 0, bytes: 0 },
      total: { lines: codeLines, bytes: codeBytes },
    },
    usage: ids.usage,
    seq: ids.nextSeq(),
    ...base,
  });
  return events;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy && pnpm vitest run api/svc/intern/codegen-loop/emit-blocks.test.ts`
Expected: PASS. If the type checker rejects a field, reconcile against the real `block-stream.ts` definitions (begin/code.begin/code.line/code.end/block.end) — they are the source of truth.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/intern/codegen-loop/emit-blocks.ts vibes.diy/api/svc/intern/codegen-loop/emit-blocks.test.ts
git commit -m "feat(codegen-loop): whole-file to block-event adapter"
```

---

### Task 3: Agentic whole-file system-prompt variant

**Type:** implementation
**Depends-on:** none

**Files:**

- Create: `prompts/pkg/system-prompt-agentic.md`
- Modify: `prompts/pkg/prompts.ts` (the `makeBaseSystemPrompt` function and its template-selection logic)

**Interfaces:**

- Produces: a `makeBaseSystemPrompt(..., { variant: "agentic-whole-file" })` path that loads `system-prompt-agentic.md` and substitutes the same placeholders (`{{THEME_DESIGN}}`, `{{STYLE_PROMPT}}`, `{{USER_PROMPT}}`, etc.)

**Parallelization rationale:** The prompt variant is an independent file + a localized template-selection change; isolating it lets prompt iteration proceed without touching the server loop. A good engineer keeps prompt templates separate from runtime wiring.

- [ ] **Step 1: Create the template**

Copy `prompts/pkg/system-prompt-initial.md` to `prompts/pkg/system-prompt-agentic.md`, then replace the SEARCH/REPLACE output-protocol section with whole-file `write_file` instructions. Keep ALL `{{PLACEHOLDER}}` tokens intact. Use the eval's whole-file output language as the replacement (from `eval/codegen-agentic/config/system-prompt.md`):

```markdown
## Output

Write each file by calling the `write_file` tool with `{ path, contents }`, where `contents` is the COMPLETE file. Produce a complete, working `App.jsx`. If the app needs per-document write validation or channel-based read isolation, also produce a separate `access.js`. After each write you receive a build + structural check; if it reports problems, call `write_file` again with the corrected complete file. Do not emit SEARCH/REPLACE edits and do not narrate diffs — always write whole files.
```

Remove any remaining SEARCH/REPLACE examples and the "incremental edits / re-mounts preview" guidance, since whole-file writes replace them.

- [ ] **Step 2: Write the failing test**

```typescript
// prompts/pkg/prompts.agentic.test.ts
import { describe, it, expect } from "vitest";
import { makeBaseSystemPrompt } from "./prompts.js";

describe("makeBaseSystemPrompt agentic variant", () => {
  it("loads the whole-file template and resolves placeholders", async () => {
    const prompt = await makeBaseSystemPrompt(/* existing required args */ {} as any, { variant: "agentic-whole-file" } as any);
    expect(prompt).toMatch(/write_file/);
    expect(prompt).not.toMatch(/<<<<<<< SEARCH/);
    expect(prompt).not.toMatch(/\{\{/); // all placeholders resolved
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run prompts/pkg/prompts.agentic.test.ts`
Expected: FAIL — variant not handled / template not found.

- [ ] **Step 4: Add the variant to `makeBaseSystemPrompt`**

In `prompts/pkg/prompts.ts` (around the template-selection at line ~351), extend the variant union so `"agentic-whole-file"` loads `system-prompt-agentic.md`; reuse the exact same placeholder-substitution code path that the existing `initial`/`continuation` templates use, so theme/style/user injection is identical.

```typescript
// pseudo-shape — match the real signature
const templateFile =
  variant === "agentic-whole-file" ? "system-prompt-agentic.md" : isInitial ? "system-prompt-initial.md" : "system-prompt.md";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run prompts/pkg/prompts.agentic.test.ts`
Expected: PASS. Adjust the test's `makeBaseSystemPrompt` args to the real required parameters.

- [ ] **Step 6: Commit**

```bash
git add prompts/pkg/system-prompt-agentic.md prompts/pkg/prompts.ts prompts/pkg/prompts.agentic.test.ts
git commit -m "feat(prompts): agentic whole-file system-prompt variant"
```

---

### Task 4: Server OpenRouter client factory

**Type:** implementation
**Depends-on:** none

**Files:**

- Create: `vibes.diy/api/svc/intern/codegen-loop/openrouter-client.ts`

**Interfaces:**

- Produces: `makeOpenRouterClient(env: { get(key: string): string | undefined }): OpenRouter`
- Consumes: `OpenRouter` from `@openrouter/agent`

**Parallelization rationale:** The client factory is a tiny, dependency-free seam the loop consumes; isolating it lets the loop be unit-tested with a mock client and keeps secret resolution in one place. A good engineer centralizes client construction.

- [ ] **Step 1: Write the implementation (mirror `eval/codegen-agentic/src/client.ts`)**

```typescript
// openrouter-client.ts
import { OpenRouter } from "@openrouter/agent";

export function makeOpenRouterClient(env: { get(key: string): string | undefined }): OpenRouter {
  const apiKey = env.get("OPENROUTER_API_KEY");
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set for the whole-file codegen path");
  return new OpenRouter({ apiKey });
}
```

Confirm the exact `OpenRouter` constructor shape against `eval/codegen-agentic/src/client.ts` and the installed `@openrouter/agent` types; match it verbatim.

- [ ] **Step 2: Commit**

```bash
git add vibes.diy/api/svc/intern/codegen-loop/openrouter-client.ts
git commit -m "feat(codegen-loop): server OpenRouter client factory"
```

---

### Task 5: Whole-file tool-loop core

**Type:** implementation
**Depends-on:** 1, 4

**Files:**

- Create: `vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.ts`
- Test: `vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.test.ts`

**Interfaces:**

- Produces: `runWholeFileCodegen(args: RunArgs): Promise<WholeFileResult>` where `type RunArgs = { client: OpenRouter; model: string; systemPrompt: string; userPrompt: string; needsAccess: boolean; maxSteps: number; maxCostUsd: number; retries?: number; onLine?: (file: string, lang: string, line: string, lineNr: number) => void }` and `type WholeFileResult = { files: { filename: string; lang: string; content: string }[]; usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }`
- Consumes: `verifyFiles` (Task 1), `OpenRouter` (Task 4), `retryWithBackoff`, `isTransientError` (from `@vibes.diy/eval-codegen-matrix/scoring`), `tool` + `stepCountIs` + `maxCost` (from `@openrouter/agent`)

- [ ] **Step 1: Write the failing test (mock the OpenRouter client)**

```typescript
// whole-file-loop.test.ts
import { describe, it, expect, vi } from "vitest";
import { runWholeFileCodegen } from "./whole-file-loop.js";

function mockClientWritingApp(contents: string) {
  // Minimal ModelResult-shaped mock: callModel executes the write_file tool once
  // with `contents`, then resolves getText/getResponse.
  return {
    callModel: ({ tools }: any) => {
      const writeFile = tools[0];
      const exec = writeFile.execute({ path: "/App.jsx", contents });
      return {
        getText: async () => {
          await exec;
          return "";
        },
        getResponse: async () => ({ usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 } }),
        getItemsStream: async function* () {},
      };
    },
  } as any;
}

describe("runWholeFileCodegen", () => {
  it("returns the written file on a clean verify", async () => {
    const app = "export default function App(){ return <div>ok</div>; }";
    const r = await runWholeFileCodegen({
      client: mockClientWritingApp(app),
      model: "frontier",
      systemPrompt: "sys",
      userPrompt: "make an app",
      needsAccess: false,
      maxSteps: 4,
      maxCostUsd: 0.5,
    });
    expect(r.files[0].filename).toBe("/App.jsx");
    expect(r.files[0].content).toBe(app);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy && pnpm vitest run api/svc/intern/codegen-loop/whole-file-loop.test.ts`
Expected: FAIL — `runWholeFileCodegen` not found.

- [ ] **Step 3: Write the implementation (lift `eval/codegen-agentic/src/agentic.ts`, Workers-safe verify, streaming hook)**

```typescript
// whole-file-loop.ts
import { tool } from "@openrouter/agent/tool";
import { stepCountIs, maxCost } from "@openrouter/agent/stop-conditions";
import { retryWithBackoff, isTransientError } from "@vibes.diy/eval-codegen-matrix/scoring";
import { z } from "zod";
import type { OpenRouter } from "@openrouter/agent";
import { verifyFiles } from "./verify.js";

export type RunArgs = {
  client: OpenRouter;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  needsAccess: boolean;
  maxSteps: number;
  maxCostUsd: number;
  retries?: number;
  onLine?: (file: string, lang: string, line: string, lineNr: number) => void;
};
export type WholeFileResult = {
  files: { filename: string; lang: string; content: string }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

async function runOnce(args: RunArgs): Promise<WholeFileResult> {
  const files: Record<string, string> = {};
  const writeFileConfig = {
    name: "write_file",
    description: "Write a complete file (App.jsx or access.js). Returns a build + structural check; fix problems by calling again.",
    inputSchema: z.object({ path: z.string(), contents: z.string() }),
    execute: async ({ path, contents }: { path: string; contents: string }) => {
      const filename = path.startsWith("/") ? path : `/${path}`;
      files[filename] = contents;
      const v = verifyFiles(files, { needsAccess: args.needsAccess });
      return v.ok ? { ok: true, feedback: "Build and structural checks pass." } : { ok: false, feedback: v.problems.join("\n") };
    },
  };
  const writeFile = tool(writeFileConfig as unknown as Parameters<typeof tool>[0]);
  const result = args.client.callModel({
    model: args.model,
    instructions: args.systemPrompt,
    input: args.userPrompt,
    tools: [writeFile],
    stopWhen: [stepCountIs(args.maxSteps), maxCost(args.maxCostUsd)],
  });
  await result.getText();
  const response = await result.getResponse();
  const u = (response as any).usage ?? {};
  return {
    files: Object.entries(files).map(([filename, content]) => ({
      filename,
      lang: filename.endsWith(".jsx") || filename.endsWith(".tsx") ? "jsx" : "js",
      content,
    })),
    usage: {
      prompt_tokens: u.inputTokens ?? 0,
      completion_tokens: u.outputTokens ?? 0,
      total_tokens: u.totalTokens ?? (u.inputTokens ?? 0) + (u.outputTokens ?? 0),
    },
  };
}

export async function runWholeFileCodegen(args: RunArgs): Promise<WholeFileResult> {
  return retryWithBackoff(() => runOnce(args), { retries: args.retries ?? 2, isRetryable: isTransientError });
}
```

Match the `callModel` / `tool` / `getResponse().usage` shapes against the real `@openrouter/agent` types and `eval/codegen-agentic/src/agentic.ts`; the streaming `onLine` wiring lands in Task 6.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy && pnpm vitest run api/svc/intern/codegen-loop/whole-file-loop.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.ts vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.test.ts
git commit -m "feat(codegen-loop): whole-file tool-loop core with Workers-safe verify"
```

---

### Task 6: Live streaming + frontier/cheap model routing

**Type:** implementation
**Depends-on:** 5

**Files:**

- Modify: `vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.ts`
- Test: `vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.test.ts`

**Interfaces:**

- Produces: `RunArgs.model` accepts `string | ((ctx: { numberOfTurns: number }) => string)`; `onLine` is invoked for each streamed file line via `result.getItemsStream()`
- Consumes: `getItemsStream()` on the `ModelResult` (from `@openrouter/agent`)

- [ ] **Step 1: Write the failing test (streaming emits lines; router picks cheap model after turn 1)**

```typescript
// add to whole-file-loop.test.ts
it("invokes onLine for each streamed file line", async () => {
  const seen: string[] = [];
  // extend the mock's getItemsStream to yield a function_call item whose
  // arguments contain a two-line file; assert onLine receives both lines.
  // (Mock shape mirrors @openrouter/agent StreamableOutputItem.)
  // ...
  expect(seen).toEqual(["line1", "line2"]);
});
it("routes model as a function of numberOfTurns", () => {
  const pick = (ctx: { numberOfTurns: number }) => (ctx.numberOfTurns > 1 ? "cheap" : "frontier");
  expect(pick({ numberOfTurns: 1 })).toBe("frontier");
  expect(pick({ numberOfTurns: 2 })).toBe("cheap");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy && pnpm vitest run api/svc/intern/codegen-loop/whole-file-loop.test.ts`
Expected: FAIL — streaming not wired / model not callable as a function.

- [ ] **Step 3: Wire streaming + dynamic model**

In `runOnce`, before `await result.getText()`, drain `getItemsStream()` concurrently and call `args.onLine` for each new line of a `write_file` argument (track per-file line counts so re-emitted growing items don't double-fire). Pass `model: args.model` straight through — `@openrouter/agent` accepts a `(ctx) => string` per its dynamic-parameters API; confirm against the installed types.

```typescript
const streaming = (async () => {
  if (!args.onLine) return;
  for await (const item of result.getItemsStream()) {
    // when item is a write_file function_call with a path + partial contents,
    // diff against the last emitted line count for that path and emit new lines
  }
})();
await result.getText();
await streaming;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy && pnpm vitest run api/svc/intern/codegen-loop/whole-file-loop.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.ts vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.test.ts
git commit -m "feat(codegen-loop): live line streaming + frontier/cheap model routing"
```

---

### Task 7: The whole-file codegen handler

**Type:** implementation
**Depends-on:** 2, 3, 4, 5, 6

**Files:**

- Create: `vibes.diy/api/svc/public/handle-whole-file-codegen.ts`

**Interfaces:**

- Produces: `handleWholeFileCodegenRequest(deps): Promise<Result<number>>` (returns the final block sequence, matching the existing LLM handler's return contract)
- Consumes: `runWholeFileCodegen` (Task 5/6), `buildBlockEvents` (Task 2), `makeBaseSystemPrompt({ variant: "agentic-whole-file" })` (Task 3), `makeOpenRouterClient` (Task 4), and the existing `assemblePromptPayload`, `appendBlockEvent`, `handlePromptContext` from `prompt-chat-section.ts` / `prompt-assembly.ts`

- [ ] **Step 1: Write the handler**

Assemble the prompt with the agentic variant, run the loop (frontier first turn, cheap thereafter), stream lines out as `block.code.line` events via `appendBlockEvent({ emitMode: "emit-only" })`, then emit the closing `block.code.end` + `block.end` from `buildBlockEvents`, and persist by handing the resolved `VibeFile[]` to `handlePromptContext({ fileSystem })`. Mirror the id-allocation and `appendBlockEvent` call shape used by `handleFSPrompt` (`prompt-chat-section.ts:1938-1980`) and the persistence shape in `handlePromptContext` (`:745-821`).

```typescript
// handle-whole-file-codegen.ts (shape — fill exact deps from the call site in Task 8)
export async function handleWholeFileCodegenRequest(deps: WholeFileCodegenDeps): Promise<Result<number>> {
  const { vctx, req, orig, promptId, blockSeq } = deps;
  const assembled = await assemblePromptPayload(vctx, { /* same args as the existing path */ });
  if (assembled.isErr()) return Result.Err(assembled);
  const systemPrompt = await makeBaseSystemPrompt(/* args */, { variant: "agentic-whole-file" });
  const client = makeOpenRouterClient(vctx.sthis.env);
  const blockId = vctx.sthis.nextId(12).str;
  let seq = blockSeq;
  const emit = (evt: unknown) => appendBlockEvent({ ...deps, blockSeq: seq++, evt, emitMode: "emit-only" });
  // ... emit block.begin + per-file code.begin; stream code.line via onLine; emit code.end + block.end ...
  const result = await runWholeFileCodegen({
    client, systemPrompt, userPrompt: /* user text */,
    model: (ctx) => (ctx.numberOfTurns > 1 ? deps.cheapModel : deps.frontierModel),
    needsAccess: deps.needsAccess, maxSteps: 4, maxCostUsd: 0.5,
    onLine: (file, lang, line, lineNr) => { /* emit a CodeLineMsg */ },
  });
  const vibeFiles = result.files.map((f) => ({ type: "code-block" as const, filename: f.filename, lang: f.lang, content: f.content }));
  return handlePromptContext({ ...deps, fileSystem: vibeFiles, /* usage from result.usage */ });
}
```

- [ ] **Step 2: Verify it type-checks against the real signatures**

Run: `cd vibes.diy && pnpm tsc --noEmit -p api/tsconfig.json` (or the repo's typecheck command from `agents/code-quality.md`)
Expected: no errors in `handle-whole-file-codegen.ts`. Reconcile `deps` field names with the real `appendBlockEvent` / `handlePromptContext` / `assemblePromptPayload` parameter objects.

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/svc/public/handle-whole-file-codegen.ts
git commit -m "feat(svc): whole-file codegen handler (loop + emit + persist)"
```

---

### Task 8: Flag-gated branch in promptChatSection

**Type:** implementation
**Depends-on:** 7

**Files:**

- Modify: `vibes.diy/api/svc/public/prompt-chat-section.ts` (the LLM branch, ~lines 2259-2286)

**Interfaces:**

- Consumes: `handleWholeFileCodegenRequest` (Task 7)

- [ ] **Step 1: Insert the gated branch**

Inside the existing `else if (isReqPromptLLMChatSection(orig))` block, route to the new handler only when the flag is on and the request is a creation/codegen prompt; otherwise fall through to the existing path unchanged.

```typescript
} else if (isReqPromptLLMChatSection(orig)) {
  const useWholeFile = vctx.sthis.env.get("USE_WHOLE_FILE_CODEGEN") === "true";
  if (useWholeFile && isReqCreationPromptChatSection(orig)) {
    prompSectionAction = async (scope, blockSeq) =>
      handleWholeFileCodegenRequest({ vctx, req, orig, /* promptId, deps */, blockSeq });
  } else {
    // EXISTING PATH — unchanged
    prompSectionAction = async (scope, blockSeq) => {
      const res = await handlerLlmRequest({ /* unchanged */ });
      const finalBlockSeq = await handleLlmResponse({ /* unchanged */ });
      return Result.Ok(finalBlockSeq);
    };
  }
}
```

- [ ] **Step 2: Manual smoke (flag off → identical behavior)**

Run the existing svc test suite with the flag unset and confirm no diffs:
Run: `cd vibes.diy/tests && pnpm test`
Expected: PASS, existing codegen behavior unchanged (flag defaults off).

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/svc/public/prompt-chat-section.ts
git commit -m "feat(svc): flag-gate the whole-file codegen path (USE_WHOLE_FILE_CODEGEN)"
```

---

### Task 9: Full verification gate

**Type:** gate
**Depends-on:** 8

- [ ] `pnpm check` (format + build + test + lint) passes.
- [ ] `cd vibes.diy/tests && pnpm test` passes with the flag off (existing path unaffected).
- [ ] `pnpm run rules-bag:constructors` passes.
- [ ] Manual preview check (post-merge runbook): set `USE_WHOLE_FILE_CODEGEN=true` on the preview deploy, generate a vibe, confirm the app streams in and renders, and confirm `OPENROUTER_API_KEY` is configured for the preview environment.

---

## Global Constraints coverage note

The verify gate is intentionally **structural + conformance only** (no esbuild) because `esbuild` does not run in the Cloudflare Workers request path. The authoritative parse/render validation is the **client render gate (Plan 2)**, which runs where the DOM and JSX transform already live. This plan's verify is the in-loop feedback that lets the model self-correct structural problems; it is not the full reliability gate.
