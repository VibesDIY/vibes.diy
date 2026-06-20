# Chip Multi-Fire Guard + Chat-Input Render Perf Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop suggestion chips (and the text input) from firing duplicate turns during the click→first-block window, and stop the chat textarea from lagging while a turn streams.

**Architecture:** A single guarded `submitPrompt(text)` entry point in the chat route backed by a `submitting` flag closes the duplicate-send race for *every* caller. `OptionButtons` gains local `selected` state for instant per-message disable + a pressed indicator. Passing `promptProcessing={submitting || running}` to `ChatInput` gives the send button instant feedback too. Separately, the streaming-driven "working" status is split out of `ChatInput` so per-block re-renders stop hitting the textarea, and `autoResize` skips redundant reflows.

**Tech Stack:** React 18, TypeScript, Vitest (browser mode via Playwright/Chromium), @testing-library/react. Tests live in `vibes.diy/tests/app/`, run with `cd vibes.diy/tests/app && pnpm test`.

**Design refinement vs spec:** The spec described threading an `optionsBusy` prop through `ChatInterface`→`MessageList`→`OptionButtons`. During `running`, `MessageList` already disables the last message's chips (it switches that message to `streaming: true`, so `OptionButtons` renders `disabled`). The only uncovered window is click→first-block, which `OptionButtons` local `selected` state closes synchronously on the click itself — and that local state is required anyway for the "which chip was pressed" indicator. So we keep the fix local + add the route guard (the real correctness boundary) and skip the prop-threading. All spec goals are still met.

---

## File Structure

- **Create:** `vibes.diy/pkg/app/utils/submit-guard.ts` — pure `shouldAcceptPrompt(...)` decision helper (testable without rendering the route).
- **Create:** `vibes.diy/tests/app/submit-guard.test.ts` — tests for the helper.
- **Modify:** `vibes.diy/pkg/app/components/OptionButtons.tsx` — local `selected` state: instant disable-all + pressed/spinner on the clicked chip.
- **Modify:** `vibes.diy/tests/app/OptionButtons.test.tsx` — add click-feedback tests.
- **Modify:** `vibes.diy/pkg/app/routes/chat/chat.$userSlug.$appSlug.tsx` — `submitting` state, `submitPrompt` guarded entry, reset on `running` handoff + send-promise settle, route both chips and `ChatInput.onSubmit` through it, pass `promptProcessing={submitting || running}`.
- **Create:** `vibes.diy/pkg/app/components/ChatInputStatus.tsx` — the memoized streaming status (working message + processing button styling) split out of `ChatInput`.
- **Modify:** `vibes.diy/pkg/app/components/ChatInput.tsx` — render `ChatInputStatus` for the button row; `React.memo` the shell; guard `autoResizeTextarea` against redundant writes.
- **Modify:** `vibes.diy/tests/app/ChatInput.test.tsx` — keep existing behavior green; add status/no-regression assertions.

---

## Part A — Duplicate-send guard + chip feedback

### Task 1: Pure submit-guard helper

**Files:**
- Create: `vibes.diy/pkg/app/utils/submit-guard.ts`
- Test: `vibes.diy/tests/app/submit-guard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// vibes.diy/tests/app/submit-guard.test.ts
import { describe, it, expect } from "vitest";
import { shouldAcceptPrompt } from "~/vibes.diy/app/utils/submit-guard.js";

describe("shouldAcceptPrompt", () => {
  it("accepts a non-empty prompt when idle", () => {
    expect(shouldAcceptPrompt({ text: "hello", submitting: false, running: false })).toBe(true);
  });

  it("rejects when a submit is already in flight (submitting)", () => {
    expect(shouldAcceptPrompt({ text: "hello", submitting: true, running: false })).toBe(false);
  });

  it("rejects when a turn is already streaming (running)", () => {
    expect(shouldAcceptPrompt({ text: "hello", submitting: false, running: true })).toBe(false);
  });

  it("rejects empty / whitespace-only text", () => {
    expect(shouldAcceptPrompt({ text: "", submitting: false, running: false })).toBe(false);
    expect(shouldAcceptPrompt({ text: "   ", submitting: false, running: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/tests/app && pnpm test submit-guard`
