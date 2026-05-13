# Chat Button — Improvement Interview Mode — Design

**Date:** 2026-05-09
**Scope:** `vibes.diy/pkg/app` (ChatInput, MessageList), `vibes.diy/api` (prompt-chat-section, types/chat), `prompts/pkg` (new system prompt asset + builder).
**Status:** Approved, ready for implementation plan.

## Problem

The chat input today has a single submit button labeled **Code** that sends the user's prompt to a code-generation pass — `makeBaseSystemPrompt` builds the full system prompt with all the skills (callai, fireproof, image-gen, web-audio), SEARCH/REPLACE rules, and code-gen scaffolding. There is no lightweight, conversational way for a user to *think out loud* about what to change in an existing app before committing to a code-gen pass. The user has to phrase the change themselves, often missing structure or context that would help the code pass land cleanly.

We want a second submit button — **Chat** — sitting next to **Code**. Clicking Chat runs an interview that gathers a structured improvement brief through short multiple-choice questions, then automatically hands that brief off to a code-gen pass. The interview LLM call uses a different, leaner system prompt with no skill catalog and no code-gen rules — its only job is to ask good questions and produce the brief.

## Goals

- Add a **Chat** submit button next to **Code** in the chat input.
- Run improvement-only interviews — Chat assumes the app exists and asks "what to change next" questions specific to the current app.
- Interview output renders as conversational markdown with `▸ ` lines parsed into clickable answer-option buttons styled to the existing chat UI.
- Auto-handoff: when the interview produces a `<vibes-brief>` block, fire a follow-up `mode: 'app'` code-gen request automatically — one chat thread, two distinct turns (interview, then build).
- Use a dedicated system prompt that does *not* load the skill catalog or the code-gen template.

## Non-goals

- Greenfield interviews. Chat is disabled when there is no code yet.
- Multi-turn brief refinement loops. The brief is produced once and the build fires; iteration happens after the user sees the result.
- Browser-side speech / voice input.
- New chat thread types or sidebar entries — brainstorm turns ride the existing chat thread alongside code turns.
- Recovery / SEARCH/REPLACE recovery handling for brainstorm output. Interview output is plain markdown; nothing to recover.

## Design

### 1. New mode: `'brainstorm'`

The existing `PromptStyle` union in `vibes.diy/api/types/chat.ts` is `'chat' | 'app' | 'img' | 'fs-update' | 'fs-set'`. `'chat'` is taken (creation flow). Add `'brainstorm'` to `PromptLLMStyle`:

```ts
export const PromptLLMStyle = type("'chat' | 'app' | 'img' | 'brainstorm'");
```

Add a request type mirroring `reqPromptApplicationChatSection`:

```ts
export const reqPromptBrainstormChatSection = type({
  type: "'vibes.diy.req-prompt-chat-section'",
  mode: "'brainstorm'",
  auth: dashAuthType,
  chatId: "string",
  outerTid: "string",
  prompt: LLMRequest,
});

export function isReqPromptBrainstormChatSection(obj: unknown): obj is typeof reqPromptBrainstormChatSection.infer {
  return !(reqPromptBrainstormChatSection(obj) instanceof type.errors);
}
```

Wire it into `reqPromptLLMChatSection` (the `.or()` chain) and `getResChatFromMode` so a brainstorm request resolves the same `applicationChats` row as `'app'` mode (same chat, same app context). The button label stays "Chat" in the UI; `'brainstorm'` is the wire value.

### 2. New system prompt: `system-prompt-brainstorm.md`

