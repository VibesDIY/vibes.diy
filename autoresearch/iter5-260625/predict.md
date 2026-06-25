# iter-5 predict-gate — GO (enrichment lever, tight margin)

**Change:** `prompts/pkg/prompts.ts` — broaden the enrichment's per-object clause (platform paragraph +
Sentence-3) to route "a **board or canvas a group co-edits**, people join or are invited into" →
per-object membership, with the distinguisher "anyone in it free to change **any of it, not just their
own additions**" (vs author-owned, where each owns their own). `system-prompt-initial.md` reverted to
iter-3 base (iter-4's downstream classifier edit was DISCARDED).

**Why the enrichment, not the classifier:** iter-4 edited the downstream `system-prompt-initial.md`
classifier and board did **not** move — the iter-4 diagnostic showed **19/21 failing board cells still
built author-owned shape** (no object channel). The upstream `enrichedPrompt` product description
(which iter-3 proved is the dominant layer) still frames a whiteboard as "everyone adds their own," and
that propagates to codegen regardless of the classifier. So the enrichment is the lever.

## 5-lens

1. **Architect (80):** diagnostic directly implicates the enrichment; it's the proven high-leverage
   layer (iter-3). The "change any of it, not just their own additions" cue is the precise per-object
   vs author-owned distinguisher.
2. **Devil's advocate / regression (60):** risk of pulling `photo` (wall, comment on posts) or `guest`
   (guestbook) into per-object. The "not just their own additions" scoping should hold them as
   author-owned (each owns their own post). **Watch photo/guest sub-rates.**
3. **Reliability / holdout (65):** global enrichment change → should lift holdout per-object (h-trip)
   too; scoped to "a shared thing people join," so per-visitor (todo/journal) shouldn't be dragged in.
   **Watch holdout.**
4. **Signal/noise (50):** board ≈ 8/64 cells; even a full board fix ≈ +0.05–0.07 eval — right at the
   0.8475 keep bar (baseline 0.7875). **Caveat:** fixing board's _shape_ selection may only convert
   "author-owned fail" → "per-object-but-incomplete fail" (recipe completeness is a separate lever).
   Run 3 batches; if board goes per-object-but-incomplete, **iter-6 = recipe completeness**.
5. **Correctness (75):** prompt wording only.

**Verdict: GO.** Tight margin; the real test is whether board's _shape_ flips to per-object — even a
partial flip (without full pass) tells us the enrichment is the right lever and sets up iter-6.
