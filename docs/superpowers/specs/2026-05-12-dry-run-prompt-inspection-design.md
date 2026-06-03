# Dry-run prompt inspection for edit/generate

Date: 2026-05-12
Status: Design approved, plan pending
Issue: VibesDIY/vibes.diy#1696

## Motivation

When debugging prompt assembly — skills, system prompt, conversation
reconstruction, the CURRENT FILES injection from #1690, and the upcoming
slot-based compaction in #1667 — there is no way to see exactly what the
server would send to the LLM without making a real LLM call. Today the
options are:

- Re-implement reconstruction logic client-side (drift risk: a divergence
  between client and server is exactly what we cannot afford when reasoning
  about prompt quality), or
- Add ad-hoc payload logging server-side and dig through traces.

Both are unsatisfying. This design adds a first-class
"what would you send right now?" surface, and is a precursor to #1667:
every later compaction change becomes measurable by anyone running a CLI
command against the same chat.

## High-level design

Two pieces:

1. **Server.** A new request/response Evento handler
   `inspectPromptChatSection` that runs the existing assembly path
   (skills + system prompt + reconstructed conversation + CURRENT FILES on
   continuations) and returns `{ model, messages }`. Zero side effects: no
   LLM call, no `PromptContexts` row, no `ChatSections` append, no
   streamId mint, no billing.
2. **CLI.** A new `vibes-diy inspect <appSlug> --prompt "<text>"`
   subcommand that resolves a chat the same way `vibes-diy edit` does,
   calls the new handler, and prints the payload — JSON by default,
   `--text` for a human-readable transcript.

## Transport choice

The issue presents WS-flag (a) vs dedicated HTTP route (b) and recommends
(b). This codebase has no HTTP-style public routes for this domain —
`vibes.diy/api/svc/public/` is all Evento handlers wired into
`vibesMsgEvento`. The closest fit for "dedicated route, no streaming, no
branching on every side-effecting site" is a **dedicated request/response
Evento handler**: a sibling of `promptChatSection` with its own type
discriminator, its own validate/handle pair, and a single emitted block
carrying the payload.

This preserves the spirit of the issue's recommendation (no `dryRun`
branches threaded through `appendBlockEvent`, `dispatchLlm`, recovery,
billing, etc.) while staying within the existing transport. Auth and chat
ownership checks mirror `promptChatSection` exactly.

## Refactor: split assembly from dispatch

The current `prompt-chat-section.ts` couples assembly (build
`{ model, messages }`) with dispatch (write `PromptContexts`, append
`ChatSections`, call the LLM, emit blocks). To support dry-run without
duplicating logic, extract:

- `assemblePromptPayload(vctx, { chatId, model, newUserMessages }): Result<{ model, messages }>`
  — pure (only reads). Wraps the existing `injectSystemPrompt` body.
  Takes the _next_ user turn as an explicit argument and appends it to
  the reconstructed conversation, instead of relying on a just-written
  `prompt.req` block to feed `reconstructConversationMessages`.

The current dispatch path writes the `prompt.req` block, then calls
`injectSystemPrompt`, which reads sections back and picks up the
just-written block. After the refactor the dispatch path will:

1. Call `assemblePromptPayload` with `newUserMessages = req.prompt.messages`.
2. Write the `prompt.req` block (still required so the next turn's
   reconstruction sees the prior user prompt).
3. Continue with LLM dispatch.

The dispatch order changes (assemble before append, instead of append
before assemble), but the final `{ model, messages }` for the LLM call is
identical, because the new user turn is appended explicitly either way.
Existing tests lock this in.

`assemblePromptPayload` is exported. The dry-run handler imports it
directly; the dispatch handler does the same.

## Server: `inspectPromptChatSection` handler

Location: `vibes.diy/api/svc/public/inspect-prompt-chat-section.ts`.

Request shape (`vibes.diy/api/types/chat.ts`):

```ts
reqInspectPromptChatSection = type({
  type: "'vibes.diy.req-inspect-prompt-chat-section'",
  auth: dashAuthType,
  chatId: "string",
  mode: "'chat'", // chat only for now; app/img dry-run is out of scope
  prompt: LLMRequest, // the next user turn, same shape as ReqCreationPromptChatSection.prompt
});
```

Response shape:

```ts
resInspectPromptChatSection = type({
  type: "'vibes.diy.res-inspect-prompt-chat-section'",
  chatId: "string",
  model: "string",
  messages: ChatMessage.array(),
});
```

Handler flow:

1. `checkAuth` — same verified-auth scope as `promptChatSection`.
2. `getResChatFromMode` (or equivalent: select `chatContexts` by
   `userId + chatId`). Return `not found` on miss with the same error
   shape `promptChatSection` returns.