Expected: FAIL — cannot resolve `~/vibes.diy/app/utils/submit-guard.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// vibes.diy/pkg/app/utils/submit-guard.ts

/** Inputs for the single accept-a-turn decision. */
export interface SubmitGuardState {
  readonly text: string;
  /** A submit was accepted but the stream's first block hasn't landed yet. */
  readonly submitting: boolean;
  /** A turn is actively streaming (promptState.running). */
  readonly running: boolean;
}

/**
 * True only when a brand-new turn may be accepted. Closes the click→first-block
 * window: `submitting` covers the gap before `running` flips true, `running`
 * covers the rest of the turn.
 */
export function shouldAcceptPrompt({ text, submitting, running }: SubmitGuardState): boolean {
  if (submitting || running) return false;
  return text.trim().length > 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy/tests/app && pnpm test submit-guard`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/utils/submit-guard.ts vibes.diy/tests/app/submit-guard.test.ts
git commit -m "feat: add shouldAcceptPrompt guard helper (#1763)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: OptionButtons instant disable + pressed indicator

**Files:**
- Modify: `vibes.diy/pkg/app/components/OptionButtons.tsx`
- Test: `vibes.diy/tests/app/OptionButtons.test.tsx`

- [ ] **Step 1: Write the failing tests** (append inside the existing `describe("OptionButtons", ...)` block)

```tsx
import { fireEvent } from "@testing-library/react"; // add to existing imports at top of file

it("disables every chip after one is clicked", () => {
  const onSelect = vi.fn();
  const { getByText, getAllByRole } = render(<OptionButtons options={SAMPLE_OPTIONS} onSelect={onSelect} />);
  fireEvent.click(getByText("Add a settings page"));
  for (const btn of getAllByRole("button")) {
    expect(btn).toBeDisabled();
  }
});

it("calls onSelect exactly once even if a chip is clicked repeatedly", () => {
  const onSelect = vi.fn();
  const { getByText } = render(<OptionButtons options={SAMPLE_OPTIONS} onSelect={onSelect} />);
  const chip = getByText("Add a settings page");
  fireEvent.click(chip);
  fireEvent.click(chip);
  fireEvent.click(chip);
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelect).toHaveBeenCalledWith("Add a settings page");
});

it("marks the clicked chip as pressed via aria-pressed", () => {
  const onSelect = vi.fn();
  const { getByText } = render(<OptionButtons options={SAMPLE_OPTIONS} onSelect={onSelect} />);
  fireEvent.click(getByText("Make the empty state friendlier"));
  expect(getByText("Make the empty state friendlier").closest("button")).toHaveAttribute("aria-pressed", "true");
});

it("does not select or call onSelect when the group is disabled (history)", () => {
  const onSelect = vi.fn();
  const { getByText } = render(<OptionButtons options={SAMPLE_OPTIONS} disabled onSelect={onSelect} />);
  fireEvent.click(getByText("Add a settings page"));
  expect(onSelect).not.toHaveBeenCalled();
  expect(getByText("Add a settings page").closest("button")).toHaveAttribute("aria-pressed", "false");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd vibes.diy/tests/app && pnpm test OptionButtons`
Expected: FAIL — chips stay enabled after click; no `aria-pressed`; `onSelect` fires 3×.

- [ ] **Step 3: Implement local selected state**

Replace the body of `OptionButtons` in `vibes.diy/pkg/app/components/OptionButtons.tsx` (the component function at lines 24–54) with:

