# PR #2650 — Themed Cold-Open Foundation + Correctness/Honesty Cleanup Implementation Plan

> **For agentic workers:** Parallel execution: use `ultrapowers:ultrapowers` (this plan carries ultraplan markers). Sequential fallback: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Acceptance:** waived — verification of record is the operator's manual preview browser pass (spec A1/A3) on the deployed PR preview (https://pr-2650-vibes-diy-v2.jchris.workers.dev). Per this PR's documented process lesson ("unit tests passed at every step and missed all of the headline"), no held-out automated exam is authored: a green automated suite here would re-create the exact false-confidence failure mode. Each implementation task carries its own committed TDD tests for the *mechanical* criteria (wire shape, slug→theme translation, unicode decode, EOF flush, verify-before-return, gating); `pnpm run build` (tsc) + `cd vibes.diy/tests && pnpm test` + `pnpm run rules-bag:constructors` gate CI; the visual headline (themed cold open paints themed; no reliability regression) is confirmed by the operator in the browser at the pre-merge gate.

**Goal:** Make the themed cold open paint in the pre-allocated theme on a *fresh* whole-file generation by delivering the theme to the client at stream start, and clear the three real correctness bugs + small rules-bag remnants so PR #2650 is honest and safe to take out of draft.

**Architecture:** The client already has full theme plumbing (`setTheme`/`setColorTheme` actions + reducer cases in `prompt-state.ts`, `coldOpenSlugFrom` fallback in `PreviewApp.tsx`); the only gap is that the theme never reaches the client during the live stream. We add a first-class section-event (`prompt.section-theme`) to the wire protocol, emit it as the first event of the whole-file (flag-on) stream from the already-loaded `active.theme` slug, and translate it on the client into the existing `setTheme` dispatch. Production SEARCH/REPLACE never emits the new event, so flag-off behavior is identical. Separately we fix three real bugs in `whole-file-loop.ts` and a couple of rules-bag remnants.

**Tech Stack:** TypeScript, arktype (wire types), React + vitest + @testing-library/react (client), Cloudflare Workers runtime (server), `@vibes.diy/prompts` (theme catalog).

## Global Constraints

- **Flag-off SEARCH/REPLACE path stays behaviorally identical** — the new `prompt.section-theme` wire event is emitted ONLY inside `handle-whole-file-codegen.ts` (reached only when `routeWholeFile` is true). Production must never emit it.
- **`pnpm run rules-bag:constructors` must stay green** (currently: 14 tracked baseline, 0 new violations). Honor `agents/rules-bag.md`: never `new TextEncoder`/`new TextDecoder` (use `vctx.sthis.txt.encode` / `this.txt.encode`); no falsy `if (!x)` on booleans/optionals (use `=== false` / `=== undefined`); ≤3 positional params (use an object arg); prefer `exception2Result()` / `Result` over `try/catch` / `throw`.
- **`import React from "react"` is the established repo convention** (23 component files use it) — do NOT convert ThemedSkeleton's React import; Charlie's default-import note on it is declined as inconsistent with the codebase.
- **Tests:** vitest. Named vitest imports, explicit `.js` extensions on local imports, `@testing-library/react` for components. App tests live in `vibes.diy/tests/app/`; api/type tests in `vibes.diy/api/tests/`. Full app suite: `cd vibes.diy/tests && pnpm test`.
- **CI:** `compile_test` runs format + lint + `pnpm run build` (tsc) — the build (not just tests/lint) must pass.
- **Repo workflow:** never push to `main`; rebase, don't squash. The integration target for this work is the existing PR branch `experiment/codegen-magic-harness`.
- **Verification of record:** the manual preview browser pass — not automatable; it is the operator's pre-merge gate.

---

### Task 1: Add `PromptSectionTheme` to the section-event wire protocol

**Type:** implementation
**Depends-on:** none

**Files:**
- Modify: `vibes.diy/api/types/prompt.ts` (union at line 83; add new member type above it)
- Test: `vibes.diy/api/tests/prompt-section-theme.test.ts`

**Interfaces:**
- Consumes: `PromptBase` (existing, `prompt.ts`: `{ streamId, chatId, seq, timestamp }`)
- Produces: `PromptSectionTheme` arktype + type (`{ type: "prompt.section-theme", theme: string, "colorTheme?": string }` & `PromptBase`); `PromptMsgs` union now includes `'prompt.section-theme'`.