3. Resolve model via `getModelDefaults` (mode = "chat"). Honor
   `req.prompt.model` override.
4. Call `assemblePromptPayload(vctx, { chatId, model, newUserMessages: req.prompt.messages.filter(m => m.role === "user") })`.
5. Emit `resInspectPromptChatSection` as a single block; close.

Wire into `vibesMsgEvento` next to `promptChatSection`.

## CLI: `vibes-diy inspect`

Location: `vibes-diy/cli/cmds/inspect-cmd.ts`.

Surface:

```
vibes-diy inspect <appSlug> --prompt "<next user turn>" [--text] [--user-slug <slug>]
```

Behavior:

- Resolve `userHandle` exactly like `edit-cmd.ts`.
- Open a chat via `api.openChat({ userHandle, appSlug, mode: "chat" })` —
  this resolves `chatId` without side effects on prompt assembly. (The
  `openChat` handler is the same one `edit` uses.)
- Send a `req-inspect-prompt-chat-section` message via the existing
  `chat.send` / api transport.
- Receive the single `res-inspect-prompt-chat-section` reply.
- Default output: `JSON.stringify({ model, messages }, null, 2)` to
  stdout.
- `--text` flag: render as a transcript with role headers
  (`=== SYSTEM ===`, `=== USER ===`, `=== ASSISTANT ===`) followed by
  message content. Content parts with `type: "text"` are concatenated;
  other content types are rendered as `[<type>]` placeholders (we are
  not pretty-printing images).
- Exit nonzero on any error (chat not found, auth failure, assembly
  error); pass the server error message through.

Tagged into the cmd-ts subcommand table in `vibes-diy/cli/main.ts`.

## Auth and ownership

Identical to `promptChatSection`. The handler performs the same
`checkAuth` and the same `chatContexts` join on `(userId, chatId)` that
the streaming endpoint does. A request for someone else's chat returns
the same not-found error.

## Zero-side-effect guarantee

The dry-run handler does only `SELECT`s. It never calls:

- `appendBlockEvent` / `appendChatSection`
- `storePromptContext`
- `dispatchLlm` / any LLM provider
- token billing / accounting
- streamId mint

A regression test asserts: row counts in `PromptContexts` and
`ChatSections` are unchanged before vs after a dry-run call.

## Testing

- **Unit**: `assemblePromptPayload` returns the expected shape against a
  seeded chat (system prompt present, reconstructed user/assistant turns,
  CURRENT FILES block on continuation, no CURRENT FILES on initial).
- **Unit**: dry-run handler emits the same payload `assemblePromptPayload`
  produced and writes nothing (row count assertion).
- **Unit**: dry-run on a chat not owned by the caller returns the same
  not-found error as `promptChatSection`.
- **Unit**: dispatch path still produces an identical payload after the
  refactor (lock in via fixture-based assertion against an existing chat
  fixture).
- **CLI unit**: `inspect-cmd` JSON output matches the server reply
  verbatim; `--text` output preserves message order and role tags.
- **Smoke (manual)**: CLI end-to-end against `pnpm dev` resolves a known
  chat and prints a valid payload.

## Out of scope

- Slot-based compaction (`[original, selected?, previous]`) — #1667.
- `selected` wire shape (UI version pick / CLI disk-drift via `.undo`) — #1667.
- Conversation trim / fence-body summaries — #1667.
- Recovery-shape dry-run — only the first-attempt payload is exposed.
- Streaming dry-run that emits intermediate states.
- App-mode / image-mode dry-run.

## Files touched

- `vibes.diy/api/types/chat.ts` — add `reqInspectPromptChatSection` and
  `resInspectPromptChatSection` + type guards.
- `vibes.diy/api/types/index.ts` — re-export.
- `vibes.diy/api/svc/public/prompt-chat-section.ts` — extract and export
  `assemblePromptPayload`; rework dispatch to call it with explicit new
  user messages and move the `prompt.req` `appendBlockEvent` to after
  assembly.
- `vibes.diy/api/svc/public/inspect-prompt-chat-section.ts` — new handler.
- `vibes.diy/api/svc/vibes-msg-evento.ts` — register the new handler.
- `vibes.diy/api/tests/` — new tests for assembly extraction, dry-run
  handler, and ownership.
- `vibes-diy/cli/cmds/inspect-cmd.ts` — new subcommand.
- `vibes-diy/cli/main.ts` — wire into subcommand table.
- (Possibly) `vibes.diy/api/impl/firefly-api-adapter.ts` or the chat
  helper to expose a typed `chat.inspect()` call if that's cleaner than
  sending the message directly. To be confirmed when writing the plan.
