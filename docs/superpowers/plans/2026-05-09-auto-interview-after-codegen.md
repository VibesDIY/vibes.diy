# Auto-Interview After Code-Gen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the improvement-interview from an opt-in Chat-button affordance to the default after-every-code-gen behavior, by folding the interview into the existing code-gen system prompt and removing the dual-button / brainstorm-mode infrastructure shipped on PR #1642.

**Architecture:** Append a single instruction tail to both `prompts/pkg/system-prompt.md` (continuation) and `prompts/pkg/system-prompt-initial.md` (first-turn) telling the model to always end its turn with one improvement question + 2–4 `▸ ` options + the escape hatch `▸ I'm done for now`. The existing `parseOptionLines` / `OptionButtons` rendering pipeline already handles the trailing options and is reused unchanged. Everything else from PR #1642 — dual-button UI, mode-aware route plumbing, `<vibes-brief>` auto-handoff effect, brainstorm system prompt asset + builder + tests, brainstorm mode literal + request type + server branches, `LLMChat.prompt` mode override, brainstorm integration test — is deleted.

**Tech Stack:** TypeScript, React, vitest, arktype, pnpm workspaces. Asset bundling via the existing `loadAsset` cache in `prompts/pkg/prompts.ts`.

**Spec reference:** [docs/superpowers/specs/2026-05-09-auto-interview-after-codegen-design.md](../specs/2026-05-09-auto-interview-after-codegen-design.md)

