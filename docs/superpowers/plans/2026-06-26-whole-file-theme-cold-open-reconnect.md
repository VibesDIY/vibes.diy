# Whole-file theme selection, themed cold open, reconnect convergence — Implementation Plan

> **For agentic workers:** Parallel execution: use `ultrapowers:ultrapowers` (this plan carries ultraplan markers). Sequential fallback: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the flag-gated whole-file codegen path pick a real theme, paint a themed skeleton at frame zero, and converge cleanly after a mid-generation reconnect.

**Architecture:** Three independent threads against the `USE_WHOLE_FILE_CODEGEN` path. (1) Server: run pre-allocation in the whole-file branch and thread the theme/skills/enriched-prompt into the agentic system prompt + persist the theme. (2) Client: a parametric `<ThemedSkeleton>` rendered in the preview during the existing "generating, nothing painted" window. (3) Server: re-emit the canonical `block.end` carrying `fsRef` after persist so the client's connection settles `reconnecting → live` and the iframe repoints for first paint.

**Tech Stack:** TypeScript, React, Cloudflare Workers (workerd), `@adviser/cement` (`Result`/`Option`), Vitest. Spec: `docs/superpowers/specs/2026-06-26-whole-file-theme-cold-open-reconnect-design.md`.

## Global Constraints

- **Workers-safe:** nothing under `vibes.diy/api/svc/` may import `esbuild` or node-only modules (the request path runs under workerd).
- **Additive + flag-gated:** the SEARCH/REPLACE (flag-off) path stays behaviorally identical; every change is scoped to the whole-file path or gated on the whole-file flow.
- **rules-bag conventions:** ≤3-param functions take a typed object; `exception2Result` over try/catch; `sthis.txt.encode` over `new TextEncoder`; explicit comparisons (`x === undefined`) over `if (!x)`; constructor factories return `Result`. Run `pnpm run rules-bag:constructors` and it must pass.
- **Never** manually edit version numbers in any `package.json`.
- **Test runner:** `corepack pnpm@10.34.4 exec vitest run <path>` for a single file; `pnpm run lint` and `pnpm run format:check` for lint/format.

---

### Task 1: Run pre-allocation and thread the theme on the whole-file path

**Type:** implementation
**Depends-on:** none

**Files:**
- Create: `vibes.diy/api/svc/intern/codegen-loop/whole-file-session-doc.ts`
- Create: `vibes.diy/api/svc/intern/codegen-loop/whole-file-session-doc.test.ts`
- Modify: `vibes.diy/api/svc/public/prompt-chat-section.ts` (whole-file dispatch branch, currently passing `sessionDoc: { userPrompt }` ~line 2308)

**Interfaces:**
- Consumes: `preAllocate(vctx, { prompt }): Promise<Result<PreAllocateResult>>` (existing, `vibes.diy/api/svc/intern/pre-allocate.ts:45`), where `PreAllocateResult = { skills: string[]; pairs: { title: string; slug: string }[]; theme: string; enrichedPrompt?: string }`.
- Produces: `buildWholeFileSessionDoc(userPrompt: string, pre?: PreAllocateResult): WholeFileCodegenSessionDoc` — maps a pre-allocation result into the handler's `sessionDoc` (theme slug, skills, title, enrichedPrompt). Returns `{ userPrompt }` unchanged when `pre` is undefined (pre-alloc failure fallback).

**Parallelization rationale:** extracting the pure `buildWholeFileSessionDoc` mapper isolates the theme-threading logic from the large `prompt-chat-section.ts` orchestrator, so it is unit-testable on its own and does not share a file with Task 2/Task 4 — a move a good engineer makes regardless of parallelism (the orchestrator is already oversized and untestable in isolation).

- [ ] **Step 1: Write the failing test for the mapper**

