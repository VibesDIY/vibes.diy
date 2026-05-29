# Suggestion chips: pending state + chat-input render perf

**Issue:** [VibesDIY/vibes.diy#1763](https://github.com/VibesDIY/vibes.diy/issues/1763)
**Date:** 2026-05-29
**Scope:** Both the chip multi-fire bug (issue title) and the chat-input typing lag (follow-up comment).

## Problem

Two related defects in the chat panel.

### A. Suggestion chips multi-fire on slow turns

Clicking a suggestion chip ("I'm done for now", etc.) gives no feedback and the AI
turn takes seconds to respond. Users assume the click missed and click again,
firing duplicate user messages and burning duplicate AI turns + tokens.

This is a **race**, not just missing CSS:

- A chip click calls `handleSelectOption(option)` → `sendPrompt(option)`, which sets
  the `promptToSend` state ([chat.$userSlug.$appSlug.tsx:340-345](../../../vibes.diy/pkg/app/routes/chat/chat.$userSlug.$appSlug.tsx)).
- The firing `useEffect` *clears `promptToSend` back to `null` before it calls
  `chat.prompt()`* ([:484-487](../../../vibes.diy/pkg/app/routes/chat/chat.$userSlug.$appSlug.tsx)).
- `promptState.running` does not flip to `true` until the **first streamed block
  arrives** seconds later (reducer on `isPromptBlockBegin`).

So between the click and the first block there is a window where **no state says
"busy"** — `promptToSend` is already null again and `running` is still false.
Guarding on either flag alone does not close the window. The chip's only current
disable condition is `disabled={!isLast}` ([MessageList.tsx:189](../../../vibes.diy/pkg/app/components/MessageList.tsx)),
which only trips once a *newer* message exists — i.e. after the turn lands, too late.

The text input submit path (Enter / "Code" button) has the same gap: it guards on
`promptProcessing` (= `promptState.running`) only ([ChatInput.tsx:92-97, 191](../../../vibes.diy/pkg/app/components/ChatInput.tsx)).

### B. Typing into the chat textarea feels laggy

The textarea keeps its draft in **local** state, so typing in isolation is cheap.
The lag bites **during streaming**: the route re-renders on every streamed block
(the `promptState` reducer), and `<ChatInput>` re-renders with it. Two compounding
causes:

1. `ChatInput` is not memoized **and** receives `currentMsgCount` / `hasCode` props
   that change on every block ([:816](../../../vibes.diy/pkg/app/routes/chat/chat.$userSlug.$appSlug.tsx))
   to drive the "Writing code… / Building components…" button label. Memoizing the
   component alone would not help — the streaming status is wired straight into the
   input.
2. `autoResizeTextarea()` performs a **synchronous layout reflow** (reads
   `scrollHeight`, writes `height`) on every render ([ChatInput.tsx:99-110](../../../vibes.diy/pkg/app/components/ChatInput.tsx)).

## Goals / Non-goals

**Goals**
- A chip click can never fire more than one turn, regardless of how fast/often the
  user clicks during the in-flight window.
- The same guarantee for the text-input submit path.
- Immediate visual feedback on a clicked chip (all chips on that message disable; the
  clicked chip shows a pressed/spinner state).
- Typing in the chat textarea stays responsive while a turn is streaming.

**Non-goals**
- No new "pending AI reply" placeholder bubble in the transcript. The existing
  "working" button state covers latency visibility (per product decision).
- No store/`useSyncExternalStore` refactor of the route's streaming state (approach
  B2, considered and rejected as over-scoped for this issue).

## Design

### Part A — single guarded submit entry point

Introduce one accept-a-turn function in the route and route **both** entry points
(chips and text input) through it.

```ts
// route component
const [submitting, setSubmitting] = useState(false);

const submitPrompt = useCallback(
  (text: string) => {
    if (submitting || promptState.running) return; // hard no-op during in-flight window
    if (!text.trim()) return;
    setSubmitting(true);
    sendPrompt(text);
  },
  [submitting, promptState.running]
);

const handleSelectOption = useCallback((option: string) => submitPrompt(option), [submitPrompt]);
```