**Parallelization rationale:** front-loaded contract — fixing the wire shape up front lets the server emit (Task 2) and the client translation (Task 3) build against it in parallel without one waiting on the other.

- [ ] **Step 1: Write the failing test**

```ts
// vibes.diy/api/tests/prompt-section-theme.test.ts
import { describe, expect, it } from "vitest";
import { type } from "arktype";
import { PromptMsgs, PromptSectionTheme } from "../types/prompt.js";

describe("PromptSectionTheme", () => {
  const base = { streamId: "s1", chatId: "c1", seq: 0, timestamp: new Date().toISOString() };

  it("accepts a theme-only section-theme event", () => {
    const evt = { type: "prompt.section-theme", theme: "aether", ...base };
    expect(PromptSectionTheme(evt) instanceof type.errors).toBe(false);
    expect(PromptMsgs(evt) instanceof type.errors).toBe(false);
  });

  it("accepts an optional colorTheme", () => {
    const evt = { type: "prompt.section-theme", theme: "aether", colorTheme: "acid-pop", ...base };
    expect(PromptMsgs(evt) instanceof type.errors).toBe(false);
  });

  it("rejects a missing theme slug", () => {
    const evt = { type: "prompt.section-theme", ...base };
    expect(PromptMsgs(evt) instanceof type.errors).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run the api test (vitest) for `prompt-section-theme.test.ts`.
Expected: FAIL — `PromptSectionTheme` is not exported / `prompt.section-theme` not in the union.

- [ ] **Step 3: Add the type and extend the union**

In `vibes.diy/api/types/prompt.ts`, immediately before the `PromptMsgs` union (line 83), add:

```ts
export const PromptSectionTheme = type({
  type: "'prompt.section-theme'",
  theme: "string",
  "colorTheme?": "string",
}).and(PromptBase);

export type PromptSectionTheme = typeof PromptSectionTheme.infer;
```

Then add `.or(PromptSectionTheme)` to the union:

```ts
export const PromptMsgs = PromptBlockBegin.or(PromptBlockEnd).or(PromptReq).or(PromptError).or(PromptFS).or(PromptDryRunPayload).or(PromptSectionTheme);
```

- [ ] **Step 4: Run the test and the build**

Run the api test again — expect PASS. Then `pnpm run build` (tsc) — expect no type errors (the union widening is additive; `PromptAndBlockMsgs` in `chat.ts` derives from `PromptMsgs`).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/types/prompt.ts vibes.diy/api/tests/prompt-section-theme.test.ts
git commit -m "feat(whole-file): add prompt.section-theme wire event to PromptMsgs"
```

---

### Task 2: Emit `prompt.section-theme` first in the whole-file handler

**Type:** implementation
**Depends-on:** 1