```tsx
export function OptionButtons({ options, disabled, isFirst, onSelect }: OptionButtonsProps) {
  const [selected, setSelected] = React.useState<string | null>(null);

  // When this message scrolls into history (disabled flips true) drop the
  // pressed state so it doesn't linger as a stuck highlight.
  React.useEffect(() => {
    if (disabled) setSelected(null);
  }, [disabled]);

  if (options.length === 0) return null;

  // Locked once a selection is made (instant feedback) or when this is history.
  const locked = disabled || selected !== null;

  const handleClick = (option: string) => {
    if (locked) return;
    setSelected(option);
    onSelect?.(option);
  };

  return (
    <div className="mt-3 flex flex-col gap-2" data-message-role="brainstorm-options">
      {isFirst && (
        <p className="text-xs text-light-secondary dark:text-dark-secondary" data-testid="option-buttons-explainer">
          These are optional. Pick one to suggest the next improvement, or type your own change.
        </p>
      )}
      {options.map((option) => {
        const isPressed = selected === option;
        return (
          <button
            key={option}
            type="button"
            disabled={locked}
            aria-pressed={isPressed}
            onClick={() => handleClick(option)}
            className={
              "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors " +
              "border border-light-decorative-01 dark:border-dark-decorative-01 " +
              "bg-light-background-01 dark:bg-dark-background-01 " +
              "text-light-primary dark:text-dark-primary " +
              (locked
                ? "cursor-default opacity-70"
                : "hover:bg-light-decorative-01 dark:hover:bg-dark-decorative-01 cursor-pointer")
            }
          >
            <span>{option}</span>
            {isPressed && (
              <span
                data-testid="option-spinner"
                aria-hidden="true"
                className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
```

Note: `React` is already imported at the top of the file (`import React from "react";`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd vibes.diy/tests/app && pnpm test OptionButtons`
Expected: PASS — all existing explainer tests plus the 4 new ones.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/components/OptionButtons.tsx vibes.diy/tests/app/OptionButtons.test.tsx
git commit -m "feat: chips disable + show pressed state on click (#1763)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Route — single guarded submit entry point

**Files:**
- Modify: `vibes.diy/pkg/app/routes/chat/chat.$userSlug.$appSlug.tsx`

This component is large and not unit-rendered in the suite; correctness of the decision is covered by Task 1's helper tests, and end-to-end behavior is covered by manual verification (Task 6). Each step below is a precise edit.

- [ ] **Step 1: Import the guard helper**

Add to the import block at the top of the route file (near the other `../../utils` / component imports):

```ts
import { shouldAcceptPrompt } from "../../utils/submit-guard.js";
```

(Confirm the relative depth: the file is at `app/routes/chat/`, so `../../utils/` reaches `app/utils/`. Adjust to match sibling imports in the same file if they differ.)

- [ ] **Step 2: Add `submitting` state + `submitPrompt`, route `handleSelectOption` through it**

Replace the existing block at lines 339–345:

```ts
const [promptToSend, sendPrompt] = useState<string | null>(null);
const handleSelectOption = useCallback(
  (option: string) => {
    sendPrompt(option);
  },
  [sendPrompt]
);
```

with:

```ts
const [promptToSend, sendPrompt] = useState<string | null>(null);
// True from the moment a turn is accepted until the stream's first block
// flips promptState.running true (or the send settles/errors). Closes the
// click→first-block window where neither promptToSend nor running is truthy.
const [submitting, setSubmitting] = useState(false);

const submitPrompt = useCallback(
  (text: string) => {
    if (!shouldAcceptPrompt({ text, submitting, running: promptState.running })) return;
    setSubmitting(true);
    sendPrompt(text);
  },
  [submitting, promptState.running, sendPrompt]
);

const handleSelectOption = useCallback((option: string) => submitPrompt(option), [submitPrompt]);

// Primary reset: once the stream starts, `running` carries the busy signal.
useEffect(() => {
  if (promptState.running) setSubmitting(false);
}, [promptState.running]);
```

- [ ] **Step 3: Reset `submitting` on the send promise settling (backstop)**

In the prompt-firing effect, the `chat.prompt(...).then(...)` callback is at lines 497–504. Replace it with a `.then().catch()` that always clears `submitting` (covers a send that throws before any block, e.g. network failure, so the UI can't wedge):

```ts
chat
  .prompt({
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: sentPrompt }],
      },
    ],
  })
  .then((r) => {
    if (r.isErr()) {
      console.error(`PromptSend failed`, r.Ok());
    } else {
      console.log(`send prompt`, sentPrompt);
      notifyRecentVibesChanged();
    }
  })
  .catch((err) => {
    console.error(`PromptSend threw`, err);
  })
  .finally(() => {
    setSubmitting(false);
  });
