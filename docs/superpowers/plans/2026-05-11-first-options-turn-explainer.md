# First Options-Turn Explainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a one-line "These are optional. Pick one to suggest the next improvement, or type your own change." helper above the `▸ ` options on the **first** assistant message in a chat that has options. Helper appears once per chat (anchored to whichever message is positionally first with options), never again.

**Architecture:** Add an `isFirst?: boolean` prop to `OptionButtons` that renders the helper line as the first child of the existing `mt-3 flex flex-col gap-2` container when `isFirst && options.length > 0`. Plumb `isFirstWithOptions?: boolean` through `TopLevelMsg` to forward it as `isFirst`. In `MessageList`'s post-render epilogue (next to the existing "mark last TopLevelMsg interactive" pass), add a second pass that walks `messageElements` forward, peeks at each `TopLevelMsg`'s `lines` via `parseOptionLines`, and clones the first match with `isFirstWithOptions: true`.

**Tech Stack:** TypeScript, React, Tailwind CSS (existing `text-light-secondary` / `dark:text-dark-secondary` tokens for muted helper copy, `text-xs` for subordinate visual weight), Vitest + @testing-library/react for the new component test.

**Spec reference:** [docs/superpowers/specs/2026-05-11-first-options-turn-explainer-design.md](../specs/2026-05-11-first-options-turn-explainer-design.md)

**Branch:** `feat/chat-button-improvement-interview` (the same branch the auto-interview feature sits on — this builds on top).

**Working directory:** `/Users/marcusestes/Websites/vibes.diy-chat-button`

---

## File Structure

**Modify:**
- `vibes.diy/pkg/app/components/OptionButtons.tsx` — add `isFirst?: boolean` prop, render helper line conditionally.
- `vibes.diy/pkg/app/components/MessageList.tsx` — add `isFirstWithOptions?: boolean` prop on `TopLevelMsg`, forward to `OptionButtons` as `isFirst`, add the "first-with-options" scan pass in the rendering epilogue.

**Create:**
- `vibes.diy/tests/app/OptionButtons.test.tsx` — new component test file with two assertions (helper visible when `isFirst=true`, absent otherwise).

**Unchanged:**
- `vibes.diy/pkg/app/utils/option-lines.ts` and `vibes.diy/tests/app/option-lines.test.ts` — `parseOptionLines` already returns `{ prose, options }`. No change.

---

## Task 1: TDD-failing component test for `OptionButtons` helper

**Files:**
- Create: `vibes.diy/tests/app/OptionButtons.test.tsx`

This test asserts the helper line appears when `isFirst={true}` and is absent otherwise. It will fail until Task 2 lands.

- [ ] **Step 1: Create the new test file.**

```bash
touch /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/tests/app/OptionButtons.test.tsx
```

- [ ] **Step 2: Write the failing tests.**

Open the new file and write:

```tsx
import React from "react";
import { vi, describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { OptionButtons } from "~/vibes.diy/app/components/OptionButtons.js";

const SAMPLE_OPTIONS = ["Add a settings page", "Make the empty state friendlier", "I'm done for now"];
const HELPER_TEXT = "These are optional. Pick one to suggest the next improvement, or type your own change.";

describe("OptionButtons", () => {
  it("renders the explainer above the buttons when isFirst is true", () => {
    const onSelect = vi.fn();
    const { container } = render(<OptionButtons options={SAMPLE_OPTIONS} isFirst={true} onSelect={onSelect} />);
    expect(container.textContent).toContain(HELPER_TEXT);
  });

  it("omits the explainer when isFirst is false", () => {
    const onSelect = vi.fn();
    const { container } = render(<OptionButtons options={SAMPLE_OPTIONS} isFirst={false} onSelect={onSelect} />);
    expect(container.textContent).not.toContain(HELPER_TEXT);
  });

  it("omits the explainer when isFirst is omitted (default false)", () => {
    const onSelect = vi.fn();
    const { container } = render(<OptionButtons options={SAMPLE_OPTIONS} onSelect={onSelect} />);
    expect(container.textContent).not.toContain(HELPER_TEXT);
  });

  it("renders nothing when options is empty, even if isFirst is true", () => {
    const onSelect = vi.fn();
    const { container } = render(<OptionButtons options={[]} isFirst={true} onSelect={onSelect} />);
    // The component returns null when options is empty — the helper should not appear standalone.
    expect(container.textContent).not.toContain(HELPER_TEXT);
  });
});
```

