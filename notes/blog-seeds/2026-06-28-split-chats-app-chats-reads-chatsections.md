# Splitting a split-brain command — and where the runtime transcript actually lives

Source: #2751 (split `vibes-diy chats` into `codegen-log` + `app-chats`), review fixes for the app-chats deep-read + retired-`chats` stub

`vibes-diy chats` was split-brain: LIST read `ApplicationChats` (runtime in-app chats)
while the deep-read read `ChatContexts`/`ChatSections` (the codegen build transcript) —
two unrelated chat systems behind one command, routed by `mode` in `open-chat.ts`.
Found on a real vibe: `jchris/photo-chat` had a full codegen history but **zero**
`ApplicationChats` rows, so LIST printed "(no chats found)" while the deep-read
reconstructed the whole transcript. The fix splits it into two purpose-named commands
(`codegen-log`, `app-chats`), one table-family each — correctness by construction.

Worth a note:

- **The new `app-chats` deep-read first read the wrong column.** It pulled
  `ApplicationChats.blocks` — which `ensureApplicationChatId` initializes to `[]` and
  *nothing ever updates*. Runtime/img prompt streaming persists its events into
  `ChatSections` (keyed by the same `chatId`), not into that inline column. So the
  first cut would have rendered empty transcripts for every real chat. Both Codex and
  Charlie flagged it independently; a grep for any `.update(applicationChats…set(blocks`
  across the repo came back empty, confirming it.
- **The fix: gate on `ApplicationChats`, read from `ChatSections`.** The
  `ApplicationChats` row is the *ownership anchor* (it authorizes the read and supplies
  appSlug/ownerHandle); the *transcript* comes from `ChatSections` grouped by turn —
  the same grouping `get-chat-response` already uses for codegen, but driven through
  the app-chats ownership check instead of through `ChatContexts`. The flat
  `blocks[]` response shape and the CLI renderer stayed untouched.
- **A retired stub still has to parse its old flags.** The `chats` command was reduced
  to a warn-and-exit stub, but cmd-ts rejects undeclared flags *before* the handler
  runs — so `chats <vibe> <chatId> --response` died with "Unknown arguments" and the
  user never saw the migration message. The deprecation guidance is only useful if
  every legacy invocation reaches the handler, so the stub now declares the whole
  `--response/--raw/--files/--jsonl/--user/--turn` family (plus the shared defaults) as
  ignored no-ops. The lesson: a removed command's job is to *teach*, which means it
  must accept everything the old one did.