```

- [ ] **Step 4: Wire `ChatInput` to the guarded entry + instant busy state**

In the `chatInput={...}` prop of `<AppLayout>` (lines 809–820), change `onSubmit` and `promptProcessing`:

```tsx
<ChatInput
  ref={chatInput}
  onSubmit={submitPrompt}
  promptProcessing={submitting || promptState.running}
  hasCode={promptState.hasCode}
  currentMsgCount={promptState.current?.msgs.length ?? 0}
  selectedTheme={promptState.theme ?? null}
  onThemeButtonClick={() => setThemeModalOpen(true)}
/>
```

(Only `onSubmit` and `promptProcessing` change; leave the other props as-is.)

- [ ] **Step 5: Typecheck + build the route**

Run: `cd vibes.diy/pkg && pnpm build`
Expected: build succeeds, no TS errors about `submitPrompt` / `submitting` / `shouldAcceptPrompt`.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/pkg/app/routes/chat/chat.\$userSlug.\$appSlug.tsx
git commit -m "fix: route chips + input through one guarded submitPrompt (#1763)

submitting flag closes the click->first-block multi-fire window; resets
on running handoff and on send-promise settle.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Part B — Chat-input render perf (profile-first)

### Task 4: Profile the streaming + typing path

**Files:** none (investigation). Record findings in the PR description / a scratch note.

- [ ] **Step 1: Start the app**

Run: `cd vibes.diy/pkg && pnpm dev` (or the project's documented dev command). Open a chat session in Chrome.

- [ ] **Step 2: Capture a baseline trace while typing during a stream**

Use the chrome-devtools MCP: `performance_start_trace`, then send a prompt and — while it streams — type a follow-up into the textarea, then `performance_stop_trace`. Also read `list_console_messages` for the `[chat-debug]` render-seq lines (emitted by `useChatDebug` in MessageList) and watch `ChatInput` re-render frequency.

- [ ] **Step 3: Record the dominant cost**

Confirm (or refute) the hypothesis: `ChatInput` re-renders on every streamed block because `currentMsgCount`/`hasCode` change per block. Note whether `MessageList` items also re-render every block (this decides whether Task 6 is needed). Write the conclusion into the PR description.

- [ ] **Step 4: Commit the note (if a scratch file was used)**

```bash
# only if you created a notes file under docs/
git add docs/ && git commit -m "docs: chat-input perf profiling baseline (#1763)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

(If you used no file, skip this commit.)

---

### Task 5: Split streaming status out of ChatInput + memoize + autoResize guard

**Files:**
- Create: `vibes.diy/pkg/app/components/ChatInputStatus.tsx`
- Modify: `vibes.diy/pkg/app/components/ChatInput.tsx`
- Test: `vibes.diy/tests/app/ChatInput.test.tsx`

- [ ] **Step 1: Write the failing test** (append to `describe("ChatInput Component", ...)`)

```tsx
it("shows the working message on the send button while processing", () => {
  render(
    <MockThemeProvider>
      <ChatInput promptProcessing={true} onSubmit={onSubmit} hasCode={false} currentMsgCount={0} />
    </MockThemeProvider>
  );
  // getWorkingMessage(false, 0) === "Thinking about your vibe..."
  expect(screen.getByLabelText("Processing").textContent).toContain("Thinking about your vibe...");
});

it("shows the Code label and keeps the textarea typeable when idle", () => {
  render(
    <MockThemeProvider>
      <ChatInput promptProcessing={false} onSubmit={onSubmit} />
    </MockThemeProvider>
  );
  expect(screen.getByLabelText("Send message").textContent).toContain("Code");
  const textArea = screen.getByPlaceholderText("I want to build...");
  fireEvent.change(textArea, { target: { value: "abc" } });
  expect((textArea as HTMLTextAreaElement).value).toBe("abc");
});
```

- [ ] **Step 2: Run tests to verify current state**

Run: `cd vibes.diy/tests/app && pnpm test ChatInput`
Expected: the two new tests PASS already against current code (they pin behavior we must preserve through the refactor). If they fail, fix the test to match current labels before refactoring. This is a characterization checkpoint — do not change `ChatInput` yet.