**Branch:** `feat/chat-button-improvement-interview` (the same branch PR #1642 sits on — this revision builds on that PR's commits and supersedes the dual-button feature).

**Working directory:** `/Users/marcusestes/Websites/vibes.diy-chat-button` (the worktree from PR #1642).

---

## File Structure

**Modify (additions):**
- `prompts/pkg/system-prompt.md` — append the new tail.
- `prompts/pkg/system-prompt-initial.md` — append the same tail.
- `prompts/tests/prompt-builder.test.ts` — add two substring-presence assertions (one per template).

**Modify (reverts back toward `origin/main`):**
- `vibes.diy/pkg/app/components/ChatInput.tsx` — remove Chat button, revert `onSubmit` to one arg.
- `vibes.diy/pkg/app/routes/chat/chat.$userSlug.$appSlug.tsx` — revert `sendPrompt` queue to `string | null`, remove `<vibes-brief>` auto-handoff effect, simplify `handleSelectOption`, drop `mode` from the firing effect.
- `vibes.diy/tests/app/ChatInput.test.tsx` — revert assertions to one-arg `onSubmit`.
- `vibes.diy/api/types/vibes-diy-api.ts` — revert `LLMChat.prompt` interface.
- `vibes.diy/api/impl/index.ts` — revert `LLMChatImpl.prompt` impl.
- `vibes.diy/api/types/chat.ts` — drop `'brainstorm'` from `PromptLLMStyle`, drop `reqPromptBrainstormChatSection`, drop `isReqPromptBrainstormChatSection`, drop `.or(reqPromptBrainstormChatSection)` from the union.
- `vibes.diy/api/svc/public/prompt-chat-section.ts` — drop the brainstorm import, drop the `case "brainstorm":` in the model switch, drop the `req.mode === "brainstorm"` widenings (system-prompt gate + verbosity), drop the `if (resChat.mode === "brainstorm")` recovery early-return, drop the `else if (isReqPromptBrainstormChatSection(orig))` error branch, drop the brainstorm branch in `injectSystemPrompt`'s system-prompt selector.
- `prompts/pkg/prompts.ts` — drop `makeBrainstormSystemPrompt`, `MakeBrainstormSystemPromptOptions`, `BrainstormSystemPromptResult`.
- `prompts/pkg/index.ts` — drop the `makeBrainstormSystemPrompt` re-export.
- `prompts/tests/helpers/load-mock-data.ts` — drop the brainstorm asset branch and its `?raw` import.
- `vibes.diy/api/tests/package.json` — drop the `@vibes.diy/prompts` workspace dep.
- `pnpm-lock.yaml` — regenerate after removing the workspace dep.

**Delete:**
- `prompts/pkg/system-prompt-brainstorm.md`
- `prompts/tests/brainstorm-prompt.test.ts`
- `vibes.diy/api/tests/brainstorm-mode.test.ts`

**Unchanged (reused by new design):**
- `vibes.diy/pkg/app/utils/option-lines.ts` and `vibes.diy/tests/app/option-lines.test.ts`.
- `vibes.diy/pkg/app/components/OptionButtons.tsx`.
- `vibes.diy/pkg/app/components/MessageList.tsx` (option rendering inside `TopLevelMsg` reused for trailing questions).
- `vibes.diy/pkg/app/components/ChatInterface.tsx` (continues to forward `onSelectOption`).

---

## Task 1: Add failing assertions for the new system-prompt tail

**Files:**
- Modify: `prompts/tests/prompt-builder.test.ts`

- [ ] **Step 1: Open `prompts/tests/prompt-builder.test.ts`. Find the existing `describe("prompt builder (real implementation)", () => {` block (around line 106) and the `makeBaseSystemPrompt` test cases inside it.**

- [ ] **Step 2: Add two new `it` blocks inside the same `describe`, after the last existing `makeBaseSystemPrompt` case.**

The tests assert each system prompt template contains the literal escape-hatch text. They will fail until Task 2 lands.

```ts
  it("system-prompt.md ends every turn with one improvement question (escape hatch present)", async () => {
    const r = await makeBaseSystemPrompt("anthropic/claude-opus-4.5", {
      skills: ["fireproof"],
      title: "X",
      variant: "continuation",
    });
    expect(r.systemPrompt).toContain("▸ I'm done for now");
    expect(r.systemPrompt).toContain("End every turn with one improvement question");
  });

  it("system-prompt-initial.md ends the first turn with one improvement question (escape hatch present)", async () => {
    const r = await makeBaseSystemPrompt("anthropic/claude-opus-4.5", {
      skills: ["fireproof"],
      title: "X",
      variant: "initial",
    });
    expect(r.systemPrompt).toContain("▸ I'm done for now");
    expect(r.systemPrompt).toContain("End every turn with one improvement question");
  });
```

- [ ] **Step 3: Run the tests to confirm both fail for the right reason (substring not yet present in the templates).**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/prompts/tests && pnpm test prompt-builder -- --run 2>&1 | tail -30
```

Expected: both new tests fail with `expected '...' to contain "▸ I'm done for now"` (or similar). The other existing tests still pass.

If the failure message is different (e.g., `makeBaseSystemPrompt` errors out), investigate before proceeding — the tests should fail on the substring assertion specifically.

- [ ] **Step 4: Commit.**

```bash
git -C /Users/marcusestes/Websites/vibes.diy-chat-button add prompts/tests/prompt-builder.test.ts
git -C /Users/marcusestes/Websites/vibes.diy-chat-button commit -m "test(prompts): failing assertions for the auto-interview tail in system prompts"
```

---

## Task 2: Append the auto-interview tail to both system-prompt templates

**Files:**
- Modify: `prompts/pkg/system-prompt.md`
- Modify: `prompts/pkg/system-prompt-initial.md`

- [ ] **Step 1: Open `prompts/pkg/system-prompt.md`. Append the tail below to the end of the file (preserving any existing trailing newline). The `▸` character is U+25B8 BLACK RIGHT-POINTING SMALL TRIANGLE.**

```markdown

## End every turn with one improvement question

After your code edits (or your acknowledgment, if the user said they were done), end your response with exactly ONE short improvement question and 2–4 multiple-choice options.

Each option goes on its own line, prefixed with `▸ ` (the `▸` character — U+25B8 BLACK RIGHT-POINTING SMALL TRIANGLE — followed by a space). The chat UI parses these into clickable buttons. Don't number them. Don't use bullets, dashes, or other list markers.

The last option is always the escape hatch: `▸ I'm done for now`.

When the user's next message is exactly `I'm done for now`, your next turn must skip both the edits and the question — just one or two short acknowledgment lines (e.g., "Sounds good. Ping me when you want to keep iterating."). The loop pauses until the user types something else.

When the user picks any other option (or types a custom answer), your next turn:

1. Make the change implied by their answer.
2. End with another improvement question.

### Question categories — pick ONE per turn

Pick the category that fits the current state of the app. Don't repeat the same category back-to-back unless something obviously needs revisiting.

- **What part needs to feel better?** Always good for the first few turns. Options reference parts the user can see in the current app.
- **Main interaction.** What part of using the app should change? Options drawn from interactions visible in the code.
- **What's the friction?** What is annoying or confusing about how it works today?
- **What's missing?** What should be there that isn't?
- **What's the vibe?** Should the personality or tone shift, or stay the same? (Mood, not visuals.)
- **What gets saved?** Adding a new piece of information that should still be there tomorrow, or just changing how an existing piece looks?
- **Sharing changes.** Only ask if the app already has any sharing — does the proposed change affect what other people see?
- **Scope of next change.** Quick polish, new feature, or bigger rework?
- **Special features.** Anything unique to this concept that would shape the build (a timer, a vote, an AI suggestion, a drag interaction).

Invent fresh, app-specific options every time. Don't reuse generic answers.

### Translation Layer (your reasoning, never shown to the user)

Map user answers to architecture for the next turn:

- "Just me" — all persistent data in a single Fireproof database (`useFireproof("vibe-…")`), no user attribution needed; Fireproof sync handles cross-device access.
- "Shared with a group" — same Fireproof database for everyone in the group, with `createdBy: user?.email || 'anonymous'` on user-owned docs.
- "Real-time with others" — shared Fireproof database with `createdBy` on every doc; ephemeral interaction (drag position, cursor, hover) stays in `useState` and is never written to Fireproof.
- "Personal views" — every doc tagged `createdBy`, filtered on read via `useLiveQuery` keyed on the current user.
- "Same view for everyone" — no filtering; `useLiveQuery` returns all docs to all clients.

Map vibe to personality:

- "Serious and buttoned-up" — formal labels, no emoji, concise copy.
- "Casual and friendly" — conversational microcopy, gentle humor.
- "Playful and a little weird" — fun empty states, personality in error messages.
- "Calm and focused" — minimal UI chrome, generous whitespace.

Map scope to architecture:

- "Quick polish" — small targeted edits, no new components.
- "New feature" — new section or component, possibly new persisted field.
- "Bigger rework" — restructure how features compose; multiple components touched.
```

- [ ] **Step 2: Append the same tail to `prompts/pkg/system-prompt-initial.md` (also at the end of the file, preserving the existing trailing newline).**

The text is identical between the two files. Copy it exactly as written above.

- [ ] **Step 3: Verify `▸` characters survived the edit (8+ occurrences per file — one in the escape-hatch text plus several in the prose, plus more once usage examples are added by future iterations).**

```bash
grep -c "▸" /Users/marcusestes/Websites/vibes.diy-chat-button/prompts/pkg/system-prompt.md
grep -c "▸" /Users/marcusestes/Websites/vibes.diy-chat-button/prompts/pkg/system-prompt-initial.md
```

Expected: at least 4 each (the escape-hatch text appears multiple times in the tail).

- [ ] **Step 4: Run the failing tests from Task 1.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/prompts/tests && pnpm test prompt-builder -- --run 2>&1 | tail -10
```

Expected: PASS (both new tests + all pre-existing tests).

- [ ] **Step 5: Commit.**

```bash
git -C /Users/marcusestes/Websites/vibes.diy-chat-button add prompts/pkg/system-prompt.md prompts/pkg/system-prompt-initial.md
git -C /Users/marcusestes/Websites/vibes.diy-chat-button commit -m "feat(prompts): always end every turn with one improvement question"
```

---

## Task 3: Remove the `<vibes-brief>` auto-handoff effect from the chat route

**Files:**
- Modify: `vibes.diy/pkg/app/routes/chat/chat.$userSlug.$appSlug.tsx`

PR #1642 added an effect that scanned each completed assistant turn for a `<vibes-brief>...</vibes-brief>` block and auto-fired a follow-up `mode: "app"` prompt. With the new design, every turn is `mode: "app"` and ends with a `▸ ` question instead of a `<vibes-brief>`. The effect is no longer triggered by anything and should be removed before the rest of the brainstorm cleanup so subsequent reverts don't accidentally retain a dangling reference.

- [ ] **Step 1: Locate the brief-detection effect by searching for `lastBriefHandledRef`.**

```bash
grep -n "lastBriefHandledRef\|vibes-brief" /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/pkg/app/routes/chat/chat.\$userSlug.\$appSlug.tsx
```

You should find:
- The `useRef<string | null>(null)` declaration named `lastBriefHandledRef`.
- A `useEffect(() => { ... }, [promptState.running, promptState.blocks]);` block that uses `lastBriefHandledRef`, iterates `promptState.blocks`, and matches `/<vibes-brief>([\s\S]*?)<\/vibes-brief>/`.
- An import of `isToplevelBegin, isToplevelLine` from `@vibes.diy/call-ai-v2` (added when the effect was implemented).

- [ ] **Step 2: Delete the entire `lastBriefHandledRef` declaration and the `useEffect` that uses it. They sit consecutively.**

The block to remove looks like:

```ts
  const lastBriefHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (promptState.running) return;
    const blocks = promptState.blocks;
    if (blocks.length === 0) return;

    // Find the latest assistant TopLevel message text.
    const lastBlock = blocks[blocks.length - 1];
    let collected = "";
    let toplevelStreamId: string | null = null;
    for (const msg of lastBlock.msgs) {
      if (isToplevelBegin(msg)) {
        collected = "";
        toplevelStreamId = msg.streamId;
      } else if (isToplevelLine(msg)) {
        collected += (collected ? "\n" : "") + msg.line;
      }
    }
    if (!toplevelStreamId) return;

    // Only handle each turn once.
    if (lastBriefHandledRef.current === toplevelStreamId) return;

    const match = collected.match(/<vibes-brief>([\s\S]*?)<\/vibes-brief>/);
    if (!match) return;

    const briefBody = match[1].trim();
    if (!briefBody) return;

    lastBriefHandledRef.current = toplevelStreamId;
    sendPrompt({ text: `Build this change:\n\n${briefBody}`, mode: "app" });
  }, [promptState.running, promptState.blocks]);
