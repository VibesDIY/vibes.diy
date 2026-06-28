# Codegen-log doc drift — the one the first sweep missed

Source: #2765 (follow-up to df1c7b0, which split the `chats` references in the
vibe-data/vibe-code skills into `app-chats` + `codegen-log`).

Hook: a "find-and-replace the removed command" sweep can pass its own review and
still leave a live instance behind — because the stale token hides in prose, not
in a fenced command block where you'd grep for it.

The first fix rewrote every `npx vibes-diy chats ...` code fence, the
quick-reference table, and the "why did the app ship this way?" walkthrough. It
missed one: the **Common mistakes** bullet in `vibe-code/SKILL.md`, which
mentioned `chats <vibe> <chatId> --response` inline in a sentence. An agent
copying that line would hit the warn-and-exit stub instead of the build
transcript.

Trade-off / gotcha: grepping for `npx vibes-diy chats` (the obvious pattern)
would not have caught it — the prose used the bare `chats` verb without the
`npx vibes-diy` prefix. The reliable sweep is to grep for the bare command verb
(`chats`) across the whole doc and eyeball every hit, not just the fenced
invocations. Removed-command references survive in narrative text precisely
because they don't look like commands.
