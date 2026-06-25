# iter-4 predict-gate — GO (tight margin expected)

**Change:** `system-prompt-initial.md` lines ~82/84 — disambiguate
`board/canvas/room/whiteboard` people **join to co-edit one shared surface** → **per-object**, vs a
`wall/guestbook/map` where each visitor adds their **own** items → author-owned. Adds "people can
join" + the shared-surface examples to the per-object trigger list.

**Hypothesis:** `board` (per-object) fails 70% because line 82 blanket-classified "a shared board" as
author-owned, so the model builds the whiteboard as an open author-owned board instead of a joinable
shared object. Routing join-to-co-edit → per-object should lift `board` toward `shop`'s 97%.

## 5-lens deliberation

1. **Architect (conf 80):** the conflict is precisely located (line 82 "board" vs line 84 "join") and
   the edit resolves it without touching the per-object recipe (already complete at line 84). Fixes the
   shape-_selection_ driver of the dominant failure.
2. **Devil's advocate / regression (conf 60):** risk of pulling author-owned apps into per-object.
   Mitigated — line 82 still routes "wall/guestbook/map where each adds their own" → author-owned, and
   the per-object cue is scoped to "co-edit one shared surface, members change _each other's_ items."
   `photo` ("wall ... comment on posts") and `guest` ("guestbook") stay author-owned. **Watch their
   sub-rates.**
3. **Reliability / holdout (conf 65):** generalizes (sharpens the per-object classifier, not eval-
   overfit). Caveat: this fixes shape _selection_; the ~1/28 board cells that already pick per-object
   but miss an invariant (objectChannel/selfGrant/share/requireAccess/authorImmutable) need recipe
   _completeness_ — a separate lever (candidate iter-5) if board still lags.
4. **Signal/noise (conf 60):** board ≈ 8/64 cells; lifting 12/40→~34/40 ≈ **+0.07 eval**. Baseline is
   now 0.7875, so keep needs ≥ **0.8475** — the win lands right at the band edge. **Run 3 eval batches,
   add a 4th to confirm if the mean is within ~0.02 of the bar.**
5. **Correctness (conf 75):** prompt wording only; the runtime + frozen grader are unchanged.

**Verdict: GO.** Watch `photo`/`guest` for author-owned→per-object over-application; expect a tighter
margin than iter-3 (single-prompt lever vs the cross-cutting enrichment fix).
