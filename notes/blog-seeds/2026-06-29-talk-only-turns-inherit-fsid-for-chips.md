# When the chips exist but the deployed version can't see them

Source: `claude/bloom-suggestion-chips-u30bbn` (PR pending) — follow-up to #2755

`system/bloom` had no suggestion chips, and `db:inspect` told the whole story. The
vibe was created via the **CLI** (whose only versioned chat turn is the bare
`File: /App.jsx` narration — no `▸` interview tail, so zero chips), then got one
message through the old chat UI that produced three lovely `▸` suggestions
("Center & frame the grid", "Add axis labels", "Add a latch/hold toggle"). The
catch: that suggestions turn changed *no files*, so its `PromptContexts.fsId` was
`null`. And the chip projection (`getVibeChips` / `latestTurnChips`) deliberately
**pins chips to the `fsId` the viewer sees** — so the good chips, orphaned on a
null-fsId turn, never attached to the deployed version. Worse, the non-member arm
*hard-excludes* null-fsId turns to avoid leaking unpublished drafts, so anonymous
visitors were doubly locked out.

The fix is two small, composable moves. (1) A "talk-only" turn (fsId null)
**inherits the fsId of the nearest older turn** — the code version that was live
when it ran — so its chips belong to that deployed version instead of floating.
(2) `latestTurnChips` gains a fallback: when the pinned version's turn yields *no*
chips (the CLI-seed case), prefer the newest *other* turn that does.

The gotcha that keeps it safe: inheritance walks *backwards* in time, so a
talk-only turn that happened after the owner started an **unpublished draft**
inherits the *draft's* fsId, not the published one — and the non-member filter
(`fsId === app.fsId`) still drops it. A real draft keeps its own distinct fsId and
was never in scope. So "let suggestions-only turns count" surfaces commentary on
the *deployed* version without ever leaking a draft's intent. Both arms are
covered by tests: the bloom shape (CLI seed + talk turn → chips show) and its
adversarial twin (talk turn after a draft → stays hidden).