- [ ] **Step 3: Create `ChatInputStatus`**

```tsx
// vibes.diy/pkg/app/components/ChatInputStatus.tsx
import React from "react";
import { Button } from "./ui/button.js";

function getWorkingMessage(hasCode: boolean, msgCount: number): string {
  if (!hasCode && msgCount === 0) return "Thinking about your vibe...";
  if (!hasCode && msgCount > 0) return "Planning your app...";
  if (hasCode && msgCount < 20) return "Writing code...";
  if (hasCode && msgCount < 50) return "Building components...";
  return "Finishing up...";
}

interface ChatInputStatusProps {
  promptProcessing: boolean;
  hasCode: boolean;
  currentMsgCount: number;
  onSend: () => void;
  buttonRef: React.Ref<HTMLButtonElement>;
}

const btnSnakeBorder =
  "conic-gradient(from var(--border-angle, 0deg), var(--vibes-input-border, #d4d4d8) 0deg 180deg, var(--vibes-red, #DA291C) 180deg 205deg, var(--vibes-yellow, #fedd00) 205deg 230deg, var(--vibes-green, #22c55e) 230deg 255deg, var(--vibes-blue, #3b82f6) 255deg 280deg, var(--vibes-input-border, #d4d4d8) 280deg 360deg)";

/**
 * The streaming-driven half of the chat composer: the send button and its
 * "working…" label. Split out of ChatInput and memoized so per-block prop
 * churn (currentMsgCount/hasCode) re-renders only this small subtree, not the
 * textarea the user is typing into.
 */
function ChatInputStatusImpl({ promptProcessing, hasCode, currentMsgCount, onSend, buttonRef }: ChatInputStatusProps) {
  const workingMessage = getWorkingMessage(hasCode, currentMsgCount);
  return (
    <div
      style={{
        display: "inline-flex",
        borderRadius: 7,
        padding: promptProcessing ? 2 : 0,
        background: promptProcessing ? btnSnakeBorder : "transparent",
        animation: promptProcessing ? "vibes-border-spin 2s linear infinite" : "none",
      }}
    >
      <Button
        ref={buttonRef}
        type="button"
        onClick={onSend}
        disabled={promptProcessing}
        variant="blue"
        size="fixed"
        aria-label={promptProcessing ? "Processing" : "Send message"}
        className={
          promptProcessing
            ? "!border-0 !shadow-none !bg-[var(--vibes-submit-disabled-bg)] !text-[var(--vibes-submit-disabled-fg)]"
            : ""
        }
        style={promptProcessing ? { opacity: 1 } : undefined}
      >
        {promptProcessing ? workingMessage : "Code"}
      </Button>
    </div>
  );
}

export const ChatInputStatus = React.memo(ChatInputStatusImpl);
export default ChatInputStatus;
```

- [ ] **Step 4: Use `ChatInputStatus` inside `ChatInput` and remove the duplicated bits**

In `vibes.diy/pkg/app/components/ChatInput.tsx`:

1. Add the import: `import { ChatInputStatus } from "./ChatInputStatus.js";`
2. Delete the local `getWorkingMessage` function (lines 32–38), the `workingMessage` `useMemo` (line 63), and the `btnSnakeBorder` const (line 128) — they now live in `ChatInputStatus`.
3. Replace the button wrapper block (lines 221–247, the `<div style={{ ... snake ... }}>…<Button>…</Button></div>`) with:

```tsx
<ChatInputStatus
  promptProcessing={promptProcessing}
  hasCode={hasCode}
  currentMsgCount={currentMsgCount}
  onSend={handleSendPrompt}
  buttonRef={submitButtonRef}
/>
```

4. Guard `autoResizeTextarea` so it only writes when the height actually changes (avoids a forced reflow-write on every render). Replace lines 99–106:

```tsx
const autoResizeTextarea = useCallback(() => {
  const el = realTextArea.current;
  if (!el) return;
  el.style.height = "auto";
  const maxHeight = 200;
  const minHeight = 90;
  const next = `${Math.max(minHeight, Math.min(maxHeight, el.scrollHeight))}px`;
  if (el.style.height !== next) el.style.height = next;
}, []);
```