- [ ] **Step 3: Run the tests to confirm Task 2's targets fail.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/tests && pnpm test OptionButtons -- --run 2>&1 | tail -30
```

Expected: the first test (`renders the explainer above the buttons when isFirst is true`) FAILS because the helper text is not yet present in the component output. The other three tests pass (helper is correctly absent in their cases — since the helper is never rendered yet, "absent" is trivially true).

If the failure message differs (e.g., a TypeScript error about an unknown `isFirst` prop), that's still acceptable — it means the test compiled and ran but the prop is unrecognized. Task 2 will add the prop and the helper logic together.

If the test errors during import or fails to start, investigate before proceeding — check that the `~/vibes.diy/app/components/OptionButtons.js` import path resolves the same way as in `QuickSuggestions.test.tsx`.

- [ ] **Step 4: Commit.**

```bash
git -C /Users/marcusestes/Websites/vibes.diy-chat-button add vibes.diy/tests/app/OptionButtons.test.tsx
git -C /Users/marcusestes/Websites/vibes.diy-chat-button commit -m "test(option-buttons): failing assertions for first-turn explainer"
```

---

## Task 2: Add `isFirst` prop + helper line to `OptionButtons`

**Files:**
- Modify: `vibes.diy/pkg/app/components/OptionButtons.tsx`

- [ ] **Step 1: Open the file.**

The current contents (already known good):

```tsx
import React from "react";

interface OptionButtonsProps {
  readonly options: readonly string[];
  /** Disabled buttons (older, non-most-recent messages) render as visual history. */
  readonly disabled?: boolean;
  readonly onSelect?: (option: string) => void;
}

/**
 * Stacked clickable answer options for a brainstorm question.
 *
 * Rendered inside an assistant message bubble below the prose. Disabled state
 * is used for non-most-recent messages — the buttons stay visually present
 * (history) but cannot be clicked.
 */