```

Delete it in full.

- [ ] **Step 3: Update the `@vibes.diy/call-ai-v2` import line to drop `isToplevelBegin` and `isToplevelLine` since they are no longer referenced. Find the existing import:**

```ts
import { isCodeBegin, isBlockEnd, isToplevelBegin, isToplevelLine } from "@vibes.diy/call-ai-v2";
```

Replace with:

```ts
import { isCodeBegin, isBlockEnd } from "@vibes.diy/call-ai-v2";
```

(If your local file shows a slightly different shape — e.g., the helpers are in a multi-line import — apply the same intent: remove `isToplevelBegin` and `isToplevelLine`.)

- [ ] **Step 4: Build to confirm no other reference to the removed helpers or the deleted ref.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/pkg && pnpm tsc --noEmit
```

Expected: no errors. If TypeScript reports `isToplevelBegin is declared but never read`, you missed Step 3. If it reports `lastBriefHandledRef`, you missed Step 2.

- [ ] **Step 5: Run the existing app tests.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/tests && pnpm test -- --run 2>&1 | tail -10
```

Expected: pass. The flaky test mentioned in `agents/flaky-tests.md` is acceptable; rerun once if it appears.

- [ ] **Step 6: Commit.**

```bash
git -C /Users/marcusestes/Websites/vibes.diy-chat-button add vibes.diy/pkg/app/routes/chat/chat.\$userSlug.\$appSlug.tsx
git -C /Users/marcusestes/Websites/vibes.diy-chat-button commit -m "feat(chat-route): drop <vibes-brief> auto-handoff effect (no longer needed)"
```

---

## Task 4: Revert ChatInput dual-button + route mode plumbing + tests

**Files:**
- Modify: `vibes.diy/pkg/app/components/ChatInput.tsx`
- Modify: `vibes.diy/pkg/app/routes/chat/chat.$userSlug.$appSlug.tsx`
- Modify: `vibes.diy/tests/app/ChatInput.test.tsx`

This task is a single commit because changes across these three files must land atomically — the `onSubmit` signature and the `sendPrompt` shape must agree at all times. Three sub-files but one logical revert.

- [ ] **Step 1: In `vibes.diy/pkg/app/components/ChatInput.tsx`, revert the `ChatInputProps.onSubmit` signature.**

Find:

```ts
  /**
   * `mode` is `'brainstorm'` when the user clicked Chat, `'app'` (code-gen)
   * when they clicked Code. Other modes are not exposed via this input.
   */
  onSubmit: (prompt: string, mode: "app" | "brainstorm") => void;
```

Replace with:

```ts
  onSubmit: (prompt: string) => void;
```

- [ ] **Step 2: Revert `handleSendPrompt` to one argument.**

Find:

```ts
    const handleSendPrompt = useCallback(
      (mode: "app" | "brainstorm") => {
        if (prompt && !promptProcessing) {
          onSubmit(prompt, mode);
          setPrompt("");
        }
      },
      [prompt, promptProcessing, onSubmit]
    );
```

Replace with:

```ts
    const handleSendPrompt = useCallback(() => {
      if (prompt && !promptProcessing) {
        onSubmit(prompt);
        setPrompt("");
      }
    }, [prompt, promptProcessing, onSubmit]);