(`ref` was the prior dependency and is unused inside the callback — drop it.)

- [ ] **Step 5: Run ChatInput tests**

Run: `cd vibes.diy/tests/app && pnpm test ChatInput`
Expected: PASS — all pre-existing tests (`renders without crashing`, `calls onSubmit when send button is clicked`, `keeps textarea typeable but disables send while promptProcessing`, Enter handling, `does not call onSubmit when Enter is pressed while processing`) plus the two new ones. The send button is still found via `getByLabelText("Send message")` / `"Processing"`.

- [ ] **Step 6: Re-profile to confirm improvement**

Repeat Task 4's trace. Confirm `ChatInput`'s textarea subtree no longer re-renders on every streamed block (only `ChatInputStatus` does). Note before/after render counts in the PR.

- [ ] **Step 7: Commit**

```bash
git add vibes.diy/pkg/app/components/ChatInputStatus.tsx vibes.diy/pkg/app/components/ChatInput.tsx vibes.diy/tests/app/ChatInput.test.tsx
git commit -m "perf: split streaming status out of ChatInput; guard autoResize (#1763)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6 (CONDITIONAL): Memoize message-list items by block id

**Only do this task if Task 4/Step 3 found `MessageList` re-rendering every message item per streamed block.** Otherwise skip it (YAGNI) and note in the PR that profiling did not justify it.

**Files:**
- Modify: `vibes.diy/pkg/app/components/MessageList.tsx`

- [ ] **Step 1: Confirm the trigger**

Re-read the Task 4 profile. Proceed only if non-streaming message items (stable `sectionId`/`blockId`) show fresh `render-seq` increments on each block while their content is unchanged.

- [ ] **Step 2: Wrap the leaf message components in `React.memo`**

`MessageList` already memoizes the list itself (`export default memo(MessageList, ...)` at lines 765–775) and renders leaf components `CodeMsg`, `TopLevelMsg`, `Prompt`. Wrap the leaves whose props are value-stable across blocks (`CodeMsg`, `Prompt`) in `React.memo` with a comparator keyed on the block's identity + content length. Example for `Prompt`:

```tsx
const Prompt = React.memo(function Prompt({ msg }: { msg: PromptReq }) {
  // ...existing body unchanged...
});
```

For `CodeMsg`, add a comparator that returns true when `begin.sectionId`, `lines.length`, and `end` identity are unchanged. Do NOT memoize `TopLevelMsg` — `MessageList` mutates its props via `cloneElement` (`isLast`, `streaming`, `onSelectOption`, `isFirstWithOptions`) each render, so memoizing it would mask intended updates.

- [ ] **Step 3: Run the MessageList-related tests + re-profile**

Run: `cd vibes.diy/tests/app && pnpm test`
Expected: PASS. Re-profile and confirm reduced per-block item re-renders.

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/pkg/app/components/MessageList.tsx
git commit -m "perf: memoize stable message-list leaves (#1763)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] **Step 1: Full check**

Run: `pnpm check` (format + build + test + lint) from the repo root.
Expected: PASS. (Per `agents/flaky-tests.md`, rerun a failing suite in isolation before treating a failure as real.)

- [ ] **Step 2: Manual browser verification (chrome-devtools, qa-pr style)**

  - Slow-turn repro: open a session with active chips, rapid-click a chip during the in-flight window → exactly ONE user message and ONE AI turn; the clicked chip shows the spinner and all chips in the group are disabled immediately.
  - Text input: press Enter / click Code rapidly during the window → only one turn fires; the button shows the working state immediately.
  - Typing: while a turn streams, type a follow-up into the textarea → characters keep up with keystrokes.
  - Error path: simulate a send failure (e.g. offline) → chips/input re-enable rather than wedging.

- [ ] **Step 3: Open the PR**

```bash
git push -u origin popmechanic/chip-multifire-and-input-perf
gh pr create --repo VibesDIY/vibes.diy --fill
```

Reference issue #1763 in the PR body and paste the before/after profiling notes.
