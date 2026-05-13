# Auto-Interview After Code-Gen — Design

**Date:** 2026-05-09
**Scope:** `prompts/pkg` (system-prompt templates), `vibes.diy/pkg/app` (chat UI), `vibes.diy/api` (cleanup of unused brainstorm-mode plumbing).
**Status:** Approved, ready for implementation plan.
**Supersedes:** [2026-05-09-chat-button-improvement-interview-design.md](2026-05-09-chat-button-improvement-interview-design.md). The dual-button "Chat" feature shipped on PR #1642 worked well enough that the interview itself is being promoted from an opt-in affordance to the default after-code-gen behavior. Most of that PR's brainstorm-mode infrastructure is deleted by this change.

## Problem

The just-shipped Chat button (PR #1642) lets the user opt into an improvement interview that suggests the next iteration of their app. Smoke testing confirmed the interview behavior was useful — but the separate button created friction. Users had to know the Chat affordance existed and remember to click it; the interview added value to *every* iteration, but it was only running when the user explicitly invoked it.

We want the interview to be the default. Every code-gen turn should end with one improvement question and a small set of clickable answer options, so the user can iterate by clicking — without a separate mode or button.

## Goals

- Every assistant turn ends with one short improvement question and 2–4 clickable `▸ ` options. Last option is always the escape hatch: `▸ I'm done for now`.
- Picking the escape hatch makes the *next* assistant turn a one-line acknowledgment with no edits and no question, pausing the loop until the user types a fresh prompt.
- Picking any other option fires a normal code-gen turn whose narration explains the change, makes the edits, and ends with another improvement question.
- Single LLM call per round (interview behavior folded into the code-gen system prompt). No separate `'brainstorm'` mode.
- Single submit button. The dual `Chat`/`Code` UI from PR #1642 collapses back to one button labeled `Code`.
- Question quality reaches the bar set by the dedicated brainstorm prompt — its category list and Translation Layer carry over into the code-gen prompt's tail.

## Non-goals

- Multi-question batches per turn (always one question per turn).
- A "Skip interview" affordance separate from the escape hatch. The escape hatch is the single explicit pause.
- Server-driven orchestration. Each user input still maps to exactly one LLM round-trip; the loop is sustained by the user's clicks/typing.
- Migration of in-flight brainstorm-mode chat threads. Old `<vibes-brief>` text in history just renders as inert assistant prose.

## Design

### 1. New tail on the code-gen system prompts

Both `prompts/pkg/system-prompt.md` (the continuation template) and `prompts/pkg/system-prompt-initial.md` (the first-turn template) get a new section appended after their existing instructions. The tail is identical between the two files because the behavior is identical — the very first turn ends with the very first improvement question.

The tail covers six things:

1. **The shape of every turn**: code edits / acknowledgment, then exactly one improvement question with 2–4 options.
2. **Marker and formatting**: each option begins with `▸ ` (U+25B8 BLACK RIGHT-POINTING SMALL TRIANGLE + space) on its own line. The chat UI parses these into clickable buttons. Don't number, don't bullet.
3. **Escape hatch**: the last option is always `▸ I'm done for now`. When the user picks it (their next message contains exactly that text), the next assistant turn is one or two lines of acknowledgment, no edits, no question. The loop pauses until the user types something else.
4. **Question categories** (pick ONE per turn that fits the current state): opener "what part needs to feel better?", main interaction, friction, what's missing, vibe shift, what gets saved, scope of next change, special features. Invent fresh, app-specific options every time — don't reuse generic answers.
5. **Translation Layer** (silent reasoning, never shown to the user): Fireproof-flavored mapping of audience/sharing answers to data architecture. Carried over verbatim from the retired `system-prompt-brainstorm.md`.
6. **Iteration semantic**: when the user picks an option, the next turn must (a) make the change implied by their answer and (b) end with another improvement question — unless the option was the escape hatch.

The tail is markdown, lives entirely inside the existing prompt asset files, and is loaded the same way the rest of those templates are loaded. No new asset files, no new builders.

### 2. Frontend: collapse to a single button

`vibes.diy/pkg/app/components/ChatInput.tsx` reverts the dual-button refactor from PR #1642:

- Remove the Chat button entirely.
- `onSubmit` reverts to `(prompt: string) => void`.
- `handleSendPrompt` reverts to one argument; the textarea Enter handler calls it directly.
- The single Code button stays, with its current loading-border treatment unchanged.
- `ChatInput.test.tsx` assertions revert to the original one-arg form.

`vibes.diy/pkg/app/routes/chat/chat.$userSlug.$appSlug.tsx`:

- `sendPrompt` queue reverts from `{ text: string; mode: "app" | "brainstorm" } | null` to `string | null`.
- The firing effect reverts to passing only the text to `chat.prompt(...)` — no mode override.
- Remove the `<vibes-brief>` auto-handoff effect entirely.
- `handleSelectOption` is kept but simplified: it calls `sendPrompt(option)` (no mode wrapper). Clicking an option is now structurally identical to typing the option text and pressing Enter.

`vibes.diy/pkg/app/components/MessageList.tsx`, `OptionButtons.tsx`, and `vibes.diy/pkg/app/utils/option-lines.ts` are unchanged. They already parse `▸ ` lines from any assistant `TopLevelMsg` and render clickable buttons. They become the rendering pipeline for *every* turn's trailing question, not just brainstorm-turn questions. The "most recent message gets interactive buttons; older messages get disabled buttons" behavior also carries over unchanged.

`vibes.diy/pkg/app/components/ChatInterface.tsx` keeps the `onSelectOption` prop and forwarding — no change.

### 3. Backend cleanup

Delete the brainstorm-mode infrastructure that PR #1642 added. Specifically:

- `prompts/pkg/system-prompt-brainstorm.md` — the asset.
- `makeBrainstormSystemPrompt` and `MakeBrainstormSystemPromptOptions` / `BrainstormSystemPromptResult` in `prompts/pkg/prompts.ts`.
- The `makeBrainstormSystemPrompt` re-export in `prompts/pkg/index.ts`.
- The brainstorm asset branch in `prompts/tests/helpers/load-mock-data.ts` and the `?raw` import.
- `prompts/tests/brainstorm-prompt.test.ts` — the unit test file.
- `'brainstorm'` literal from `PromptLLMStyle` in `vibes.diy/api/types/chat.ts`.
- `reqPromptBrainstormChatSection` and `isReqPromptBrainstormChatSection` in the same file.
- The `.or(reqPromptBrainstormChatSection)` chain extension on `reqPromptLLMChatSection`.
- All brainstorm branches in `vibes.diy/api/svc/public/prompt-chat-section.ts`:
  - The `makeBrainstormSystemPrompt` import.
  - The `if (resChat.mode === "brainstorm")` branch in the system-prompt selector inside `injectSystemPrompt`.
  - The `case "brainstorm":` in the model-id resolution switch.
  - The `req.mode === "brainstorm"` widening in the system-prompt-injection gate (reverts to `req.mode === "chat"` only).
  - The `req.mode === "brainstorm"` widening in the first-turn verbosity hint (reverts to `req.mode === "chat"`).
  - The `if (resChat.mode === "brainstorm") return Result.Ok();` early-return in the recovery dispatcher.
  - The `else if (isReqPromptBrainstormChatSection(orig))` error branch in `getResChatFromMode`.
  - The `isReqPromptBrainstormChatSection` import.
- The `mode?: PromptLLMStyle` opts override on `LLMChat.prompt()` in `vibes.diy/api/types/vibes-diy-api.ts` (interface) and `vibes.diy/api/impl/index.ts` (implementation). The signature reverts to `prompt(req: LLMRequest, opts?: { inputImageBase64?: string })`.
- `vibes.diy/api/tests/brainstorm-mode.test.ts` — the integration test.
- `vibes.diy/api/tests/package.json` — remove the `@vibes.diy/prompts` workspace dep added in PR #1642 Task 16. The matching `pnpm-lock.yaml` entry should be regenerated.

After this cleanup, the only artifacts of PR #1642 that remain are the option-line parser, the `OptionButtons` component, the `TopLevelMsg` integration, and the route's `handleSelectOption` plumbing — all reused by the new design.

### 4. Interaction model

A turn always pairs the work with the next-step question:

```
User: "build a todo list"
Assistant:
  [code-gen narration + edits land in the chat]
  ▸ Make the empty state friendlier
  ▸ Add a way to mark items done
  ▸ Track when each todo was added
  ▸ I'm done for now
```

The user's response decides the next turn:

- **Click an option (not escape hatch)** → option text becomes the next user message → next assistant turn makes the corresponding change and ends with a new question.
- **Click the escape hatch** → user message is `"I'm done for now"` → next assistant turn is one or two lines of acknowledgment, no edits, no question. Loop pauses.
- **Type a custom answer + Enter / Code** → typed text becomes the user message → next assistant turn does what was asked (which may or may not relate to the offered options) and ends with a new question.
- **Don't respond** → the chat sits with the unanswered question. The user can come back any time and pick up where they left off.

The "most recent message has interactive buttons; older messages have disabled buttons (visual history)" rule from PR #1642 stays as-is — it works the same for these inline questions.

### 5. Edge cases

- **Model forgets the question** (just emits code edits with no `▸ ` lines): no error. The `OptionButtons` component returns null when there are no options. The user can type a fresh prompt to continue. Worth noting in QA but not blocking.
- **Model emits the question without the escape hatch** (forgets it): user can type a custom answer or just walk away. No special handling.
- **Model emits the escape hatch but the user picks a non-escape option**: normal flow, the escape hatch text isn't sent and the loop continues.
- **Reload mid-thread**: persisted assistant messages re-render with their `▸ ` lines parsed into disabled buttons; the most recent assistant message gets interactive buttons again. Same behavior as PR #1642.
- **Old chats from PR #1642**: history may contain `<vibes-brief>` text in assistant turns. It renders as inert assistant prose. No migration. The auto-handoff effect that PR #1642 used to detect those tags is gone, so even if a `<vibes-brief>` appears in a new turn (e.g., the model echoes one from training), nothing reacts to it.
- **Initial-turn integration**: the first turn from a fresh chat must also end with a question. The `system-prompt-initial.md` template's existing scaffolding instructions stay; the new tail is appended after them. Output cadence: scaffold + early visible edits + later interactivity + final improvement question.
- **Recovery interaction**: SEARCH/REPLACE recovery is unaffected. The trailing question is plain markdown narration; recovery ignores it.

### 6. Testing

- **Unit (prompts pkg)**: existing `prompt-builder.test.ts` adds two assertions — substring checks that both `system-prompt.md` and `system-prompt-initial.md` contain the new tail's marker text (e.g., `"▸ I'm done for now"`). Guards against accidental removal of the instruction.
- **Unit (frontend)**: `option-lines.test.ts` is unchanged. `parseOptionLines` doesn't care which kind of turn produced the `▸ ` lines.
- **Component tests**: `ChatInput.test.tsx` reverts to one-arg `onSubmit` assertions (the assertions that PR #1642 Task 9 changed). No new component tests needed for the rendering pipeline since `OptionButtons` rendering is already covered by its existing usage in PR #1642's TopLevelMsg integration.
- **API tests**: delete `brainstorm-mode.test.ts`. No new API tests needed — there's no per-mode branching to assert anymore.
- **Manual smoke (PR preview)**: initial prompt fires code-gen → trailing `▸ ` question appears in the same assistant message → click an option → next turn lands with edits + a new question → pick "I'm done for now" → next turn is a short ack with no question → type a fresh prompt → loop resumes with a new question.

## Open questions for the implementation plan

- **Tail length**: roughly how long should the new tail section be? My estimate is ~25–40 lines of markdown carrying the categories list, the Translation Layer (carried over verbatim from the retired brainstorm asset), and the escape-hatch semantic. Implementation can refine.
- **First-turn vs continuation tail differences**: the design says identical tails for both files. If the LLM emits weaker first-turn questions (because the app just appeared and the model doesn't have iteration context yet), a small first-turn-specific phrasing tweak may be warranted. Defer to implementation.
- **Question-category ordering signal**: the brainstorm prompt's category list was unordered; the LLM picked freely. Whether the new tail should suggest "opener first turn, then alternate categories" or stay unordered is a tuning decision for implementation.