```

- [ ] **Step 3: Revert the textarea `onKeyDown` Enter handler.**

Find:

```ts
                  handleSendPrompt("app");
```

Replace with:

```ts
                  handleSendPrompt();
```

- [ ] **Step 4: Replace the dual-button JSX block with the single Code button.**

Find the current block beginning with `<div className="flex items-center gap-2">` (the wrapper introduced by PR #1642's Task 9) and ending with the matching closing `</div>`. Replace the whole block with the original single-button shape:

```tsx
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
                ref={submitButtonRef}
                type="button"
                onClick={handleSendPrompt}
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
```

Note: `onClick={handleSendPrompt}` (no arrow wrapper) because the handler now takes zero arguments.

- [ ] **Step 5: In `vibes.diy/tests/app/ChatInput.test.tsx`, revert the two assertions that PR #1642 changed.**

Find:

```ts
    expect(onSubmit).toHaveBeenCalledWith("Hello world", "app");
```

Replace with:

```ts
    expect(onSubmit).toHaveBeenCalledWith("Hello world");
```

The same line appears twice in the file (one in the click test, one in the Enter-key test). Replace both occurrences.

- [ ] **Step 6: In `vibes.diy/pkg/app/routes/chat/chat.$userSlug.$appSlug.tsx`, revert the `promptToSend` state shape.**

Find:

```ts
  interface PendingPrompt {
    text: string;
    mode: "app" | "brainstorm";
  }
  const [promptToSend, sendPrompt] = useState<PendingPrompt | null>(null);
```

Replace with:

```ts
  const [promptToSend, sendPrompt] = useState<string | null>(null);
```

- [ ] **Step 7: Revert the firing-effect predicate.**

Find:

```ts
      if (chat && promptToSend && promptToSend.text.trim().length) {
```

Replace with:

```ts
      if (chat && promptToSend?.trim().length) {
```

- [ ] **Step 8: Revert the firing-effect body.**

Find:

```ts
        const sentPrompt = promptToSend;
        // Clear promptToSend BEFORE firing so any re-render of this effect
        // (e.g. searchParams change) sees null and skips the branch.
        sendPrompt(null);
        chat
          .prompt(
            {
              messages: [
                {
                  role: "user",
                  content: [{ type: "text", text: sentPrompt.text }],
                },
              ],
            },
            sentPrompt.mode === "brainstorm" ? { mode: "brainstorm" } : undefined
          )
          .then((r) => {
            if (r.isErr()) {
              console.error(`PromptSend failed`, r.Ok());
            } else {
              console.log(`send prompt`, sentPrompt.text, sentPrompt.mode);
              notifyRecentVibesChanged();
            }
          });
```

Replace with:

```ts
        const sentPrompt = promptToSend;
        // Clear promptToSend BEFORE firing so any re-render of this effect
        // (e.g. searchParams change) sees null and skips the branch.
        sendPrompt(null);
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
          });
```

- [ ] **Step 9: Revert the URL-prompt prefill call.**

Find:

```ts
        sendPrompt({ text: promptText, mode: "app" });
```

Replace with:

```ts
        sendPrompt(promptText);
```

- [ ] **Step 10: Revert the ChatInput `onSubmit` wiring.**

Find:

```tsx
              onSubmit={(text, mode) => sendPrompt({ text, mode })}
```

Replace with:

```tsx
              onSubmit={sendPrompt}
```

- [ ] **Step 11: Simplify `handleSelectOption`.**

Find:

```ts
  const handleSelectOption = useCallback(
    (option: string) => {
      sendPrompt({ text: option, mode: "brainstorm" });
    },
    [sendPrompt]
  );
```

Replace with:

```ts
  const handleSelectOption = useCallback(
    (option: string) => {
      sendPrompt(option);
    },
    [sendPrompt]
  );
```

- [ ] **Step 12: Build to confirm everything types.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/pkg && pnpm tsc --noEmit
```

Expected: no errors. If TS errors at the chat route's `chat.prompt(...)` call about `mode?` being passed, you missed Step 8.

- [ ] **Step 13: Run the frontend tests.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/tests && pnpm test -- --run 2>&1 | tail -10
```

Expected: 1116/1117 pass (matches PR #1642's baseline). One known flaky test is acceptable.

- [ ] **Step 14: Commit all three files in a single commit.**

```bash
git -C /Users/marcusestes/Websites/vibes.diy-chat-button add \
  vibes.diy/pkg/app/components/ChatInput.tsx \
  vibes.diy/pkg/app/routes/chat/chat.\$userSlug.\$appSlug.tsx \
  vibes.diy/tests/app/ChatInput.test.tsx
git -C /Users/marcusestes/Websites/vibes.diy-chat-button commit -m "feat(chat-ui): collapse dual-button to single Code button"
```

---

## Task 5: Revert `LLMChat.prompt` mode override

**Files:**
- Modify: `vibes.diy/api/types/vibes-diy-api.ts`
- Modify: `vibes.diy/api/impl/index.ts`

After Task 4, the chat route no longer passes `opts.mode`. The mode override on `LLMChat.prompt` is unused and should be removed before deleting the `'brainstorm'` mode literal in Task 7.

- [ ] **Step 1: In `vibes.diy/api/types/vibes-diy-api.ts`, revert the `LLMChat.prompt` interface.**

Find:

```ts
  /**
   * Send a user prompt. By default the request goes out with the chat
   * session's mode (set when openChat was called). Pass `opts.mode` to send
   * a single prompt under a different mode without reopening the session
   * — used by the Chat (brainstorm) button to interleave brainstorm and
   * code-gen turns inside one chat thread.
   */
  prompt(
    req: LLMRequest,
    opts?: { inputImageBase64?: string; mode?: import("./chat.js").PromptLLMStyle }
  ): Promise<Result<ResPromptChatSection, VibesDiyError>>;
