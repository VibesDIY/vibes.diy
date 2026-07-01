# Queue-ahead: the stop button yields to your next message

**Hook:** Mid-generation, the composer used to hold your text hostage — now it
queues like the chat apps everyone already knows.

**Source:** `vibes.diy/base/components/UnifiedVibeCard.tsx` — `OtherRow`, the
`/vibe` switch card's composer.

**Why:** While an in-place edit streamed, submit was a silent no-op: the text
just sat there until the turn ended, and Stop hogged the action slot. Now the
slot follows the input: empty → Stop, any text → a send button that QUEUES the
message (the turn keeps running). Queue as many as you like; when the turn
ends they batch into ONE prompt (joined with blank lines) and auto-send. That
matches how one codegen turn wants its instructions — as a single combined
change request, not three rapid-fire turns.

**Gotcha:** What should Stop do when messages are queued? Auto-flushing after
a cancel would make Stop a no-op (it would immediately start the queued turn).
We drain the queue back into the input instead: cancel means "give me control
back", so the queued text lands editable and unsent. And since Stop is only
reachable with an empty input, the drain can never clobber typed text.
