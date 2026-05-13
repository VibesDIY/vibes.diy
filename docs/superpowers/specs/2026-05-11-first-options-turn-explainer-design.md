# First Options-Turn Explainer — Design

**Date:** 2026-05-11
**Scope:** `vibes.diy/pkg/app/components/OptionButtons.tsx`, `vibes.diy/pkg/app/components/MessageList.tsx`.
**Status:** Approved, ready for implementation plan.
**Builds on:** [2026-05-09-auto-interview-after-codegen-design.md](2026-05-09-auto-interview-after-codegen-design.md). That feature now ships every assistant turn with a trailing `▸ ` improvement question. This change adds a one-time explainer above the first such options block in a chat so the user understands the affordance is optional.

## Problem

After the auto-interview ships, every assistant message in a chat ends with one improvement question and 2–4 `▸ ` options. The buttons are self-evident in shape, but new users can read them as "the only way forward" and miss that they can simply type their own change. We want a single, unobtrusive line of helper copy the first time options appear in a chat — enough to set expectations once without nagging the user on every subsequent turn.

## Goals

- A short helper line appears above the options on the **first** assistant message in a chat that has options.
- The helper does not appear on any subsequent options-turn — the user only needs to learn the affordance once.
- The placement is deterministic, controlled by the frontend (no system-prompt change, no LLM compliance risk).
- The copy makes clear that the options are optional and that typing a custom change is equivalent.

## Non-goals

- Re-showing the explainer after the escape hatch (`▸ I'm done for now`) pauses the loop and the user resumes later. Once seen, never re-shown — the chat itself is the persistence boundary.
- A dismiss button. The helper disappears naturally after the first options-turn; no toggle needed.
- Localization or per-user A/B variants of the copy. Single English string.
- Migration of in-flight chats. If a chat already has multiple assistant messages with options when this lands, the EARLIEST one in render order picks up the helper. That's the intended behavior — the "first" anchor is positional, not historical.

## Design

### 1. Copy

A single line:

> *"These are optional. Pick one to suggest the next improvement, or type your own change."*

Plain text, no markdown. Renders above the `▸ ` buttons inside the same container that already wraps the buttons in `OptionButtons`.

### 2. Detection — which message is "first"

`MessageList` already runs a post-render pass over its accumulated `messageElements` array to mark the most-recent `TopLevelMsg` as `isLast: true` (lines 684–695 of `MessageList.tsx`). The new logic adds a second pass that walks forward through the same array, peeks at each `TopLevelMsg` element's `lines` prop, runs `parseOptionLines`, and stops at the first element whose `options` is non-empty. That element is cloned with `isFirstWithOptions: true`.

Two passes over the same array, both running at most once per render. The cost is negligible — `parseOptionLines` is a small string-walk, and the early-exit terminates as soon as the first match is found.

### 3. Plumbing

- `TopLevelMsg` (in `MessageList.tsx`) gains an `isFirstWithOptions?: boolean` prop (default `false`). It forwards the value to `OptionButtons` as a new `isFirst` prop.
- `OptionButtons` gains an `isFirst?: boolean` prop. When `isFirst === true && options.length > 0`, it renders the helper line as the first child of its existing `<div className="mt-3 flex flex-col gap-2">` container, so the helper sits above the buttons separated by the same `gap-2` spacing the buttons use between themselves.

The `isFirst` flag is orthogonal to `disabled`. A history message that happens to be the first with options renders the helper above its disabled (visual-history) buttons — that's correct, because the user might be looking at older turns and still benefits from seeing the original affordance explainer.

### 4. Rendering details

```tsx
<div className="mt-3 flex flex-col gap-2" data-message-role="brainstorm-options">
  {isFirst && (
    <p className="text-xs text-light-secondary dark:text-dark-secondary">
      These are optional. Pick one to suggest the next improvement, or type your own change.
    </p>
  )}
  {options.map((option) => (
    <button ...>{option}</button>
  ))}
</div>
```

The helper uses the existing `light-secondary` / `dark-secondary` Tailwind tokens for muted text, with `text-xs` for visual weight subordinate to the buttons. No new color tokens, no new components.

### 5. Edge cases

- **Chat with no options yet (e.g., a fresh empty chat before the first assistant response):** no `TopLevelMsg` has non-empty options, so no element gets `isFirstWithOptions: true`. Nothing renders. Fine.
- **Streaming mid-turn:** during streaming, the in-progress `TopLevelMsg` may have `options` empty until the trailing `▸ ` block lands. The first-with-options scan re-runs on every render, so once the first option line arrives the helper appears in-place. No flicker beyond the natural streaming cadence.
- **Recovery-truncated TopLevel** (lines 637–644 of `MessageList.tsx`): a recovered TopLevel block is rendered with `isLast: false, onSelectOption: undefined` and is part of `messageElements`. The first-with-options scan treats it identically to a normal TopLevel; if a recovered block happens to be the first with options, it gets the helper above its disabled buttons. Acceptable — the explainer text reads the same regardless of whether the buttons are live.
- **Reload mid-thread:** persisted assistant messages re-render, the scan re-runs, and the helper attaches to whichever element is now positionally first with options. The placement is deterministic across reloads.
- **Old chats from before this change:** if a chat exists with multiple options-turns from before this code lands, the helper attaches to the first one when the user reopens that chat. That's the desired retroactive behavior — the user gets the explainer on the earliest options-turn they can see, even if they've already done the loop several times.

### 6. Testing

- **Unit (OptionButtons):** two new assertions in a small component test (Vitest + React Testing Library, matching the existing test patterns in `vibes.diy/tests/app`):
  1. When `isFirst={true}` and `options.length > 0`, the helper string appears in the rendered output.
  2. When `isFirst={false}` (or omitted) and `options.length > 0`, the helper string is absent.
- **MessageList integration:** no new test. The existing "last TopLevelMsg becomes interactive" behavior already proves the cloneElement pattern works; the new pass uses the same pattern.

## Open questions for the implementation plan

- **Test file placement:** the existing `OptionButtons` component has no dedicated test file (it's exercised indirectly via the chat route's e2e tests). The implementation plan should decide whether to add `vibes.diy/tests/app/OptionButtons.test.tsx` or to fold the two new assertions into an existing nearby test file. My recommendation is a new dedicated file — small, isolated, easy to extend if more `OptionButtons` props arrive later.
- **Tailwind token names:** confirm `text-light-secondary` / `text-dark-secondary` exist in the project's token set. If the actual token names differ (e.g., `text-light-primary/60` or a custom `text-muted`), match what the rest of the codebase uses for muted helper text.
