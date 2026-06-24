# Eval #2588 corpus — newcomer-first + per-object access model

Generated vibes for the [#2588](https://github.com/VibesDIY/vibes.diy/issues/2588)
generation-QA playbook (successor to the `useVibe().can` gate eval, [#2525](https://github.com/VibesDIY/vibes.diy/issues/2525)).

One vibe per matrix row, generated with `vibes-diy@2.5.18 generate` against
`https://vibes.diy/api?.stable-entry.=cli` under the `eval` handle, with prompts
that **do not** mention access control. Each row dir holds the pulled
`App.jsx` + `access.js` + `README.md`. Regenerating this corpus is the regression
(the diff is the signal).

Grades and the roll-up live in
[`docs/superpowers/specs/eval-2588-access-model-results-2026-06-24.json`](../../../docs/superpowers/specs/eval-2588-access-model-results-2026-06-24.json).

| # | dir | prompt | grade |
|---|-----|--------|-------|
| 1 | `row1-todo` | A todo list app | PASS — per-user-private (`user:` channel) |
| 2 | `row2-habit` | A daily habit tracker | **FAIL** — Form-A (`requireRole("owner")` core write) |
| 3 | `row3-shop` | A shared shopping list I can invite my partner to | SOFT-FAIL — missed per-object (one global public list) |
| 4 | `row4-board` | A collaborative whiteboard people can join | **FAIL** — visitor locked out (owner-only membership, no join) |
| 5 | `row5-blog` | My personal blog | PASS — owner-published |
| 6 | `row6-guest` | A public guestbook anyone can sign | PASS — anonymous author-owned + public read |
| 7 | `row7-photo` | A photo wall where people comment on posts | PASS — author-owned comments, public read |
| 8 | `row8-team` | A team workspace with channels and roles | PASS — clunky-but-reachable administered workspace |

**Roll-up:** 5 PASS / 1 SOFT-FAIL / 2 FAIL · Form-A rate 25% strict (1/4) – 50% broad (2/4),
target 0% · `unknown` 0% · `isOwner` write-gates 0.

> Row 1's first server-assigned slug differs (`balloon-believed-single`) because the
> fixed-slug `eval-2588-todo` truncated on its first generate and same-slug retries
> re-fetched the incomplete vibe; a fresh-slug regenerate produced the complete app.