```ts
// vibes.diy/api/svc/intern/codegen-loop/whole-file-session-doc.test.ts
import { describe, expect, it } from "vitest";
import { buildWholeFileSessionDoc } from "./whole-file-session-doc.js";

describe("buildWholeFileSessionDoc", () => {
  it("threads theme/skills/title/enrichedPrompt from pre-allocation", () => {
    const doc = buildWholeFileSessionDoc("a todo app", {
      skills: ["fireproof"],
      pairs: [{ title: "Tasks", slug: "tasks" }],
      theme: "aether",
      enrichedPrompt: "a polished todo app",
    });
    expect(doc).toEqual({
      userPrompt: "a todo app",
      theme: "aether",
      skills: ["fireproof"],
      title: "Tasks",
      enrichedPrompt: "a polished todo app",
    });
  });

  it("falls back to userPrompt-only when pre-allocation is absent", () => {
    expect(buildWholeFileSessionDoc("a todo app", undefined)).toEqual({ userPrompt: "a todo app" });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `corepack pnpm@10.34.4 exec vitest run vibes.diy/api/svc/intern/codegen-loop/whole-file-session-doc.test.ts`
Expected: FAIL — cannot find module `./whole-file-session-doc.js`.

- [ ] **Step 3: Implement the mapper**

```ts
// vibes.diy/api/svc/intern/codegen-loop/whole-file-session-doc.ts
import type { PreAllocateResult } from "../pre-allocate.js";
import type { WholeFileCodegenSessionDoc } from "../../public/handle-whole-file-codegen.js";

/**
 * Map a pre-allocation result into the whole-file handler's sessionDoc so the
 * agentic system prompt's {{THEME_DESIGN}} / skills / enriched-prompt slots are
 * filled. With no pre-allocation (its LLM call failed), return userPrompt only
 * — generation proceeds on the default theme rather than blocking.
 */