```

Replace with:

```ts
  prompt(req: LLMRequest, opts?: { inputImageBase64?: string }): Promise<Result<ResPromptChatSection, VibesDiyError>>;
```

- [ ] **Step 2: In `vibes.diy/api/impl/index.ts`, revert `LLMChatImpl.prompt`.**

Find:

```ts
  async prompt(
    msg: LLMRequest,
    opts?: { inputImageBase64?: string; mode?: PromptLLMStyle }
  ): Promise<Result<ResPromptChatSection, VibesDiyError>> {
    const mode = opts?.mode ?? this.res.mode;
    if (!isPromptLLMStyle(mode)) {
      return Result.Err({
        type: "vibes.diy.error",
        name: "VibesDiyError",
        message: `Chat mode ${mode} does not support prompting`,
        code: "unsupported-chat-mode",
      } as VibesDiyError);
    }
    const res = await this.api.request<ReqType<ReqPromptLLMChatSection>, ResPromptChatSection>(
      {
        type: "vibes.diy.req-prompt-chat-section",
        mode,
        chatId: this.res.chatId,
        outerTid: this.tid, //leaking but necessary streaming
        prompt: msg,
        ...(mode === "img" && opts?.inputImageBase64 ? { inputImageBase64: opts.inputImageBase64 } : {}),
      },
      {
        resMatch: isResPromptChatSection,
      }
    );
    return res;
  }
```

Replace with:

```ts
  async prompt(msg: LLMRequest, opts?: { inputImageBase64?: string }): Promise<Result<ResPromptChatSection, VibesDiyError>> {
    const mode = this.res.mode;
    if (!isPromptLLMStyle(mode)) {
      return Result.Err({
        type: "vibes.diy.error",
        name: "VibesDiyError",
        message: `Chat mode ${this.res.mode} does not support prompting`,
        code: "unsupported-chat-mode",
      } as VibesDiyError);
    }
    const res = await this.api.request<ReqType<ReqPromptLLMChatSection>, ResPromptChatSection>(
      {
        type: "vibes.diy.req-prompt-chat-section",
        mode,
        chatId: this.res.chatId,
        outerTid: this.tid, //leaking but necessary streaming
        prompt: msg,
        ...(mode === "img" && opts?.inputImageBase64 ? { inputImageBase64: opts.inputImageBase64 } : {}),
      },
      {
        resMatch: isResPromptChatSection,
      }
    );
    return res;
  }
```

- [ ] **Step 3: Check whether `PromptLLMStyle` is still imported anywhere in `index.ts`. If the only remaining use was inside the `prompt` method's type, you can remove the symbol from the import line.**

```bash
grep -n "PromptLLMStyle" /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/api/impl/index.ts
```

If the only match is the import statement at the top, remove `PromptLLMStyle` from that import line. If `PromptLLMStyle` still appears elsewhere (e.g., in narrowing helpers), leave the import alone.

- [ ] **Step 4: Build.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/api && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit.**

```bash
git -C /Users/marcusestes/Websites/vibes.diy-chat-button add \
  vibes.diy/api/types/vibes-diy-api.ts \
  vibes.diy/api/impl/index.ts
git -C /Users/marcusestes/Websites/vibes.diy-chat-button commit -m "feat(api-impl): drop per-prompt mode override on LLMChat.prompt (unused)"
```

---

## Task 6: Remove brainstorm branches from `prompt-chat-section.ts`

**Files:**
- Modify: `vibes.diy/api/svc/public/prompt-chat-section.ts`

This task removes every brainstorm reference from the API server-side handler. After this, `prompt-chat-section.ts` no longer imports `makeBrainstormSystemPrompt` or `isReqPromptBrainstormChatSection`, no longer branches on `resChat.mode === "brainstorm"`, and no longer special-cases `req.mode === "brainstorm"` anywhere. Task 7 will then delete the type definitions those branches referenced.

- [ ] **Step 1: Drop `makeBrainstormSystemPrompt` from the `@vibes.diy/prompts` import.**

Find:

```ts
import {
  getRecoveryAddendum,
  getRecoveryStitchAddendum,
  makeBaseSystemPrompt,
  makeBrainstormSystemPrompt,
  resolveEffectiveModel,
} from "@vibes.diy/prompts";
```

Replace with:

```ts
import { getRecoveryAddendum, getRecoveryStitchAddendum, makeBaseSystemPrompt, resolveEffectiveModel } from "@vibes.diy/prompts";
```

- [ ] **Step 2: Drop `isReqPromptBrainstormChatSection` from the `../../types/chat.js` import.**

Search the file for `isReqPromptBrainstormChatSection`:

```bash
grep -n "isReqPromptBrainstormChatSection" /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/api/svc/public/prompt-chat-section.ts
```

Two matches expected: one in the imports block, one in the `getResChatFromMode` error branch (Step 6 below). Remove the symbol from the imports line. The Step 6 reference goes away when we delete the error branch.

- [ ] **Step 3: Drop the brainstorm system-prompt selector branch inside `injectSystemPrompt`.**

Find:

```ts
    const effectiveModel = await resolveEffectiveModel({ model }, {});
    const pkgBaseUrl = promptsPkgBaseUrl(vctx.params.pkgRepos.workspace);
    const fetchOverride = createPromptAssetFetch({ fetchAsset: vctx.fetchAsset });
    if (resChat.mode === "brainstorm") {
      return makeBrainstormSystemPrompt(effectiveModel, {
        title,
        theme,
        currentVfs: priorFs,
        pkgBaseUrl,
        fetch: fetchOverride,
      });
    }
    return makeBaseSystemPrompt(effectiveModel, {
      skills,
      theme,
      title,
      demoData: false,
      variant: isInitial ? "initial" : "continuation",
      pkgBaseUrl,
      fetch: fetchOverride,
    });