- `ChatInput`'s `onSubmit` becomes `submitPrompt` (was `sendPrompt`).
- **Handoff:** when the first block lands, `promptState.running` goes true and
  carries the busy signal. Clear `submitting` on that transition:

  ```ts
  useEffect(() => {
    if (promptState.running) setSubmitting(false);
  }, [promptState.running]);
  ```

  `submitting` covers the click→first-block gap; `running` covers first-block→end.
  The combined `submitting || running` is true for the entire in-flight period.
- **Failure path:** the `chat.prompt()` promise's error branch
  ([:498](../../../vibes.diy/pkg/app/routes/chat/chat.$userSlug.$appSlug.tsx)) must
  `setSubmitting(false)` so a send that errors before any block cannot wedge the
  chips/input in a permanently-disabled state. (Guard against a stuck flag is the
  one real risk of this approach; the error-path reset is mandatory, not optional.)

**Disable signal down the tree.** Thread `optionsBusy = submitting || promptState.running`
from the route → `ChatInterface` → `MessageList` → `OptionButtons`. On the most-recent
message the chip `disabled` becomes `!isLast || optionsBusy`, and `onSelect` is passed
only when `!optionsBusy`.

**Instant pressed feedback, local to `OptionButtons`.** So feedback does not wait on
prop propagation, track the clicked option locally:

```tsx
const [selected, setSelected] = useState<string | null>(null);
// on click: setSelected(option); onSelect?.(option);
// each button: disabled={disabled || selected !== null}
// the button where option === selected renders a pressed/spinner state
```

This is self-contained — no extra props from the route beyond the existing
`disabled`/`onSelect`. Old (history) messages keep rendering disabled via `!isLast`
as today.

### Part B — decouple streaming status from the textarea, then memoize (profile-first)

1. **Profile first.** Use chrome-devtools (`performance_start_trace` + render counts;
   the components already emit `data-render-seq` via `useChatDebug`) to confirm the
   dominant cost while streaming + typing. Do not optimize blind.
2. **Split the streaming-driven UI out of `ChatInput`.** Extract the working-message /
   processing-button area into a small subcomponent that takes the per-block inputs
   (`promptProcessing`, `hasCode`, `currentMsgCount`). The outer `ChatInput` shell (the
   textarea + local draft state) stops receiving per-block props, so it no longer
   re-renders on every block. Wrap the shell in `React.memo`.
   - Net effect: streaming updates re-render only the small status subcomponent;
     keystrokes re-render only the textarea shell. They stop fighting.
3. **Make `autoResize` cheap.** Only write `height` when the computed value actually
   differs from the current height (skip redundant reflow). Keep the `[prompt]`
   dependency — resizing on real content change is correct.
4. **(Conditional) Memoize message-list items by block id.** Only if the profile shows
   `MessageList` re-rendering every item per block. Fold in then; otherwise skip
   (YAGNI).

## Testing & verification

- **Unit / component tests** (`vibes.diy/tests`):
  - `submitPrompt` no-ops when `submitting` is true and when `promptState.running` is
    true; fires exactly once across a rapid triple-call.
  - `submitting` resets when `running` transitions to true (handoff) and on the
    `chat.prompt` error path.
  - `OptionButtons`: clicking a chip disables all chips and marks the clicked one
    pressed; disabled chips are non-interactive.
- **Manual / browser (chrome-devtools, qa-pr style):**
  - Slow-turn repro: rapid-click a chip during the in-flight window → exactly one user
    message + one AI turn.
  - Type into the textarea while a turn streams → input stays responsive.
  - Perf trace before/after showing reduced `ChatInput` render count during streaming.
- `pnpm check` (format + build + test + lint).

## Risk

- **Stuck-disabled flag (Part A):** the only sharp edge. Mitigated by clearing
  `submitting` on both the `running` handoff and the error path; a component test pins
  the error-path reset.
- **Behavioral regression in input UX (Part B):** splitting `ChatInput` could disturb
  focus/auto-resize/imperative-ref behavior (`clickSubmit`, `setPrompt`, theme
  prefill). Keep the imperative handle and textarea in the outer shell; only the
  status/button area moves. Covered by manual verification.