export function buildWholeFileSessionDoc(userPrompt: string, pre?: PreAllocateResult): WholeFileCodegenSessionDoc {
  if (pre === undefined) return { userPrompt };
  return {
    userPrompt,
    theme: pre.theme,
    skills: pre.skills,
    title: pre.pairs[0]?.title,
    enrichedPrompt: pre.enrichedPrompt,
  };
}
```

If `PreAllocateResult` is not exported from `pre-allocate.ts`, add `export` to its declaration in that file (interface only; no behavior change).

- [ ] **Step 4: Run the test to confirm it passes**

Run: `corepack pnpm@10.34.4 exec vitest run vibes.diy/api/svc/intern/codegen-loop/whole-file-session-doc.test.ts`
Expected: PASS (2 passing).

- [ ] **Step 5: Wire it into the whole-file dispatch branch**

In `vibes.diy/api/svc/public/prompt-chat-section.ts`, in the whole-file branch that currently builds `sessionDoc: { userPrompt }` (search for `handleWholeFileCodegenRequest` and the `sessionDoc: { userPrompt }` literal, ~line 2308), run pre-allocation first and use the mapper. Mirror the existing pre-alloc call at `prompt-chat-section.ts:2095`:

```ts
// before constructing the whole-file deps:
const rPre = await preAllocate(vctx, { prompt: userPrompt });
const pre = rPre.isOk() ? rPre.Ok() : undefined;
if (rPre.isErr()) vctx.logger.Warn().Err(rPre).Msg("whole-file pre-alloc failed; generating without a theme");
// ...
sessionDoc: buildWholeFileSessionDoc(userPrompt, pre),
```

Persist the chosen theme the same way the production creation path does (so reload/palette/cold-open all see it): pass `pre?.theme` / `pre?.skills` / `pre?.enrichedPrompt` into the same persistence the SEARCH/REPLACE creation path uses via its `activeSettingsOverride` (`prompt-chat-section.ts:2098-2103`). Import `buildWholeFileSessionDoc` and `preAllocate` at the top of the file.

- [ ] **Step 6: Verify the threaded theme reaches the agentic prompt**

Add to `vibes.diy/api/svc/intern/codegen-loop/handle-whole-file-codegen.test.ts` a case asserting `makeBaseSystemPrompt` receives the theme when sessionDoc carries it (the handler already spreads `sessionDoc` into `makeBaseSystemPrompt(frontierModel, { ...sessionDoc, variant: "agentic-whole-file" })`):

```ts
it("forwards the pre-allocated theme into the agentic system prompt", async () => {
  const seen: Array<{ variant?: string; theme?: unknown }> = [];
  const makeBaseSystemPrompt = async (_model: string, doc: { variant: string; theme?: unknown }) => {
    seen.push({ variant: doc.variant, theme: doc.theme });
    return { systemPrompt: "sp" };
  };
  await handleWholeFileCodegenRequest(makeDeps({ sessionDoc: { userPrompt: "x", theme: "aether" }, makeBaseSystemPrompt }));
  expect(seen[0]).toEqual({ variant: "agentic-whole-file", theme: "aether" });
});
```

Use the test file's existing `makeDeps` fake-builder (or extend it to accept `sessionDoc` / `makeBaseSystemPrompt` overrides).

- [ ] **Step 7: Run the handler suite + format/lint/rules-bag**

Run: `corepack pnpm@10.34.4 exec vitest run vibes.diy/api/svc/intern/codegen-loop/handle-whole-file-codegen.test.ts`
Expected: PASS.
Run: `pnpm run format:check && pnpm run rules-bag:constructors`
Expected: both pass.

- [ ] **Step 8: Commit**

```bash
git add vibes.diy/api/svc/intern/codegen-loop/whole-file-session-doc.ts vibes.diy/api/svc/intern/codegen-loop/whole-file-session-doc.test.ts vibes.diy/api/svc/public/prompt-chat-section.ts vibes.diy/api/svc/intern/codegen-loop/handle-whole-file-codegen.test.ts vibes.diy/api/svc/intern/pre-allocate.ts
git commit -m "feat(whole-file-codegen): run pre-allocation + thread theme into the agentic prompt"
```

---

### Task 2: ThemedSkeleton component

**Type:** implementation
**Depends-on:** none

**Files:**
- Create: `vibes.diy/pkg/app/components/ResultPreview/ThemedSkeleton.tsx`
- Test: `vibes.diy/tests/app/themed-skeleton.test.tsx`

**Interfaces:**
- Produces: `ThemedSkeleton(props: { colorTheme: ColorThemeTokens | null }): JSX.Element` — a parametric app-shell placeholder (header, two card placeholders, a button) styled from theme tokens via CSS custom properties; falls back to neutral tokens when `colorTheme` is null.
- Consumes: the colorset token shape already carried in `promptState.colorTheme` (canonical `background`/`surface`/`primary`/`accent`/`text-primary`/`border` + structural `font-family`/`radius`). Use the existing colorset type exported alongside `prompt-state.ts` / the themes bundle; if no shared type exists, declare a local `ColorThemeTokens` with those optional string fields.

**Parallelization rationale:** a new standalone file with a pure props contract; it shares no file with any other task and builds against the existing `colorTheme` token shape, so it is the canonical contract-first leaf the wire-up (Task 3) consumes.

- [ ] **Step 1: Write the failing render test**

```tsx
// vibes.diy/tests/app/themed-skeleton.test.tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemedSkeleton } from "../../pkg/app/components/ResultPreview/ThemedSkeleton.js";