export function OptionButtons({ options, disabled, onSelect }: OptionButtonsProps) {
  if (options.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-2" data-message-role="brainstorm-options">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
          onClick={() => onSelect?.(option)}
          className={
            "w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors " +
            "border border-light-decorative-01 dark:border-dark-decorative-01 " +
            "bg-light-background-01 dark:bg-dark-background-01 " +
            "text-light-primary dark:text-dark-primary " +
            (disabled
              ? "cursor-default opacity-70"
              : "hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 cursor-pointer")
          }
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export default OptionButtons;
```

- [ ] **Step 2: Add the `isFirst` prop to the interface.**

Find:

```tsx
interface OptionButtonsProps {
  readonly options: readonly string[];
  /** Disabled buttons (older, non-most-recent messages) render as visual history. */
  readonly disabled?: boolean;
  readonly onSelect?: (option: string) => void;
}
```

Replace with:

```tsx
interface OptionButtonsProps {
  readonly options: readonly string[];
  /** Disabled buttons (older, non-most-recent messages) render as visual history. */
  readonly disabled?: boolean;
  /**
   * When true, render a one-line explainer above the buttons telling the user
   * the options are optional and they can type their own change instead. Set
   * only on the first assistant message in a chat that has options — the user
   * only needs to see the explainer once.
   */
  readonly isFirst?: boolean;
  readonly onSelect?: (option: string) => void;
}
```

- [ ] **Step 3: Destructure `isFirst` in the function signature and render the helper.**

Find:

```tsx
export function OptionButtons({ options, disabled, onSelect }: OptionButtonsProps) {
  if (options.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-2" data-message-role="brainstorm-options">
      {options.map((option) => (
```

Replace with:

```tsx
export function OptionButtons({ options, disabled, isFirst, onSelect }: OptionButtonsProps) {
  if (options.length === 0) return null;
  return (
    <div className="mt-3 flex flex-col gap-2" data-message-role="brainstorm-options">
      {isFirst && (
        <p className="text-xs text-light-secondary dark:text-dark-secondary" data-testid="option-buttons-explainer">
          These are optional. Pick one to suggest the next improvement, or type your own change.
        </p>
      )}
      {options.map((option) => (
```

Note: the `data-testid` attribute is added for any future component tests that need to query for the helper specifically; the Task 1 tests use `container.textContent` so they don't strictly require it, but it's cheap and consistent with the existing `data-message-role` attribute on the wrapper.

- [ ] **Step 4: Run the failing tests from Task 1.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/tests && pnpm test OptionButtons -- --run 2>&1 | tail -20
```

Expected: all four tests PASS.

- [ ] **Step 5: Build the frontend package to confirm no type drift.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/pkg && pnpm tsc --noEmit 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 6: Commit.**

```bash
git -C /Users/marcusestes/Websites/vibes.diy-chat-button add vibes.diy/pkg/app/components/OptionButtons.tsx
git -C /Users/marcusestes/Websites/vibes.diy-chat-button commit -m "feat(option-buttons): render first-turn explainer when isFirst is true"
```

---

## Task 3: Plumb `isFirstWithOptions` through `TopLevelMsg`

**Files:**
- Modify: `vibes.diy/pkg/app/components/MessageList.tsx`

This task adds the `isFirstWithOptions` prop on `TopLevelMsg` and forwards it to `OptionButtons` as `isFirst`. The orchestrator-side scan pass that actually SETS `isFirstWithOptions: true` on the right element comes in Task 4 — until Task 4 lands, every `TopLevelMsg` invocation in this file passes `isFirstWithOptions: false` (or omits it, defaulting to false), so the user-visible behavior doesn't change yet.

- [ ] **Step 1: Find the `TopLevelMsg` component definition.**

It sits at around line 129 of `vibes.diy/pkg/app/components/MessageList.tsx`. The current shape:

```tsx
function TopLevelMsg({
  lines,
  begin,
  isLast,
  onSelectOption,
}: {
  begin: ToplevelBeginMsg;
  lines: LineMsg[];
  isLast: boolean;
  onSelectOption?: (option: string) => void;
}) {
```

- [ ] **Step 2: Add the `isFirstWithOptions` prop to `TopLevelMsg`.**

Replace the signature with:

```tsx
function TopLevelMsg({
  lines,
  begin,
  isLast,
  isFirstWithOptions,
  onSelectOption,
}: {
  begin: ToplevelBeginMsg;
  lines: LineMsg[];
  isLast: boolean;
  /**
   * True only for the first assistant message in the chat whose options are
   * non-empty. Forwarded to OptionButtons to render a one-line explainer
   * above the buttons. Set by MessageList's post-render epilogue (see the
   * "first-with-options" scan pass near the bottom of this file).
   */
  isFirstWithOptions?: boolean;
  onSelectOption?: (option: string) => void;
}) {
```

- [ ] **Step 3: Forward `isFirstWithOptions` to `OptionButtons.isFirst` inside the JSX.**

Find:

```tsx
        <OptionButtons options={options} disabled={!isLast} onSelect={isLast ? onSelectOption : undefined} />
```

Replace with:

```tsx
        <OptionButtons
          options={options}
          disabled={!isLast}
          isFirst={isFirstWithOptions}
          onSelect={isLast ? onSelectOption : undefined}
        />
```

- [ ] **Step 4: Build to confirm the type changes compile.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/pkg && pnpm tsc --noEmit 2>&1 | tail -5
```

Expected: clean. All existing `<TopLevelMsg ... />` call sites still satisfy the type because the new prop is optional.

- [ ] **Step 5: Run the frontend test suite to confirm nothing regressed.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/tests && pnpm test -- --run 2>&1 | tail -10
```

Expected: pass. The new explainer doesn't appear yet because no call site sets `isFirstWithOptions: true` — that happens in Task 4. Existing tests are unaffected.

- [ ] **Step 6: Commit.**

```bash
git -C /Users/marcusestes/Websites/vibes.diy-chat-button add vibes.diy/pkg/app/components/MessageList.tsx
git -C /Users/marcusestes/Websites/vibes.diy-chat-button commit -m "feat(message-list): plumb isFirstWithOptions through TopLevelMsg"
```

---

## Task 4: Mark the first `TopLevelMsg` with options via post-render scan

**Files:**
- Modify: `vibes.diy/pkg/app/components/MessageList.tsx`

This task adds the second post-render scan pass that locates the first `TopLevelMsg` in `messageElements` whose `lines` contain options, and clones that element with `isFirstWithOptions: true`. The pattern mirrors the existing "mark last TopLevelMsg as interactive" pass (lines 682–695 in the file).

- [ ] **Step 1: Locate the existing post-render epilogue.**

Find the block (around lines 682–695):

```tsx
  // Mark the most recent TopLevelMsg as the active one — its option buttons
  // are clickable; older ones are visual history.
  if (!promptProcessing) {
    for (let i = messageElements.length - 1; i >= 0; i--) {
      const el = messageElements[i];
      if (React.isValidElement(el) && el.type === TopLevelMsg) {
        messageElements[i] = React.cloneElement(el as React.ReactElement<{ isLast: boolean; onSelectOption?: (o: string) => void }>, {
          isLast: true,
          onSelectOption,
        });
        break;
      }
    }
  }
```

This pass walks the array backwards and stops at the most recent `TopLevelMsg`. We add a second pass that walks forward and stops at the first `TopLevelMsg` whose `lines` contain options.

- [ ] **Step 2: Confirm `parseOptionLines` is already imported.**

Run:

```bash
grep -n "parseOptionLines" /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/pkg/app/components/MessageList.tsx
```

Expected output should include the existing import line (`import { parseOptionLines } from "../utils/option-lines.js";`) at the top of the file. If the import is missing for any reason, add it next to the existing utility imports.

- [ ] **Step 3: Add the second scan pass immediately after the existing one.**

Find the closing of the "mark most recent TopLevelMsg" block (the `  }` that closes the outer `if (!promptProcessing) {`):

```tsx
  // Mark the most recent TopLevelMsg as the active one — its option buttons
  // are clickable; older ones are visual history.
  if (!promptProcessing) {
    for (let i = messageElements.length - 1; i >= 0; i--) {
      const el = messageElements[i];
      if (React.isValidElement(el) && el.type === TopLevelMsg) {
        messageElements[i] = React.cloneElement(el as React.ReactElement<{ isLast: boolean; onSelectOption?: (o: string) => void }>, {
          isLast: true,
          onSelectOption,
        });
        break;
      }
    }
  }
```

Immediately after that closing brace, add:

```tsx
  // Mark the FIRST TopLevelMsg with options as the chat's introductory
  // interview turn — its OptionButtons render a one-line explainer above
  // the buttons telling the user the options are optional. Only the first
  // such message in chat order gets the helper; subsequent options-turns
  // omit it (the user only needs to learn the affordance once).
  for (let i = 0; i < messageElements.length; i++) {
    const el = messageElements[i];
    if (!React.isValidElement(el) || el.type !== TopLevelMsg) continue;
    const elProps = el.props as { lines: LineMsg[] };
    const fullText = elProps.lines.map((l) => l.line).join("\n");
    const { options } = parseOptionLines(fullText);
    if (options.length === 0) continue;
    messageElements[i] = React.cloneElement(
      el as React.ReactElement<{ isLast: boolean; isFirstWithOptions?: boolean; onSelectOption?: (o: string) => void }>,
      {
        isFirstWithOptions: true,
      }
    );
    break;
  }
```

Note the `el.props as { lines: LineMsg[] }` cast. The existing "isLast" pass casts to a different shape (`{ isLast: boolean; onSelectOption?: ... }`). Both casts narrow the unknown `el.props` to access specific fields — the same loose typing pattern the existing pass uses. The `LineMsg` type is already imported at the top of this file (search to confirm if it appears in the import block).

If `LineMsg` is not currently imported by name, find the existing import line for the call-ai-v2 message types and add `LineMsg` to the imported symbols. Quick check:

```bash
grep -n "LineMsg\|ToplevelBeginMsg" /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/pkg/app/components/MessageList.tsx | head -5
```

`LineMsg` should already appear because `TopLevelMsg` uses it in its props signature. If grep confirms its presence, no import change needed.

- [ ] **Step 4: Build to confirm the new pass types.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/pkg && pnpm tsc --noEmit 2>&1 | tail -5
```

Expected: clean. If TypeScript complains about `LineMsg` being undefined, add it to the relevant import line (Step 3 covered this; if it slipped through, add it now).

- [ ] **Step 5: Run the frontend test suite.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/tests && pnpm test -- --run 2>&1 | tail -10
```

Expected: pass. The `OptionButtons` component tests from Task 1+2 still pass (they cover the component in isolation). The `MessageList` integration tests in the suite (if any) should also pass — the new pass adds a prop that defaults to undefined elsewhere.

- [ ] **Step 6: Commit.**

```bash
git -C /Users/marcusestes/Websites/vibes.diy-chat-button add vibes.diy/pkg/app/components/MessageList.tsx
git -C /Users/marcusestes/Websites/vibes.diy-chat-button commit -m "feat(message-list): mark first TopLevelMsg with options for explainer"
```

---

## Task 5: Final repo check + push

**Files:** none (validation + push only).

- [ ] **Step 1: Run the full repo check.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button && pnpm check 2>&1 | tail -30
```

Expected outcomes per stage:
- `pnpm build` — green.
- `pnpm lint` — same pre-existing 1 error + 1 warning in `vibes.diy/base/hooks/img-gen/use-img-gen.ts` and `vibes.diy/vibe/runtime/firefly-database.ts`. Both untouched by this branch. NOT blockers.
- `pnpm test` — pass. One documented flaky test (see `agents/flaky-tests.md`); rerun once if it appears. There should be 4 new tests from Task 1 included in the count.

If a real failure surfaces (other than the documented pre-existing lint issues or the documented flake), investigate before continuing.

- [ ] **Step 2: Push the branch.**

```bash
git -C /Users/marcusestes/Websites/vibes.diy-chat-button push 2>&1 | tail -5
```

Fast-forward push to the existing PR #1642 branch. Triggers the preview workflow.

- [ ] **Step 3: Wait for the preview workflow.**

```bash
gh run list --branch feat/chat-button-improvement-interview --workflow "Deploy vibes.diy PR Preview" --limit 1
```

Take the run id and watch it to completion, or poll with `gh run view <id>`. Wait until status is `completed` and conclusion is `success`. If it fails, fetch failing logs with `gh run view <id> --log-failed | tail -100` and report.

- [ ] **Step 4: Manual smoke at the preview URL.**

Open `https://pr-1642-vibes-diy-v2.jchris.workers.dev/` in a fresh chat. Walk through:

1. Type an initial prompt like "todo list app" and click **Code**. After streaming, the assistant message should contain a trailing `▸ ` question with 2–4 options, plus **the new helper line** appearing immediately above the buttons: *"These are optional. Pick one to suggest the next improvement, or type your own change."*
2. Click an option that's not the escape hatch. The next assistant turn lands with edits + a fresh `▸ ` question. **The helper line should NOT appear above this second options block** — it only shows on the first.
3. Click `▸ I'm done for now`. The next assistant turn should be a one-line acknowledgment with no edits and no question.
4. Type a fresh prompt and click **Code**. Edits land + a new `▸ ` question appears. **The helper line should still NOT appear** — the loop has resumed, but it's not a "first time" anymore.
5. Reload the page. The chat history re-renders. **The helper line should reappear above the buttons of the very first options-turn** (now scrolled up in the chat history, with the buttons disabled as visual history). The most recent message's options remain interactive but without the helper.
6. Open a new chat (fresh slug). Type a prompt. **The helper line should appear again** above the new chat's first options-turn — the "first" anchor is per-chat, not global.

If any step misbehaves (helper appears on every turn, helper never appears, helper appears on the wrong message), the scan-pass logic in Task 4 needs investigation.

- [ ] **Step 5: No new commit needed unless tuning is required.**

```bash
git -C /Users/marcusestes/Websites/vibes.diy-chat-button status
```

Expected: clean working tree.

---

## Self-Review Notes

**Spec coverage:**
- §1 Copy → Task 2 Step 3 (exact string `"These are optional. Pick one to suggest the next improvement, or type your own change."` embedded in the component).
- §2 Detection — "first" message → Task 4 (forward scan pass over `messageElements`).
- §3 Plumbing → Task 3 (TopLevelMsg gains `isFirstWithOptions?`, forwards to OptionButtons as `isFirst`).
- §4 Rendering details → Task 2 Step 3 (helper as first child of the `mt-3 flex flex-col gap-2` container, `text-xs text-light-secondary dark:text-dark-secondary` styling).
- §5 Edge cases → exercised by Task 5 manual smoke (no options yet, mid-stream, recovery, reload, new chat). No automated test for recovery/reload because those require chat-route integration; the smoke checklist covers them.
- §6 Testing → Task 1 (four unit-level assertions on `OptionButtons` in a new dedicated test file).

**Open-question resolutions from the spec:**
- Test file placement → new dedicated `vibes.diy/tests/app/OptionButtons.test.tsx` (Task 1).
- Tailwind token names → `text-light-secondary dark:text-dark-secondary` confirmed via grep against the codebase (used in `ModelPicker.tsx:155`, `MyVibeCard.tsx:54`, `ChatInput.tsx:139`, etc.).

**Type consistency:**
- `OptionButtons.isFirst?: boolean` (Task 2) matches the `isFirst` prop passed in Task 3.
- `TopLevelMsg.isFirstWithOptions?: boolean` (Task 3) matches the `isFirstWithOptions` set via `cloneElement` in Task 4.
- The cast `el.props as { lines: LineMsg[] }` (Task 4) accesses the same `lines: LineMsg[]` field declared in `TopLevelMsg`'s props (Task 3 didn't change that field — it was always there).

**Placeholder scan:** No TBDs, no TODOs. Every step has either an explicit code edit, an explicit shell command, or an explicit verification.

**Architecture note:** The two scan passes (last-with-options, first-with-options) are independent — one walks backward, one walks forward. They could in principle be combined into a single pass that tracks both `lastTopLevelIdx` and `firstWithOptionsIdx`. I left them separate because:
1. The existing "last" pass is intentionally conditional on `!promptProcessing` (don't make the message interactive while it's still streaming); the new "first" pass should run unconditionally (the helper should appear as soon as the streamed message has its first option line). Combining them would force conditionals inside the loop.
2. Separate passes match the existing code style (small, focused, single-purpose blocks).
3. Both passes early-exit on first match, so the total cost is at most `O(messageElements.length)` even combined.