```

Replace with:

```ts
    return makeBaseSystemPrompt(await resolveEffectiveModel({ model }, {}), {
      skills,
      theme,
      title,
      demoData: false,
      variant: isInitial ? "initial" : "continuation",
      pkgBaseUrl: promptsPkgBaseUrl(vctx.params.pkgRepos.workspace),
      fetch: createPromptAssetFetch({ fetchAsset: vctx.fetchAsset }),
    });
```

(This restores the function shape that existed on `origin/main` before PR #1642 Task 5 introduced the branching helpers.)

- [ ] **Step 4: Drop `case "brainstorm":` from the model-id resolution switch.**

Find:

```ts
      switch (req.mode) {
        case "chat":
          return Result.Ok(req.prompt.model ?? r.Ok().chat.model.id);
        case "app":
          return Result.Ok(req.prompt.model ?? r.Ok().app.model.id);
        case "img":
          return Result.Ok(req.prompt.model ?? r.Ok().img.model.id);
        case "brainstorm":
          // Brainstorm is conversational like chat — reuse the chat default model.
          return Result.Ok(req.prompt.model ?? r.Ok().chat.model.id);
        default:
          return Result.Err(`Unknown prompt mode: ${(req as { mode: string }).mode}`);
      }
```

Replace with:

```ts
      switch (req.mode) {
        case "chat":
          return Result.Ok(req.prompt.model ?? r.Ok().chat.model.id);
        case "app":
          return Result.Ok(req.prompt.model ?? r.Ok().app.model.id);
        case "img":
          return Result.Ok(req.prompt.model ?? r.Ok().img.model.id);
        default:
          return Result.Err(`Unknown prompt mode: ${(req as { mode: string }).mode}`);
      }
```

- [ ] **Step 5: Narrow the system-prompt-injection gate back to chat-only.**

Find:

```ts
      if (req.mode === "chat" || req.mode === "brainstorm") {
        // Both chat (creation) and brainstorm (improvement-interview) build their
        // system prompt server-side via injectSystemPrompt; that helper branches
        // internally on resChat.mode to pick makeBaseSystemPrompt vs
        // makeBrainstormSystemPrompt.
        withSystemPrompt = await injectSystemPrompt(vctx, req.chatId, req.prompt.model ?? modelId, resChat);
      } else if (req.mode === "app" || req.mode === "img") {
```

Replace with:

```ts
      if (req.mode === "chat") {
        withSystemPrompt = await injectSystemPrompt(vctx, req.chatId, req.prompt.model ?? modelId, resChat);
      } else if (req.mode === "app" || req.mode === "img") {
```

- [ ] **Step 6: Narrow the first-turn verbosity hint back to chat-only.**

Find:

```ts
    ...(isInitialTurn && (req.mode === "chat" || req.mode === "brainstorm") ? { verbosity: "low" as const } : {}),
```

Replace with:

```ts
    ...(isInitialTurn && req.mode === "chat" ? { verbosity: "low" as const } : {}),
```

- [ ] **Step 7: Drop the brainstorm recovery-skip early return.**

Find:

```ts
        if (recoverHint === null) {
          // Stream finished naturally and no recovery was triggered.
          return Result.Ok();
        }

        if (resChat.mode === "brainstorm") {
          // Brainstorm output is plain markdown — no SEARCH/REPLACE blocks
          // to recover. If a recoverHint somehow fires, drop it.
          return Result.Ok();
        }
```

Replace with:

```ts
        if (recoverHint === null) {
          // Stream finished naturally and no recovery was triggered.
          return Result.Ok();
        }
```

- [ ] **Step 8: Drop the brainstorm error branch in `getResChatFromMode`.**

Find:

```ts
  if (!iResChat) {
    if (isReqCreationPromptChatSection(orig)) {
      return Result.Err(`Creation Chat ID ${req.chatId} not found`);
    } else if (isReqPromptApplicationChatSection(orig)) {
      return Result.Err(`Application Chat ID ${req.chatId} not found`);
    } else if (isReqPromptImageChatSection(orig)) {
      return Result.Err(`Image Chat ID ${req.chatId} not found`);
    } else if (isReqPromptBrainstormChatSection(orig)) {
      return Result.Err(`Brainstorm Chat ID ${req.chatId} not found`);
    }
  }
```

Replace with:

```ts
  if (!iResChat) {
    if (isReqCreationPromptChatSection(orig)) {
      return Result.Err(`Creation Chat ID ${req.chatId} not found`);
    } else if (isReqPromptApplicationChatSection(orig)) {
      return Result.Err(`Application Chat ID ${req.chatId} not found`);
    } else if (isReqPromptImageChatSection(orig)) {
      return Result.Err(`Image Chat ID ${req.chatId} not found`);
    }
  }
```

- [ ] **Step 9: Confirm there are no remaining brainstorm references in this file.**

```bash
grep -n "brainstorm\|Brainstorm" /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/api/svc/public/prompt-chat-section.ts
```

Expected: no matches.

- [ ] **Step 10: Build.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/api && pnpm tsc --noEmit
```

Expected: no errors. Note: the `'brainstorm'` literal is still in `PromptLLMStyle` until Task 7, so a switch on `req.mode` would normally need a default — the existing default returns the "Unknown prompt mode" error, which is fine.

- [ ] **Step 11: Commit.**

```bash
git -C /Users/marcusestes/Websites/vibes.diy-chat-button add vibes.diy/api/svc/public/prompt-chat-section.ts
git -C /Users/marcusestes/Websites/vibes.diy-chat-button commit -m "feat(api): drop brainstorm branches from prompt-chat-section"
```

---

## Task 7: Remove the `'brainstorm'` mode literal and its request type

**Files:**
- Modify: `vibes.diy/api/types/chat.ts`

After Task 6, no code in the API references `'brainstorm'` anymore. Now we can drop the type definitions.

- [ ] **Step 1: Revert `PromptLLMStyle` to the original three-mode union.**

Find:

```ts
export const PromptLLMStyle = type("'chat' | 'app' | 'img' | 'brainstorm'");
```

Replace with:

```ts
export const PromptLLMStyle = type("'chat' | 'app' | 'img'");
```

- [ ] **Step 2: Delete the `reqPromptBrainstormChatSection` block and its type guard.**

Find the block (added by PR #1642 Task 1):

```ts
export const reqPromptBrainstormChatSection = type({
  type: "'vibes.diy.req-prompt-chat-section'",
  mode: "'brainstorm'",
  auth: dashAuthType,
  chatId: "string",
  outerTid: "string", // this is used to emit events to the current chat session
  prompt: LLMRequest,
});

export function isReqPromptBrainstormChatSection(obj: unknown): obj is typeof reqPromptBrainstormChatSection.infer {
  return !(reqPromptBrainstormChatSection(obj) instanceof type.errors);
}
```

Delete it in full.

- [ ] **Step 3: Revert the `reqPromptLLMChatSection` union.**

Find:

```ts
export const reqPromptLLMChatSection = reqCreationPromptChatSection
  .or(reqPromptApplicationChatSection)
  .or(reqPromptImageChatSection)
  .or(reqPromptBrainstormChatSection);
```

Replace with:

```ts
export const reqPromptLLMChatSection = reqCreationPromptChatSection
  .or(reqPromptApplicationChatSection)
  .or(reqPromptImageChatSection);
```

- [ ] **Step 4: Confirm no remaining brainstorm references in this file.**

```bash
grep -n "brainstorm\|Brainstorm" /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/api/types/chat.ts
```

Expected: no matches.

- [ ] **Step 5: Build the api package and the frontend package to surface any external references that may have leaked.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/api && pnpm tsc --noEmit
cd /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/pkg && pnpm tsc --noEmit
```

Expected: both clean. If anything errors, the offending file still imports a brainstorm symbol — find and remove the import.

- [ ] **Step 6: Commit.**

```bash
git -C /Users/marcusestes/Websites/vibes.diy-chat-button add vibes.diy/api/types/chat.ts
git -C /Users/marcusestes/Websites/vibes.diy-chat-button commit -m "feat(api-types): drop 'brainstorm' from PromptLLMStyle and its request type"
```

---

## Task 8: Remove the brainstorm builder, asset, and unit tests

**Files:**
- Modify: `prompts/pkg/prompts.ts`
- Modify: `prompts/pkg/index.ts`
- Modify: `prompts/tests/helpers/load-mock-data.ts`
- Delete: `prompts/pkg/system-prompt-brainstorm.md`
- Delete: `prompts/tests/brainstorm-prompt.test.ts`

- [ ] **Step 1: In `prompts/pkg/prompts.ts`, delete the `makeBrainstormSystemPrompt` function and its two interfaces (`MakeBrainstormSystemPromptOptions`, `BrainstormSystemPromptResult`).**

Find the block beginning with:

```ts
export interface MakeBrainstormSystemPromptOptions {
```

and ending after the `makeBrainstormSystemPrompt` function's closing brace and its `}` returning `{ systemPrompt, model }`. Delete everything between (and including) the interface declaration and the function's closing brace.

- [ ] **Step 2: In `prompts/pkg/index.ts`, drop the `makeBrainstormSystemPrompt` re-export.**

Find:

```ts
export { makeBrainstormSystemPrompt } from "./prompts.js";
```

Delete that line.

- [ ] **Step 3: In `prompts/tests/helpers/load-mock-data.ts`, drop the brainstorm asset branch and its `?raw` import.**

Remove the import line (top of file):

```ts
import brainstormPromptTemplate from "../../pkg/system-prompt-brainstorm.md?raw";
```

Remove the conditional branch (placed before the `system-prompt.md` branch by PR #1642 Task 3):

```ts
    if (url.includes("system-prompt-brainstorm.md")) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(brainstormPromptTemplate),
      } as Response);
    }