describe("ThemedSkeleton", () => {
  it("applies theme tokens as CSS variables on the root", () => {
    const { container } = render(
      <ThemedSkeleton colorTheme={{ background: "#101014", accent: "#cfa562", "text-primary": "#fafafa" }} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--skeleton-bg")).toBe("#101014");
    expect(root.style.getPropertyValue("--skeleton-accent")).toBe("#cfa562");
  });

  it("renders an app-shell placeholder (header + cards + button) with a neutral fallback", () => {
    const { getByTestId } = render(<ThemedSkeleton colorTheme={null} />);
    expect(getByTestId("themed-skeleton-header")).toBeTruthy();
    expect(getByTestId("themed-skeleton-card-0")).toBeTruthy();
    expect(getByTestId("themed-skeleton-card-1")).toBeTruthy();
    expect(getByTestId("themed-skeleton-cta")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `corepack pnpm@10.34.4 exec vitest run vibes.diy/tests/app/themed-skeleton.test.tsx`
Expected: FAIL — cannot find module `ThemedSkeleton.js`.

- [ ] **Step 3: Implement the component**

```tsx
// vibes.diy/pkg/app/components/ResultPreview/ThemedSkeleton.tsx
import React from "react";

export interface ColorThemeTokens {
  background?: string;
  surface?: string;
  primary?: string;
  accent?: string;
  "text-primary"?: string;
  border?: string;
  "font-family"?: string;
  radius?: string;
}

const NEUTRAL: Required<Pick<ColorThemeTokens, "background" | "surface" | "accent" | "text-primary" | "border" | "radius">> = {
  background: "#0d0d10",
  surface: "#17171c",
  accent: "#6b7280",
  "text-primary": "#e5e7eb",
  border: "rgba(255,255,255,0.10)",
  radius: "0.5rem",
};

/**
 * Parametric themed cold-open placeholder: an app shell (header, two cards, a
 * CTA) painted from the pre-allocated theme tokens before any app code exists.
 * Scales across all themes with no per-theme work; replaced by the real app
 * iframe on first paint. Static (no motion) by scope.
 */
export function ThemedSkeleton({ colorTheme }: { colorTheme: ColorThemeTokens | null }): JSX.Element {
  const t = colorTheme ?? {};
  const vars = {
    "--skeleton-bg": t.background ?? NEUTRAL.background,
    "--skeleton-surface": t.surface ?? NEUTRAL.surface,
    "--skeleton-accent": t.accent ?? t.primary ?? NEUTRAL.accent,
    "--skeleton-text": t["text-primary"] ?? NEUTRAL["text-primary"],
    "--skeleton-border": t.border ?? NEUTRAL.border,
    "--skeleton-radius": t.radius ?? NEUTRAL.radius,
    "--skeleton-font": t["font-family"] ?? "system-ui, sans-serif",
  } as React.CSSProperties;
  return (
    <div
      data-testid="themed-skeleton"
      aria-hidden="true"
      style={{
        ...vars,
        position: "absolute",
        inset: 0,
        background: "var(--skeleton-bg)",
        color: "var(--skeleton-text)",
        fontFamily: "var(--skeleton-font)",
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <div
        data-testid="themed-skeleton-header"
        style={{ height: 44, borderRadius: "var(--skeleton-radius)", background: "var(--skeleton-accent)", opacity: 0.85 }}
      />
      <div style={{ display: "flex", gap: "1rem" }}>
        {[0, 1].map((i) => (
          <div
            key={i}
            data-testid={`themed-skeleton-card-${i}`}
            style={{
              flex: 1,
              height: 140,
              borderRadius: "var(--skeleton-radius)",
              background: "var(--skeleton-surface)",
              border: "1px solid var(--skeleton-border)",
            }}
          />
        ))}
      </div>
      <div
        data-testid="themed-skeleton-cta"
        style={{ height: 40, width: 160, borderRadius: "var(--skeleton-radius)", background: "var(--skeleton-accent)" }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `corepack pnpm@10.34.4 exec vitest run vibes.diy/tests/app/themed-skeleton.test.tsx`
Expected: PASS (2 passing).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/components/ResultPreview/ThemedSkeleton.tsx vibes.diy/tests/app/themed-skeleton.test.tsx
git commit -m "feat(preview): parametric ThemedSkeleton cold-open placeholder"
```

---

### Task 3: Render the themed skeleton during the cold-open window

**Type:** implementation
**Depends-on:** 2

**Files:**
- Modify: `vibes.diy/pkg/app/components/ResultPreview/PreviewApp.tsx` (the `showBlur` cold-open window, ~line 197)

**Interfaces:**
- Consumes: `ThemedSkeleton({ colorTheme })` (from Task 2); `promptState.running`, `promptState.colorTheme`, and the existing `pinnedFsId` / `firstStreamDone` locals already computed in `PreviewApp.tsx:197`.

- [ ] **Step 1: Write the failing test**

```tsx
// vibes.diy/tests/app/preview-cold-open.test.tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PreviewApp } from "../../pkg/app/components/ResultPreview/PreviewApp.js";

// Use the file's existing test harness/mocks for promptState if present; otherwise
// render PreviewApp with a promptState stub. Match the prop/context shape the
// component already consumes.
describe("PreviewApp cold open", () => {
  it("shows the themed skeleton while generating with nothing painted yet", () => {
    const { queryByTestId } = renderPreviewApp({ running: true, pinnedFsId: undefined, firstStreamDone: false, colorTheme: { accent: "#cfa562" } });
    expect(queryByTestId("themed-skeleton")).toBeTruthy();
  });

  it("hides the themed skeleton once the app has painted", () => {
    const { queryByTestId } = renderPreviewApp({ running: false, pinnedFsId: "fs-123", firstStreamDone: true, colorTheme: { accent: "#cfa562" } });
    expect(queryByTestId("themed-skeleton")).toBeNull();
  });
});
```

Define `renderPreviewApp(...)` using the harness already used by neighboring `vibes.diy/tests/app/` preview tests (reuse their promptState mock/provider). If none exists, build a minimal one in this file that supplies the promptState fields PreviewApp reads.

- [ ] **Step 2: Run it to confirm it fails**

Run: `corepack pnpm@10.34.4 exec vitest run vibes.diy/tests/app/preview-cold-open.test.tsx`
Expected: FAIL — skeleton not rendered.

- [ ] **Step 3: Render the skeleton in the cold-open window**

In `PreviewApp.tsx`, reuse the existing `showBlur` condition (`promptState.running && pinnedFsId === undefined && !firstStreamDone`, ~line 197) as the cold-open gate, and render the skeleton inside the preview container, beneath the (still-empty) iframe:

```tsx
import { ThemedSkeleton } from "./ThemedSkeleton.js";
// ...
const showColdOpen = promptState.running && pinnedFsId === undefined && !firstStreamDone;
// ...in the returned JSX, inside the preview container:
{showColdOpen ? <ThemedSkeleton colorTheme={promptState.colorTheme ?? null} /> : null}
```

Place it so it overlays the preview area (the container is positioned; `ThemedSkeleton` is `position:absolute; inset:0`). Do not alter the iframe mount/hot-swap logic.

- [ ] **Step 4: Run the test to confirm it passes**

Run: `corepack pnpm@10.34.4 exec vitest run vibes.diy/tests/app/preview-cold-open.test.tsx`
Expected: PASS (2 passing).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/components/ResultPreview/PreviewApp.tsx vibes.diy/tests/app/preview-cold-open.test.tsx
git commit -m "feat(preview): paint ThemedSkeleton during the cold-open window"
```

---

### Task 4: Re-emit the canonical block.end with fsRef (reconnect convergence)

**Type:** implementation
**Depends-on:** none

**Files:**
- Modify: `vibes.diy/api/svc/public/handle-whole-file-codegen.ts` (after the `handlePromptContext` persist, ~lines 419-428)
- Test: `vibes.diy/api/svc/intern/codegen-loop/handle-whole-file-codegen.test.ts`
- Test: `vibes.diy/tests/app/message-list-reconnect-converge.test.tsx`

**Interfaces:**
- Consumes: `handlePromptContext(...) → Result<{ blockSeq: number; fsRef: Option<FileSystemRef> }>` (existing handler dep); `appendBlockEvent({ promptId, blockSeq, evt, emitMode: "emit-only" })` (existing handler dep); `Option.toValue()` from `@adviser/cement`; the reducer's `isBlockEnd` settle gate (`vibes.diy/pkg/app/routes/chat/prompt-state.ts:330-338`, settles `connection: "live"` when `!!block.fsRef` and `block.streamId === inFlightStreamId`).

- [ ] **Step 1: Write the failing handler test**

```ts
// in handle-whole-file-codegen.test.ts
it("re-emits a canonical block.end carrying fsRef after persist", async () => {
  const emitted: Array<{ type: string; fsRef?: unknown }> = [];
  const appendBlockEvent = async ({ evt }: { evt: { type: string; fsRef?: unknown } }) => {
    emitted.push({ type: evt.type, fsRef: evt.fsRef });
    return Result.Ok(undefined);
  };
  const handlePromptContext = async () =>
    Result.Ok({ blockSeq: 7, fsRef: Option.Some({ fsId: "fs-9", appSlug: "a", ownerHandle: "o", mode: "create" }) });
  await handleWholeFileCodegenRequest(makeDeps({ appendBlockEvent, handlePromptContext }));
  const ends = emitted.filter((e) => e.type === "block.end");
  expect(ends.some((e) => (e.fsRef as { fsId?: string } | undefined)?.fsId === "fs-9")).toBe(true);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `corepack pnpm@10.34.4 exec vitest run vibes.diy/api/svc/intern/codegen-loop/handle-whole-file-codegen.test.ts -t "fsRef after persist"`
Expected: FAIL — no `block.end` carries `fsRef`.

- [ ] **Step 3: Implement the post-persist re-emit**

In `handle-whole-file-codegen.ts`, after the persist + error check (`if (rPersist.isErr()) return Result.Err(rPersist);`, ~line 426) and before `return Result.Ok(...)`, add (mirrors `prompt-chat-section.ts:1389`):

```ts
  // Convergence anchor: re-emit the canonical block.end carrying fsRef so a
  // client that flipped to "reconnecting" mid-generation settles back to "live"
  // (prompt-state.ts isBlockEnd gate is `!!block.fsRef`) and PreviewApp repoints
  // the iframe for first paint (PreviewApp.tsx isBlockEnd && msg.fsRef). The
  // pre-persist block.end above stays as the live card-finalize signal.
  const fsRefVal = rPersist.Ok().fsRef.toValue();
  if (fsRefVal !== undefined) {
    const wireSeq = blockSeq++;
    const rEnd = await appendBlockEvent({
      promptId,
      blockSeq: wireSeq,
      evt: { ...blockEnd, fsRef: fsRefVal, seq: liveSeq++, timestamp: new Date() },
      emitMode: "emit-only",
    });
    if (rEnd.isErr()) return Result.Err(rEnd);
  }

  return Result.Ok(rPersist.Ok().blockSeq);
```

- [ ] **Step 4: Run the handler test to confirm it passes**

Run: `corepack pnpm@10.34.4 exec vitest run vibes.diy/api/svc/intern/codegen-loop/handle-whole-file-codegen.test.ts`
Expected: PASS (whole file green, including existing strict-ordering tests).

- [ ] **Step 5: Write the reducer convergence regression test**

```tsx
// vibes.diy/tests/app/message-list-reconnect-converge.test.tsx
import { describe, expect, it } from "vitest";
import { promptReducer, initialPromptState } from "../../pkg/app/routes/chat/prompt-state.js";

describe("reconnect convergence", () => {
  it("settles connection live on a block.end carrying fsRef for the in-flight stream", () => {
    let s = { ...initialPromptState, inFlightStreamId: "p1", connection: "reconnecting" as const, running: true,
      blocks: [{ msgs: [] }], current: { msgs: [] } };
    s = promptReducer(s, {
      type: "block.end", streamId: "p1", blockId: "b1", seq: 1, timestamp: new Date(),
      fsRef: { fsId: "fs-9", appSlug: "a", ownerHandle: "o", mode: "create" },
    } as never);
    expect(s.connection).toBe("live");
    expect(s.inFlightStreamId).toBeUndefined();
  });

  it("does NOT settle on a block.end lacking fsRef", () => {
    let s = { ...initialPromptState, inFlightStreamId: "p1", connection: "reconnecting" as const, running: true,
      blocks: [{ msgs: [] }], current: { msgs: [] } };
    s = promptReducer(s, { type: "block.end", streamId: "p1", blockId: "b1", seq: 1, timestamp: new Date() } as never);
    expect(s.connection).toBe("reconnecting");
  });
});
```

Use the real exported reducer + dispatch shape from `prompt-state.ts` (match the actual export names — `promptReducer`/`initialPromptState` are placeholders; substitute the real ones the file exports). The first case must pass already (the settle logic exists); it is a regression guard proving Task 4's re-emit converges the client.

- [ ] **Step 6: Run the reducer test**

Run: `corepack pnpm@10.34.4 exec vitest run vibes.diy/tests/app/message-list-reconnect-converge.test.tsx`
Expected: PASS (2 passing).

- [ ] **Step 7: Format/lint/rules-bag, then commit**

Run: `pnpm run format:check && pnpm run rules-bag:constructors`
Expected: both pass.

```bash
git add vibes.diy/api/svc/public/handle-whole-file-codegen.ts vibes.diy/api/svc/intern/codegen-loop/handle-whole-file-codegen.test.ts vibes.diy/tests/app/message-list-reconnect-converge.test.tsx
git commit -m "fix(whole-file-codegen): re-emit canonical block.end with fsRef for reconnect convergence"
```

---

### Task 5: Full verification gate

**Type:** gate
**Depends-on:** 1, 3, 4

**Files:**
- (none — verification only)

- [ ] Run the affected suites + lint + format + rules-bag:

```bash
corepack pnpm@10.34.4 exec vitest run vibes.diy/api/svc/intern/codegen-loop vibes.diy/tests/app
pnpm run lint
pnpm run format:check
pnpm run rules-bag:constructors
```

Expected: all green. (Flaky-test policy: rerun a single failing file in isolation before treating a `pnpm check` failure as real — see `agents/flaky-tests.md`.)

---

### Task 6: Browser validation on the preview

**Type:** manual
**Depends-on:** 5

**Files:**
- (none — on-preview verification by the operator)

- [ ] On the PR preview (`USE_WHOLE_FILE_CODEGEN=true`, label `preview:whole-file-codegen`), confirm: (a) several different prompts produce **visibly different themes** (not all brutalist); (b) the **themed skeleton paints within ~1-2s** of submit and is never a blank grid; (c) the real app swaps in cleanly on completion; (d) a **mid-generation reload/transport drop converges** with no frozen "Reconnecting…" and no `sectionId` console error. This is the load-bearing verification (this class of streaming/reconnect bug is invisible to unit tests).

---

**Acceptance:** waived — the load-bearing verification for all three threads is the on-preview browser pass (Task 6): theme variety, sub-2s themed cold open, and mid-generation reconnect convergence are runtime/streaming behaviors that unit tests demonstrably miss (this entire investigation found the wedge and the defaulting only in-browser). Each task still ships TDD unit tests as its guardrail, and Task 5 gates the suite; the operator runs Task 6 in-browser after the merge gate.

## Self-review

- **Spec coverage:** Thread 1 → Task 1; Thread 2 → Tasks 2+3; Thread 3 → Task 4; testing → per-task tests + Task 5 gate + Task 6 browser. All spec sections covered.
- **Placeholders:** test code and implementation shown for every code step; two clearly-flagged "substitute the real export name" notes (reducer export in Task 4 Step 5; promptState harness in Task 3 Step 1) where the exact local symbol must be read from the file at implementation time — not vague TODOs but explicit pointers.
- **Type consistency:** `buildWholeFileSessionDoc`, `ThemedSkeleton`/`ColorThemeTokens`, and the `Option.toValue()` / `fsRef` shapes match across producing/consuming tasks.
- **Markers:** every implementation task carries `Type`/`Depends-on`; gate and manual tasks marked. Wave 1 = Tasks 1, 2, 4 (disjoint files: `prompt-chat-section.ts` + new mapper / new `ThemedSkeleton.tsx` / `handle-whole-file-codegen.ts` + reducer test) → width 3; wave 2 = Task 3 (depends-on 2).
- **Acceptance:** waived with a surfaced reason (browser pass is load-bearing).