**Files:**
- Create: `vibes.diy/api/svc/intern/codegen-loop/section-theme-event.ts` (pure builder)
- Modify: `vibes.diy/api/svc/public/handle-whole-file-codegen.ts` (emit the builder's event as the first `enqueue`, guarded on `sessionDoc.theme`)
- Test: `vibes.diy/api/tests/section-theme-event.test.ts`

**Interfaces:**
- Consumes: `PromptSectionTheme` (Task 1)
- Produces: `buildSectionThemeEvent(args: { theme: string; colorTheme?: string; streamId: string; chatId: string; seq: number; timestamp: Date }): PromptSectionTheme`

**Parallelization rationale:** the emit lives only in `handle-whole-file-codegen.ts` and a new isolated builder file — no overlap with the client file (Task 3) or the loop file (Tasks 4-6), so it runs concurrently with them.

- [ ] **Step 1: Write the failing test for the pure builder**

```ts
// vibes.diy/api/tests/section-theme-event.test.ts
import { describe, expect, it } from "vitest";
import { buildSectionThemeEvent } from "../svc/intern/codegen-loop/section-theme-event.js";

describe("buildSectionThemeEvent", () => {
  const base = { streamId: "s1", chatId: "c1", seq: 3, timestamp: new Date(0) };

  it("builds a theme-only event", () => {
    const evt = buildSectionThemeEvent({ theme: "aether", ...base });
    expect(evt).toEqual({ type: "prompt.section-theme", theme: "aether", streamId: "s1", chatId: "c1", seq: 3, timestamp: new Date(0) });
  });

  it("includes colorTheme only when a non-empty slug is given", () => {
    expect(buildSectionThemeEvent({ theme: "aether", colorTheme: "acid-pop", ...base }).colorTheme).toBe("acid-pop");
    expect("colorTheme" in buildSectionThemeEvent({ theme: "aether", colorTheme: "", ...base })).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run the api test — expect FAIL (module not found).

- [ ] **Step 3: Write the pure builder**

```ts
// vibes.diy/api/svc/intern/codegen-loop/section-theme-event.ts
import type { PromptSectionTheme } from "../../../types/prompt.js";

export function buildSectionThemeEvent(args: {
  theme: string;
  colorTheme?: string;
  streamId: string;
  chatId: string;
  seq: number;
  timestamp: Date;
}): PromptSectionTheme {
  const evt: PromptSectionTheme = {
    type: "prompt.section-theme",
    theme: args.theme,
    streamId: args.streamId,
    chatId: args.chatId,
    seq: args.seq,
    timestamp: args.timestamp,
  };
  if (typeof args.colorTheme === "string" && args.colorTheme.length > 0) {
    evt.colorTheme = args.colorTheme;
  }
  return evt;
}
```

- [ ] **Step 4: Run the builder test — expect PASS**

- [ ] **Step 5: Wire the emit into the handler (read the file first)**

In `vibes.diy/api/svc/public/handle-whole-file-codegen.ts`, locate the `enqueue(evt: PromptAndBlockMsgs)` helper (~line 220), the `base()` helper and `liveSeq` counter used by `emitCodeLine`/`emitCodeEnd` (~line 266-299), and the `sessionDoc` in scope (it carries `sessionDoc.theme` from `buildWholeFileSessionDoc`). BEFORE the first block event is enqueued (i.e. before `block.begin`/`emitCodeBegin`), add — keeping the guard so a themeless session emits nothing:

```ts
if (sessionDoc.theme !== undefined && sessionDoc.theme.length > 0) {
  enqueue(
    buildSectionThemeEvent({
      theme: sessionDoc.theme,
      streamId: base().streamId,
      chatId: req.chatId,
      seq: liveSeq++,
      timestamp: base().timestamp,
    })
  );
}
```

Import `buildSectionThemeEvent` from `../intern/codegen-loop/section-theme-event.js`. If `base()`'s field names differ (e.g. it returns block-base fields), populate `streamId`/`timestamp` from the same source the other emitters use and `chatId` from `req.chatId`; the event must satisfy `PromptBase` (`streamId, chatId, seq, timestamp`).

- [ ] **Step 6: Add a guard test for the themeless case**

Add to `section-theme-event.test.ts` a documentation-style assertion that the builder is the only constructor of the event, plus confirm by reading that the `enqueue` call is guarded by `sessionDoc.theme !== undefined`. (The "emitted first / not-at-all when themeless" ordering is confirmed by the operator's browser pass and by reading; no handler-integration harness exists to assert ordering cheaply.)

- [ ] **Step 7: Run build + api tests, then commit**

```bash
git add vibes.diy/api/svc/intern/codegen-loop/section-theme-event.ts vibes.diy/api/svc/public/handle-whole-file-codegen.ts vibes.diy/api/tests/section-theme-event.test.ts
git commit -m "feat(whole-file): emit prompt.section-theme first when a pre-allocated theme is set"
```

---

### Task 3: Translate `prompt.section-theme` to a `setTheme` dispatch on the client

**Type:** implementation
**Depends-on:** 1

**Files:**
- Create: `vibes.diy/pkg/app/hooks/section-theme-actions.ts` (pure translation helper)
- Modify: `vibes.diy/pkg/app/hooks/useChatSession.ts` (intercept the new event in `attachSectionStream`'s block loop, ~lines 111-113)
- Test: `vibes.diy/tests/app/section-theme-actions.test.ts`

**Interfaces:**
- Consumes: `PromptSectionTheme` (Task 1); `getThemeBySlug(slug: string): VibesTheme | undefined` (from `@vibes.diy/prompts`)
- Produces: `sectionThemeActions(block: PromptSectionTheme): PromptAction[]` and `isSectionTheme(block: unknown): block is PromptSectionTheme`

**Parallelization rationale:** lives entirely in the client hook layer (`pkg/app/hooks`), disjoint from the server emit (Task 2) and the loop fixes (Tasks 4-6), so it runs in the same wave as them.

- [ ] **Step 1: Write the failing test**

```ts
// vibes.diy/tests/app/section-theme-actions.test.ts
import { describe, expect, it } from "vitest";
import { sectionThemeActions } from "../../pkg/app/hooks/section-theme-actions.js";

describe("sectionThemeActions", () => {
  const base = { type: "prompt.section-theme" as const, streamId: "s", chatId: "c", seq: 0, timestamp: new Date() };

  it("resolves a known slug to a setTheme action carrying the catalog theme", () => {
    const actions = sectionThemeActions({ ...base, theme: "aether" });
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("setTheme");
    expect((actions[0] as { theme: { slug: string } }).theme.slug).toBe("aether");
  });

  it("adds a setColorTheme action when colorTheme is present", () => {
    const actions = sectionThemeActions({ ...base, theme: "aether", colorTheme: "acid-pop" });
    expect(actions.map((a) => a.type)).toEqual(["setTheme", "setColorTheme"]);
  });

  it("returns no actions for an unknown slug", () => {
    expect(sectionThemeActions({ ...base, theme: "definitely-not-a-real-slug" })).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails** (module not found).

- [ ] **Step 3: Write the pure helper**

```ts
// vibes.diy/pkg/app/hooks/section-theme-actions.ts
import { getThemeBySlug } from "@vibes.diy/prompts";
import type { PromptSectionTheme } from "@vibes.diy/api/types/prompt";
import type { PromptAction } from "../routes/chat/prompt-state.js";

export function isSectionTheme(block: unknown): block is PromptSectionTheme {
  return typeof block === "object" && block !== null && (block as { type?: unknown }).type === "prompt.section-theme";
}

export function sectionThemeActions(block: PromptSectionTheme): PromptAction[] {
  const actions: PromptAction[] = [];
  const theme = getThemeBySlug(block.theme);
  if (theme !== undefined) actions.push({ type: "setTheme", theme });
  if (typeof block.colorTheme === "string" && block.colorTheme.length > 0) {
    actions.push({ type: "setColorTheme", colorTheme: block.colorTheme });
  }
  return actions;
}
```

If `PromptAction` is not exported from `prompt-state.ts`, export it there (it is the union the reducer consumes); if the api `PromptSectionTheme` type import path differs, match the path the client already uses for wire types.

- [ ] **Step 4: Run the helper test — expect PASS.**

- [ ] **Step 5: Intercept the event in `attachSectionStream`**

In `vibes.diy/pkg/app/hooks/useChatSession.ts`, import the helpers and change the block loop (currently lines 111-113) from:

```ts
for (const block of se.blocks) {
  dispatch(block);
}
```

to:

```ts
for (const block of se.blocks) {
  if (isSectionTheme(block)) {
    for (const action of sectionThemeActions(block)) dispatch(action);
    continue;
  }
  dispatch(block);
}
```

Add `import { isSectionTheme, sectionThemeActions } from "./section-theme-actions.js";`.

- [ ] **Step 6: Run build + app suite, then commit**

```bash
git add vibes.diy/pkg/app/hooks/section-theme-actions.ts vibes.diy/pkg/app/hooks/useChatSession.ts vibes.diy/tests/app/section-theme-actions.test.ts
git commit -m "feat(whole-file): hydrate promptState.theme live from prompt.section-theme"
```

---

### Task 4: Fix the `\uXXXX` unicode-escape crash in `extractJsonStringField`

**Type:** implementation
**Depends-on:** none

**Files:**
- Modify: `vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.ts` (the `extractJsonStringField` decoder, lines 104-125, esp. the `out += JSON.parse(...)` at line 117)
- Test: `vibes.diy/api/tests/whole-file-unescape.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `extractJsonStringField` decodes `\uXXXX` and standard escapes without throwing (behavior change only; signature unchanged)

This task and Tasks 5 and 6 all modify `whole-file-loop.ts`; they are chained via `Depends-on` so they never edit the same file in the same wave. Match each edit on the exact code shown so the three changes compose.

- [ ] **Step 1: Write the failing test**

```ts
// vibes.diy/api/tests/whole-file-unescape.test.ts
import { describe, expect, it } from "vitest";
import { extractJsonStringField } from "../svc/intern/codegen-loop/whole-file-loop.js";

describe("extractJsonStringField unicode handling", () => {
  it("decodes a \\uXXXX escape without throwing", () => {
    const raw = '{"contents":"A\\u0042C"}';
    expect(extractJsonStringField(raw, "contents")).toBe("ABC");
  });
  it("still decodes standard escapes", () => {
    const raw = '{"contents":"line1\\nline2\\t\\"q\\""}';
    expect(extractJsonStringField(raw, "contents")).toBe('line1\nline2\t"q"');
  });
});
```

If `extractJsonStringField` is not exported, export it (it is currently a module-local `function`).

- [ ] **Step 2: Run it and confirm it fails** — expect a thrown `Bad Unicode escape` (or assertion failure) on the first case.

- [ ] **Step 3: Replace the escape branch**

In `extractJsonStringField`, replace the backslash branch (lines ~112-119):

```ts
    if (ch === "\\") {
      const next = raw[i + 1];
      if (next === undefined) break;
      out += JSON.parse(`"\\${next}"`) as string;
      i += 1;
      continue;
    }
```

with an explicit decoder that consumes 4 hex digits for `\u`:

```ts
    if (ch === "\\") {
      const next = raw[i + 1];
      if (next === undefined) break;
      if (next === "u") {
        const hex = raw.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex) === false) break; // partial mid-stream escape — wait for more bytes
        out += String.fromCharCode(parseInt(hex, 16));
        i += 5;
        continue;
      }
      const simple: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", "\"": '"', "\\": "\\", "/": "/" };
      out += simple[next] ?? next;
      i += 1;
      continue;
    }
```

- [ ] **Step 4: Run the test — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.ts vibes.diy/api/tests/whole-file-unescape.test.ts
git commit -m "fix(whole-file): decode \\uXXXX escapes instead of crashing the stream"
```

---

### Task 5: Flush the trailing partial line at EOF in `makeLineEmitter`

**Type:** implementation
**Depends-on:** 4

**Files:**
- Modify: `vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.ts` (`makeLineEmitter`, lines 133-147, and its call sites where the stream completes, ~lines 207-214)
- Test: `vibes.diy/api/tests/whole-file-eof-flush.test.ts`

**Interfaces:**
- Consumes: `OnLine` (existing type in this file)
- Produces: `makeLineEmitter(onLine: OnLine)` returns an emitter with a `flush(rawPath: string, contents: string)` method that emits the final newline-less line

This task modifies `whole-file-loop.ts` — same file as Tasks 4 and 6; it is chained on Task 4 and Task 6 chains on it so the three never collide in one wave.

- [ ] **Step 1: Write the failing test**

```ts
// vibes.diy/api/tests/whole-file-eof-flush.test.ts
import { describe, expect, it } from "vitest";
import { makeLineEmitter } from "../svc/intern/codegen-loop/whole-file-loop.js";

describe("makeLineEmitter EOF flush", () => {
  it("emits the trailing line that has no terminating newline", () => {
    const lines: { lineNr: number; line: string }[] = [];
    const emit = makeLineEmitter((a) => lines.push({ lineNr: a.lineNr, line: a.line }));
    emit("App.jsx", "a\nb\nc"); // streams "a","b"; "c" has no newline yet
    expect(lines.map((l) => l.line)).toEqual(["a", "b"]);
    emit.flush("App.jsx", "a\nb\nc");
    expect(lines.map((l) => l.line)).toEqual(["a", "b", "c"]);
  });
});
```

If `makeLineEmitter` is module-local, export it.

- [ ] **Step 2: Run it and confirm it fails** (`emit.flush` is not a function / "c" never emitted).

- [ ] **Step 3: Make the emitter a callable with a `flush`**

Refactor `makeLineEmitter` so the returned value carries the per-file `emitted` counter and exposes `flush`:

```ts
function makeLineEmitter(onLine: OnLine) {
  const emitted: Record<string, number> = {};
  const pump = (rawPath: string, contents: string, includeLast: boolean) => {
    const filename = normalizeFilename(rawPath);
    const lang = langFor(filename);
    const slice = includeLast ? contents : (() => {
      const nl = contents.lastIndexOf("\n");
      return nl === -1 ? undefined : contents.slice(0, nl);
    })();
    if (slice === undefined) return;
    const lines = slice.split("\n");
    const already = emitted[filename] ?? 0;
    for (let nr = already; nr < lines.length; nr++) {
      onLine({ file: filename, lang, line: lines[nr], lineNr: nr });
    }
    emitted[filename] = lines.length;
  };
  const emit = (rawPath: string, contents: string) => pump(rawPath, contents, false);
  emit.flush = (rawPath: string, contents: string) => pump(rawPath, contents, true);
  return emit;
}
```

- [ ] **Step 4: Call `flush` after the tool stream finishes**

At the stream-completion site (~lines 207-214, after the streaming loop, for each file whose final contents are known), call `emitLines.flush(path, contents)` once so the trailing line is emitted. Keep the falsy-guard style already in the file (`if (emitLines === undefined) continue;`).

- [ ] **Step 5: Run the test + build — expect PASS.**

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.ts vibes.diy/api/tests/whole-file-eof-flush.test.ts
git commit -m "fix(whole-file): flush the trailing newline-less line at stream EOF"
```

---

### Task 6: Don't persist a verify-failing file in the `write_file` executor

**Type:** implementation
**Depends-on:** 5

**Files:**
- Modify: `vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.ts` (`write_file` `execute`, lines 155-165, plus the return that yields `files`, ~lines 229-233)
- Test: `vibes.diy/api/tests/whole-file-verify-before-return.test.ts`

**Interfaces:**
- Consumes: `verifyFiles(files, opts)` (existing in `verify.ts`)
- Produces: a verify-failing `write_file` call leaves the prior good contents intact and does not return the broken file as a committed output

This task modifies `whole-file-loop.ts` — chained on Task 5 so the three loop edits never share a wave.

- [ ] **Step 1: Write the failing test**

Drive the executor through the loop's public entry with a stubbed model that emits one bad file, OR — if the executor is reachable only inside the loop — extract the executor's commit decision into a small pure helper `commitWriteFile(files, filename, contents, verify): { ok: boolean; feedback: string }` that only mutates `files` when `verify.ok`, and test that:

```ts
// vibes.diy/api/tests/whole-file-verify-before-return.test.ts
import { describe, expect, it } from "vitest";
import { commitWriteFile } from "../svc/intern/codegen-loop/whole-file-loop.js";

describe("commitWriteFile", () => {
  it("does not retain contents when verify fails", () => {
    const files: Record<string, string> = {};
    const r = commitWriteFile(files, "App.jsx", "broken(", () => ({ ok: false, problems: ["unbalanced"] }));
    expect(r.ok).toBe(false);
    expect("App.jsx" in files).toBe(false);
  });
  it("retains contents when verify passes", () => {
    const files: Record<string, string> = {};
    const r = commitWriteFile(files, "App.jsx", "export default () => null", () => ({ ok: true, problems: [] }));
    expect(r.ok).toBe(true);
    expect(files["App.jsx"]).toContain("export default");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails** (no `commitWriteFile`).

- [ ] **Step 3: Extract and use `commitWriteFile`**

Add the helper and call it from the executor so the store happens only on success:

```ts
export function commitWriteFile(
  files: Record<string, string>,
  filename: string,
  contents: string,
  verify: (f: Record<string, string>) => { ok: boolean; problems: string[] }
): { ok: boolean; feedback: string } {
  const v = verify({ ...files, [filename]: contents });
  if (v.ok === false) return { ok: false, feedback: v.problems.join("\n") };
  files[filename] = contents;
  return { ok: true, feedback: "ok" };
}
```

In the `write_file` `execute`, replace the store-then-verify body (lines 160-164) with a call to `commitWriteFile(files, filename, contents, (f) => verifyFiles(f, { needsAccess: args.needsAccess }))`, returning its `{ ok, feedback }`. The final return that yields `files` (~lines 229-233) then never contains a verify-failing file.

- [ ] **Step 4: Run the test + build — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/intern/codegen-loop/whole-file-loop.ts vibes.diy/api/tests/whole-file-verify-before-return.test.ts
git commit -m "fix(whole-file): only commit a written file after verify passes"
```

---

### Task 7: Lock the first-creation-turn gating with a regression test

**Type:** implementation
**Depends-on:** none

**Files:**
- Test: `vibes.diy/api/tests/whole-file-gating.test.ts` (test-only — confirms Codex P1 is already resolved on this head)

**Interfaces:**
- Consumes: `isReqCreationPromptChatSection` (from `api/types/chat.ts`)
- Produces: a regression test asserting edit/application requests are not creation requests (so they cannot route to the whole-file loop)

**Parallelization rationale:** test-only and touches no source file shared with any other task — fully independent.

- [ ] **Step 1: Write the test**

```ts
// vibes.diy/api/tests/whole-file-gating.test.ts
import { describe, expect, it } from "vitest";
import { isReqCreationPromptChatSection } from "../types/chat.js";

// Codex P1 claimed whole-file routing matches edit turns too. On this head the
// route is gated by isReqCreationPromptChatSection(orig) AND an empty version
// timeline (prompt-chat-section.ts:2279-2283). This locks the first half: an
// application/edit request must never read as a creation request.
describe("whole-file gating", () => {
  it("treats an application/edit prompt-chat-section as NOT a creation request", () => {
    const editReq = {
      type: "vibes.diy.req-prompt-chat-section",
      mode: "runtime",
      auth: { type: "dapp", token: "t" },
      chatId: "c1",
      outerTid: "tid",
      prompt: { messages: [], model: "x" },
    };
    expect(isReqCreationPromptChatSection(editReq)).toBe(false);
  });
});
```

Adjust the `editReq` literal minimally so it validates as `reqPromptApplicationChatSection` (match the existing shape in `vibes.diy/api/tests/chat-types.test.ts`); the assertion (`=== false`) is the point.

- [ ] **Step 2: Run it — expect PASS** (confirming the gating already excludes edits). If it FAILS, the gating regressed: restrict the route in `prompt-chat-section.ts:2279` accordingly before proceeding.

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/tests/whole-file-gating.test.ts
git commit -m "test(whole-file): lock first-creation-turn routing (Codex P1 regression guard)"
```

---

### Task 8: Clear the real rules-bag remnants (useTypewriterReveal + PreviewApp)

**Type:** implementation
**Depends-on:** none

**Files:**
- Modify: `vibes.diy/pkg/app/hooks/useTypewriterReveal.ts` (falsy `if (!x)` at lines 29/64/71/79; `stepReveal` 4-positional-param signature at line 24 + its call site at line 74)
- Modify: `vibes.diy/pkg/app/components/ResultPreview/PreviewApp.tsx` (falsy `if (!cancelled)` at line 260)
- Test: `vibes.diy/tests/app/typewriter-reveal-step.test.ts` (characterize `stepReveal` so the signature refactor is behavior-preserving)

**Interfaces:**
- Consumes: nothing new
- Produces: `stepReveal(args: { state: RevealState; total: number; isStreaming: boolean; nowMs: number }): RevealState` (object-arg form)

**Parallelization rationale:** touches only `useTypewriterReveal.ts` and `PreviewApp.tsx`, neither shared with the Phase 0 client task (which touches `useChatSession.ts`) nor any server task — independent.

- [ ] **Step 1: Write a characterization test for `stepReveal` (object-arg form)**

```ts
// vibes.diy/tests/app/typewriter-reveal-step.test.ts
import { describe, expect, it } from "vitest";
import { stepReveal, type RevealState } from "../../pkg/app/hooks/useTypewriterReveal.js";

describe("stepReveal (object args)", () => {
  it("advances revealed count while streaming and caps at total", () => {
    const s0: RevealState = { revealed: 0, lastTickMs: 0 } as RevealState; // match the real RevealState shape
    const s1 = stepReveal({ state: s0, total: 10, isStreaming: true, nowMs: 1000 });
    expect(s1.revealed).toBeGreaterThanOrEqual(s0.revealed);
    expect(s1.revealed).toBeLessThanOrEqual(10);
  });
});
```

Read the real `RevealState` shape and the pacing math first, then make the assertions match current behavior exactly (this is a characterization test — it must encode what the function does today).

- [ ] **Step 2: Run it and confirm it fails** (current `stepReveal` takes positional args).

- [ ] **Step 3: Convert `stepReveal` to an object arg and fix the call site**

Change the signature at line 24 to `export function stepReveal({ state, total, isStreaming, nowMs }: { state: RevealState; total: number; isStreaming: boolean; nowMs: number }): RevealState` and update the body to use the destructured names. Update the call site at line 74 to `stepReveal({ state: s, total: totalRef.current, isStreaming: streamingRef.current, nowMs: now })`.

- [ ] **Step 4: Replace the falsy boolean checks with explicit comparisons**

In `useTypewriterReveal.ts`: `if (!isStreaming)` → `if (isStreaming === false)` (line 29); `if (!enabled)` → `if (enabled === false)` (line 64); `if (!mounted) return;` → `if (mounted === false) return;` (line 71); `if (!caughtUp || streamingRef.current)` → `if (caughtUp === false || streamingRef.current === true)` (line 79). In `PreviewApp.tsx`: `if (!cancelled) setColdOpenTokens(null);` → `if (cancelled === false) setColdOpenTokens(null);` (line 260).

- [ ] **Step 5: Run the characterization test + the existing `preview-cold-open.test.tsx` + build — expect PASS** (behavior preserved).

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/pkg/app/hooks/useTypewriterReveal.ts vibes.diy/pkg/app/components/ResultPreview/PreviewApp.tsx vibes.diy/tests/app/typewriter-reveal-step.test.ts
git commit -m "style(rules-bag): explicit boolean checks + object-arg stepReveal"
```

---

### Task 9: Full verification gate

**Type:** gate
**Depends-on:** 1, 2, 3, 4, 5, 6, 7, 8

**Files:**
- None (verification only)

Run and require green:
- `pnpm run build` (tsc) — the CI `compile_test` build.
- `cd vibes.diy/tests && pnpm test` — the app suite.
- The api test suite (the runner that executes `vibes.diy/api/tests/*.test.ts`).
- `pnpm run rules-bag:constructors` — must report `0 new violations`.

If a suite is flaky, rerun once (and in isolation) before treating it as a real failure, per `agents/flaky-tests.md`.

---

### Task 10: PR honesty pass, resolve stale threads, operator browser gate, exit draft

**Type:** manual
**Depends-on:** 9

This task is performed by the operator (it pushes, browser-tests the deployed preview, and posts to GitHub — outside a worktree).

- Push the integration result to the PR branch `experiment/codegen-magic-harness`; let CI deploy the preview.
- **Operator browser pass (verification of record)** on https://pr-2650-vibes-diy-v2.jchris.workers.dev: on a *fresh* generation confirm spec **A1** — the cold-open skeleton paints in the pre-allocated theme's colors, not neutral — and spec **A3** — no `sectionId` crash, reconnect converges, the generated app renders and functions. If A1 fails, the foundation is not delivered; stop and diagnose before exiting draft.
- Rewrite the PR description to match reality: themed cold open now delivered at stream start; three correctness bugs fixed; gating already first-creation-only (regression-tested); theme *variety* (visible structural/palette difference across gens) is NOT yet addressed — it is the deferred Phase 1/2 follow-up. Do not overclaim.
- Reply to the stale review threads with the evidence: `TextEncoder`→`sthis.txt.encode`, `OnLine`/`emitCodeLine/End` object args, `exception2Result`, `makeOpenRouterClient` returns `Result`, and the `MessageList` cast removal are already on this head; the `import React` default-import note is declined (matches the repo's 23-file convention). Codex P1 (gating) is already first-creation-only — see the Task 7 regression test; Codex P2s (verify-before-return, EOF flush) are fixed in Tasks 5-6.
- Once A1+A3 pass and CI is green, take the PR out of draft and label `ready-to-merge`.

---

## Out of scope (deferred follow-up — gated on this plan's operator browser pass)

- **Phase 1 variety isolation** (manual, on the deployed preview): log the selected slug server-side per gen, run 3-4 varied prompts, compare selected slug vs. rendered look, and diff the agentic system prompt against production to confirm `{{THEME_DESIGN}}` is present and populated — to determine whether the brutalist monoculture is caused by (a) slug selection, (b) the prompt not honoring the theme, or (c) the model ignoring theme structurally.
- **Phase 2 variety fix:** scoped only after Phase 1 names the cause and the variety acceptance bar is set. Its own spec → plan.

## Self-review

- **Spec coverage:** A1 (themed cold open) ← Tasks 1-3 + operator gate in Task 10; A3 (reliability no-regress) ← operator gate; A4 (correctness + gating) ← Tasks 4-7; A5 (CI/rules-bag/threads) ← Tasks 8-10; A6 (no overclaim) ← Task 10; A7 (flag-off identical) ← emit is whole-file-only (Task 2 guard) + production never calls the handler. A2 (variety) is explicitly deferred and labeled out of scope. Covered.
- **Placeholder scan:** every code step carries real code; the only "find the exact local names" notes are in Tasks 2/6 where the implementer must read the handler/executor — bounded and explicit, not a TODO.
- **Type consistency:** `PromptSectionTheme` shape, `buildSectionThemeEvent` args, `sectionThemeActions` return, and `setTheme`/`setColorTheme` action names are consistent across Tasks 1-3 and match the verified reducer (`prompt-state.ts`).
- **Markers:** every task carries `Type` + `Depends-on`; same-file edits (`whole-file-loop.ts`, Tasks 4-5-6) are chained; the verification-only task is `gate`; the push/browser/GitHub task is `manual`.
- **Acceptance:** waived, with the honest browser-pass reason recorded above.