```

- [ ] **Step 4: Delete the brainstorm system-prompt asset.**

```bash
rm /Users/marcusestes/Websites/vibes.diy-chat-button/prompts/pkg/system-prompt-brainstorm.md
```

- [ ] **Step 5: Delete the brainstorm unit-test file.**

```bash
rm /Users/marcusestes/Websites/vibes.diy-chat-button/prompts/tests/brainstorm-prompt.test.ts
```

- [ ] **Step 6: Run the prompts tests to confirm nothing else broke.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/prompts/tests && pnpm test -- --run 2>&1 | tail -10
```

Expected: pass. The Task 1 + Task 2 substring tests should still be present and passing; nothing in this task touches the system-prompt assets or `makeBaseSystemPrompt`.

- [ ] **Step 7: Build the prompts and api packages to surface any leftover references.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/prompts/pkg && pnpm tsc --noEmit
cd /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/api && pnpm tsc --noEmit
```

Expected: both clean.

- [ ] **Step 8: Commit.**

```bash
git -C /Users/marcusestes/Websites/vibes.diy-chat-button add \
  prompts/pkg/prompts.ts \
  prompts/pkg/index.ts \
  prompts/tests/helpers/load-mock-data.ts
git -C /Users/marcusestes/Websites/vibes.diy-chat-button add -u \
  prompts/pkg/system-prompt-brainstorm.md \
  prompts/tests/brainstorm-prompt.test.ts
git -C /Users/marcusestes/Websites/vibes.diy-chat-button commit -m "feat(prompts): drop brainstorm system prompt, builder, and unit test"
```

---

## Task 9: Remove the brainstorm API integration test and workspace dep

**Files:**
- Modify: `vibes.diy/api/tests/package.json`
- Modify: `pnpm-lock.yaml`
- Delete: `vibes.diy/api/tests/brainstorm-mode.test.ts`

- [ ] **Step 1: Delete the brainstorm integration test.**

```bash
rm /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/api/tests/brainstorm-mode.test.ts
```

- [ ] **Step 2: In `vibes.diy/api/tests/package.json`, drop the `@vibes.diy/prompts` dependency added by PR #1642 Task 16.**

Open the file. Find:

```json
    "@vibes.diy/prompts": "workspace:*",