A new asset at `prompts/pkg/system-prompt-brainstorm.md`, loaded the same way `system-prompt.md` and `recovery-addendum.md` are loaded today (via `loadAsset` against the prompts package, resolved through the worker's `/vibe-pkg/` endpoint at runtime).

Content adapted from the user's `vibes-brainstorm` skill draft, with two structural changes:

**Translation Layer (Claude-only reasoning) — TinyBase replaced with Fireproof:**

- "Just me" — all persistent data in a single Fireproof database (`useFireproof("vibe-…")`), no user attribution needed; Fireproof sync handles cross-device access.
- "Shared with a group" — same Fireproof database for everyone in the group, with `createdBy: user?.email || 'anonymous'` on user-owned docs.
- "Real-time with others" — shared Fireproof database with `createdBy` on every doc; ephemeral interaction (drag position, cursor, hover) stays in `useState` and is never written to Fireproof.
- "Personal views" — every doc tagged `createdBy`, filtered on read via `useLiveQuery` keyed on the current user.
- "Same view for everyone" — no filtering; `useLiveQuery` returns all docs to all clients.

**Categories adapted for improvement-only:**

- Drop "Who uses this?" and "What do others see?" (already settled by the existing app).
- Add an opener: *"What part needs to feel better?"* — answer choices invented per app from the current App.jsx context.
- Reframe "How big is this?" as *"Scope of this change"* with options ranging from quick polish through new feature to bigger rework.
- Keep the *Main interaction*, *What are you tracking?*, *What gets saved?*, *Special features*, and *What's the vibe?* categories — re-pose them as "should this change?" rather than "what is this?".
- Every question after the first ends with the escape hatch: `▸ That's enough — let's build it!`.

**Brief shape (change-request, not from-scratch):**

```
<vibes-brief>
Change: [what's being added/changed/removed]
Affects: [which existing parts of the app are touched]
Scope: [polish / new feature / bigger rework]
Vibe shift: [if the personality is changing — otherwise "no change"]
Saves: [any new persistent fields]
Sharing: [any change to who sees what — otherwise "no change"]
Notes: [anything else the build pass needs to know]
</vibes-brief>
```

The closing `</vibes-brief>` tag is the trigger the frontend watches for. The skill's "Building..." sentence stays; it is informational only — the actual build is fired by the frontend.

**Template placeholders:**

```
{{TITLE_SECTION}}
{{THEME_DESIGN}}
{{CURRENT_VFS}}
```

— substituted at request-build time so the LLM's questions reference the actual app. `{{CURRENT_VFS}}` expands to every file in the current persisted VFS, not just `App.jsx`. Multi-file apps need the supporting files in context for the interview to ask sharp questions about them.

### 3. New builder: `makeBrainstormSystemPrompt`

In `prompts/pkg/prompts.ts`, add:

```ts
export interface MakeBrainstormSystemPromptOptions {
  fetch?: typeof fetch;
  pkgBaseUrl?: string;
}

export interface BrainstormSystemPromptResult {
  systemPrompt: string;
  model: string;
}

export async function makeBrainstormSystemPrompt(
  model: string,
  sessionDoc: {
    title?: string;
    theme?: string;
    /** Filename → file content for every file in the current persisted VFS. */
    currentVfs?: ReadonlyMap<string, string>;
  } & MakeBrainstormSystemPromptOptions
): Promise<BrainstormSystemPromptResult>;
```

Loads `system-prompt-brainstorm.md` via the same `loadAsset` keyed cache used for `system-prompt.md`. Substitutes `{{TITLE_SECTION}}`, `{{THEME_DESIGN}}`, and `{{CURRENT_VFS}}`. **Does not** load the skill catalog, generate import statements, fetch llms/*.md files, or interpolate `{{IMPORT_STATEMENTS}}` / `{{CONCATENATED_LLMS}}` / `{{DEMO_DATA}}` — those concepts don't exist in interview output.

`{{CURRENT_VFS}}` expands to a single block wrapping one entry per file. Format:

```
<current-vfs>
<file path="App.jsx">
…file contents…
</file>
<file path="helpers.js">
…file contents…
</file>
</current-vfs>
```

Files are emitted in stable order (sorted by path). If the VFS is empty (shouldn't happen given the disabled-when-no-code rule, but defensive), the wrapper collapses to empty.

Export it from `prompts/pkg/index.ts` alongside `makeBaseSystemPrompt`.

### 4. Backend wiring: `prompt-chat-section.ts`

`buildUserMessages` (or the equivalent system-prompt selection point at [prompt-chat-section.ts:709](vibes.diy/api/svc/public/prompt-chat-section.ts:709)) currently always calls `makeBaseSystemPrompt`. Branch on the mode of the resolved chat:

```ts
const systemPrompt = await exception2Result(async () => {
  if (resChat.mode === "brainstorm") {
    return makeBrainstormSystemPrompt(await resolveEffectiveModel({ model }, {}), {
      title,
      theme,
      currentVfs: await loadPriorFileSystem(vctx, chatId),
      pkgBaseUrl: promptsPkgBaseUrl(vctx.params.pkgRepos.workspace),
      fetch: createPromptAssetFetch({ fetchAsset: vctx.fetchAsset }),
    });
  }
  return makeBaseSystemPrompt(/* … existing call … */);
});
```

The brainstorm path reuses the existing `loadPriorFileSystem` ([prompt-chat-section.ts:152](vibes.diy/api/svc/public/prompt-chat-section.ts:152)), which already returns `ReadonlyMap<string, string>` — every code-block file in the latest persisted VFS. No new loader needed. If the VFS is empty, the map is empty and the wrapper collapses (defensive — the frontend should have disabled the Chat button).

Recovery (the addendum branch around [prompt-chat-section.ts:1563](vibes.diy/api/svc/public/prompt-chat-section.ts:1563)) is skipped for brainstorm mode — interview output has no SEARCH/REPLACE blocks to fail. If a brainstorm stream errors, surface the error normally; the frontend treats it like any other prompt error.

`getResChatFromMode` extends the `isReqPromptApplicationChatSection || isReqPromptImageChatSection` branch to include `isReqPromptBrainstormChatSection` so the brainstorm request resolves the `applicationChats` row.

### 5. Frontend: ChatInput dual-button

Modify [ChatInput.tsx](vibes.diy/pkg/app/components/ChatInput.tsx):

- `onSubmit` prop becomes `onSubmit: (prompt: string, mode: 'app' | 'brainstorm') => void`.
- Render two buttons in the bottom row, in order: **Chat** (left), **Code** (right). Same height, same border treatment, same loading-border animation when `promptProcessing`.
- **Chat button** is `disabled={!hasCode || promptProcessing}`. Tooltip on hover when disabled: *"Available once your app has code — start with Code first."*
- Both buttons fire `handleSendPrompt` with their respective mode. `handleSendPrompt` accepts a mode argument, calls `onSubmit(prompt, mode)`, and clears the textarea.
- The working-message text (`getWorkingMessage`) stays Code-pass-specific. While brainstorm is processing, the Chat button shows a short label like *"Asking…"* (and is disabled); the Code button is also disabled to prevent double-submits.

Update [chat.$userSlug.$appSlug.tsx:257](vibes.diy/pkg/app/routes/chat/chat.$userSlug.$appSlug.tsx:257):

```ts
type PendingPrompt = { text: string; mode: 'app' | 'brainstorm' };
const [promptToSend, sendPrompt] = useState<PendingPrompt | null>(null);
```

The firing effect at [chat.$userSlug.$appSlug.tsx:368](vibes.diy/pkg/app/routes/chat/chat.$userSlug.$appSlug.tsx:368) reads `promptToSend.mode` and routes to the right `chat.prompt(...)` call. The `vibeDiyApi` chat session wrapper needs a way to send with `mode: 'brainstorm'` — either an explicit `chat.brainstormPrompt(...)` method, or the existing `chat.prompt` extended to accept a mode argument. Implementation plan picks one; design treats them as interchangeable.

### 6. Frontend: clickable `▸ ` options in TopLevelMsg

Today [MessageList.tsx:146](vibes.diy/pkg/app/components/MessageList.tsx:146) renders assistant narration with `<ReactMarkdown>{lines.map((i) => i.line).join("\n")}</ReactMarkdown>`. Add a small parser that runs *before* the markdown render: split the joined text into a `prose` chunk and an `options` array.

**Parsing rules:**

- A line whose first non-whitespace character is `▸` (with or without trailing space) is an option line.
- Consecutive option lines form one options group. The text after `▸ ` (trimmed) is both the button label and the value submitted on click.
- Any non-option line preserves the existing markdown behavior.
- A trailing options group at the end of the message becomes a button stack rendered below the prose, inside the same `BrutalistCard` bubble. Options groups in the middle of a message stay in-place (rare; defensive).

**Rendering:**

- Each option becomes a `<button>` with full-width layout, stacked vertically with small gap, styled to match the existing chat UI accent palette — light/dark-aware, soft hover, rounded corners. Reference style: a more substantial version of [QuickSuggestions.tsx:26](vibes.diy/pkg/app/components/QuickSuggestions.tsx:26) — full-width inside the bubble, left-aligned text, slightly more padding.
- Buttons are interactive only on the **most recent** assistant `TopLevelMsg`. Determined by position in the rendered message list — the parser receives the message's index alongside the total count and renders interactive buttons only when it is the last assistant message and the chat is not currently `promptProcessing`. Older messages render the same button shapes but `disabled` (visual history, not actionable). No extra state required.
- Clicking an option calls a new prop, `onSelectOption(text)`, which `ChatInterface` plumbs from the route. The route's `onSelectOption` calls `sendPrompt({ text, mode: 'brainstorm' })` directly — no textarea round-trip.
- Streaming: the parser runs on each render. While a `▸ ` line is partially streamed (e.g., the line ends mid-word with no following newline), it renders as plain prose; once the line terminates (newline or end-of-message), it switches to a button on the next render. This is acceptable because the chat already re-renders rapidly during streaming.

**Styling note:** the existing `BrutalistCard` uses `messageType="ai"` for assistant messages. The option buttons sit *inside* that card, so they don't need their own card chrome — just a subtle border/background that reads as "clickable" against the card's background. Final palette tuning happens during implementation; the design constraint is "consistent with the current chat UX, distinct as clickable."

### 7. Frontend: auto-handoff on `<vibes-brief>`

When a brainstorm turn ends (`block.end` arrives for a brainstorm assistant message), the route component scans the just-completed assistant message text for a `<vibes-brief>([\s\S]*?)</vibes-brief>` match. The scan happens once per turn-end, not continuously.

If matched and non-empty:

1. Trigger `sendPrompt({ text: "Build this change:\n\n" + briefContents, mode: 'app' })`.
2. The existing firing effect picks it up and dispatches the code-gen call exactly as if the user had typed it and clicked **Code**.
3. The brief stays in the chat history as an assistant message; the new code-gen turn appears below it. The user sees: their last interview reply → assistant brief message → code starting to stream.

If unmatched or malformed (no closing tag, empty body): no auto-handoff. The interview turn ends; the user can click **Code** manually with a typed phrasing, or click an option in a follow-up question if the LLM kept the conversation going.

The detection is **frontend-only** — the backend doesn't know about the brief. This keeps the chain debuggable: two distinct prompt-chat-section requests with their own sectionId, recovery state, and persistence path.

### 8. Persistence

Brainstorm turns ride the same `chatSections` table the existing turns do. No schema changes. On reload:

- Past brainstorm assistant messages are rendered through the same `TopLevelMsg` component; the `▸ ` parser re-runs on the persisted text and re-renders the buttons (disabled, since they're not the most recent message).
- The `<vibes-brief>` scan does not re-fire on reload (it only runs on live turn-end). The historical handoff was already persisted as a separate code-gen turn.

### 9. Edge cases

- **User types and clicks Code while in brainstorm mode:** mode-on-button-click decides; the typed text submits with `mode: 'app'`. Manual escape hatch.
- **User types a custom answer and clicks Chat:** typed text submits with `mode: 'brainstorm'` — exactly like clicking an option, but with custom phrasing. Skill content already supports this.
- **Cancellation mid-interview:** existing chat cancellation aborts the in-flight prompt. No special brainstorm-mode handling.
- **Cancellation mid-handoff** (brief just landed, code-gen request firing): the new `sendPrompt` call goes through the existing pending-prompt pipeline and respects whatever cancel-on-new-prompt behavior is already in place.
- **`<vibes-brief>` appears with no preceding interview** (LLM short-circuits because the prompt is unambiguous): auto-handoff fires on the first turn — exactly the behavior the original skill describes.
- **Multiple `<vibes-brief>` blocks in one message:** take the first match; ignore the rest. Defensive only — the prompt instructs the LLM to emit one.
- **`▸ ` characters appearing in user-quoted strings inside an assistant message** (rare but possible if the LLM quotes a user reply): false-positive button. Acceptable; the LLM's own answer set is the dominant case and the prompt guides it to use `▸ ` for options only.

### 10. Testing

**Unit (prompts pkg):**
- `makeBrainstormSystemPrompt` substitutes `{{TITLE_SECTION}}`, `{{THEME_DESIGN}}`, and `{{CURRENT_VFS}}` correctly across cases: single-file VFS, multi-file VFS (sorted ordering), empty VFS, missing title, missing theme.
- The brainstorm system prompt does not contain skill catalog markers (`{{CONCATENATED_LLMS}}`, `{{IMPORT_STATEMENTS}}`).

**Unit (frontend):**
- The `▸ ` parser splits prose and options correctly: trailing group, mid-message group, no group, partial line during streaming.
- The `<vibes-brief>` extraction handles well-formed, malformed (no closing tag), empty body, and multiple-blocks cases.

**Component (frontend):**
- ChatInput renders both buttons; Chat is disabled when `!hasCode`; Code is disabled when `promptProcessing`. Click on each fires `onSubmit` with the correct mode.
- A `TopLevelMsg` containing `▸ ` lines renders prose + buttons. Click on a button fires `onSelectOption` with the option's text. Buttons in non-most-recent messages render as disabled.

**API (vibes.diy/api/tests):**
- A `mode: 'brainstorm'` request through `prompt-chat-section.ts` selects the brainstorm system prompt (mock the LLM, assert the system message content matches the brainstorm template — not the code-gen one, no llms/ content, no `{{IMPORT_STATEMENTS}}` artifacts).
- The brainstorm request resolves the same `applicationChats` row as `mode: 'app'` for the same chat.

**Integration (existing harness):**
- Click Chat → interview turn streams with `▸ ` lines → click an option → next turn streams → brief lands → code-gen turn auto-fires using the brief → preview updates.
- Reload after a completed brainstorm + build: history shows interview messages with disabled buttons, the brief, and the build turn — all intact.

## Open questions for the implementation plan

- Exact button label and disabled-state styling — pin during implementation.
- Whether to add a `chat.brainstormPrompt(...)` method on the chat session API or extend `chat.prompt` to accept a mode argument. Either works; pick the one that fits the existing API surface most cleanly.
- Whether to truncate the VFS for very large apps. Today a Vibe is typically a single `App.jsx` of a few hundred lines, but a multi-file VFS could grow. If the total content exceeds a token budget, the implementation can truncate per-file (head + tail) or omit non-`App.jsx` files first. Defer to implementation; the design assumes the whole VFS fits.