```

Delete the line. The trailing comma on the line before may need adjustment depending on context — make sure the resulting JSON is still valid (the `dependencies` block should not end with a comma before its closing `}`).

- [ ] **Step 3: Regenerate the lock file.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button && pnpm install --reporter=default 2>&1 | tail -5
```

Expected: pnpm reports the dep as removed; `pnpm-lock.yaml` is updated. No new package installs.

- [ ] **Step 4: Build the api package.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/api && pnpm tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Run the api tests.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button/vibes.diy/api && pnpm test -- --run 2>&1 | tail -10
```

Expected: pass. (`brainstorm-mode.test.ts` is gone; nothing else changed in this package's test set.)

- [ ] **Step 6: Commit.**

```bash
git -C /Users/marcusestes/Websites/vibes.diy-chat-button add \
  vibes.diy/api/tests/package.json \
  pnpm-lock.yaml
git -C /Users/marcusestes/Websites/vibes.diy-chat-button add -u \
  vibes.diy/api/tests/brainstorm-mode.test.ts
git -C /Users/marcusestes/Websites/vibes.diy-chat-button commit -m "test(api): drop brainstorm-mode integration test and workspace dep"
```

---

## Task 10: Final repo check + manual smoke

**Files:** none (validation + verification only).

- [ ] **Step 1: Run the full repo check.**

```bash
cd /Users/marcusestes/Websites/vibes.diy-chat-button && pnpm check 2>&1 | tail -30
```

Expected outcomes per stage:
- `pnpm build` — green.
- `pnpm lint` — same pre-existing 1 error + 1 warning in `vibes.diy/base/hooks/img-gen/use-img-gen.ts` and `vibes.diy/vibe/runtime/firefly-database.ts`. Both untouched by this branch (they're on `origin/main`). NOT blockers.
- `pnpm test` — 1115/1116 pass (one fewer than PR #1642 because the brainstorm integration test is gone). Known flaky test acceptable on first run; rerun once if it appears.

If anything else fails, investigate the specific failure before continuing.

- [ ] **Step 2: Push the branch.**

```bash
git -C /Users/marcusestes/Websites/vibes.diy-chat-button push 2>&1 | tail -5
```

This triggers the PR #1642 preview workflow to redeploy.

- [ ] **Step 3: Wait for the preview workflow to complete.**

```bash
gh run list --branch feat/chat-button-improvement-interview --workflow "Deploy vibes.diy PR Preview" --limit 1
```

Re-run the command until status is `completed` and conclusion is `success`. Or use `gh run watch <id>` with the most recent run id.

- [ ] **Step 4: Manual smoke at the preview URL.**

Open `https://pr-1642-vibes-diy-v2.jchris.workers.dev/` in a fresh chat. Walk through:

  1. Type an initial prompt like "todo list app" and click **Code**. The Chat button should be gone — only one button.
  2. Code streams in. After streaming ends, the assistant message should contain a trailing `▸ ` improvement question with 2–4 options, last option `▸ I'm done for now`.
  3. Click an option that's not the escape hatch. The option text appears as the next user message; the next assistant turn streams in with edits + a fresh `▸ ` question.
  4. Click `▸ I'm done for now`. The next assistant turn should be a one-line acknowledgment with no edits and no `▸ ` question.
  5. Type a fresh prompt (e.g., "make the empty state nicer") and click **Code**. The loop resumes — edits land + a new `▸ ` question appears.
  6. Reload the page. Interview history renders with disabled buttons; the most recent assistant message's options remain interactive.

If any step misbehaves (e.g., model doesn't emit the trailing question, or doesn't honor the "I'm done for now" pause), the system prompt tail in Task 2 needs tuning — file a follow-up rather than blocking this PR.

- [ ] **Step 5: No new commit needed unless tuning is required.**

```bash
git -C /Users/marcusestes/Websites/vibes.diy-chat-button status
```

Expected: clean working tree.

---

## Self-Review Notes

**Spec coverage:**
- §1 New tail on system-prompt templates → Tasks 1–2.
- §2 Frontend collapse to single button → Task 3 (auto-handoff effect removal) + Task 4 (dual-button revert).
- §3 Backend cleanup → Tasks 5–9.
- §4 Interaction model → exercised in Task 10's smoke checklist.
- §5 Edge cases → covered by manual smoke (model forgetting question, escape-hatch pause, reload).
- §6 Testing → Tasks 1–2 add tail-presence assertions; Task 10 step 4 covers manual smoke.

**Type consistency:**
- `onSubmit: (prompt: string) => void` is consistent across `ChatInput.tsx` (Step 1 of Task 4) and the test assertions in `ChatInput.test.tsx` (Step 5).
- `sendPrompt` returns to `string | null` and every call site (URL prefill in Step 9, ChatInput wiring in Step 10, `handleSelectOption` in Step 11) passes a string or null — consistent.
- `LLMChat.prompt(req, opts?: { inputImageBase64? })` reverts symmetrically in interface (Task 5 Step 1) and impl (Task 5 Step 2).

**Placeholder scan:**
- No TBD/TODO. The "Open questions for the implementation plan" section in the spec was about tuning (tail length, first-turn vs continuation differences, category ordering). Those are deliberately not in the plan because they're tuning decisions the implementer or QA can iterate on after Task 10's smoke.
- Every step has either an explicit code edit, an explicit shell command, or a binary verification.

**Deviation flagged:**
- The plan ships a single tail file content (Task 2) for both `system-prompt.md` and `system-prompt-initial.md`. The spec acknowledged a possible first-turn-specific tweak as an open question; if QA finds a need, it's a small follow-up edit to one file.
