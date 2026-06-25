# iter-3 results — KEPT (access-shape-neutral enrichment)

Change: `prompts/pkg/prompts.ts` — `PRE_ALLOC_PLATFORM_PARAGRAPH` + Sentence-3 of the `enrichedPrompt`
pre-allocation, replacing the owner-published-by-default assertion with a 3-way shape-aware framing
(author-owned / per-object / owner-published). Tested commit `7f16aec` against the PR-2631 preview.

## Eval (5 batches × 64 apps) + holdout (2 batches × 64)

| batch    | eval.metric                                     | twoFile | renderable | formAStrict |
| -------- | ----------------------------------------------- | ------- | ---------- | ----------- |
| b1       | 0.7969                                          | 1.0     | 1.0        | 0.0156      |
| b2       | 0.8125                                          | 1.0     | 1.0        | 0.0000      |
| b3       | 0.7344                                          | 1.0     | 1.0        | 0.0156      |
| b4       | 0.8281                                          | 1.0     | 1.0        | 0.0156      |
| b5       | 0.7656                                          | 1.0     | 1.0        | 0.0625      |
| **mean** | **0.7875** (sd 0.038, sem 0.017, 95% CI ±0.033) | 1.0     | 1.0        | 0.0219      |

holdout: 0.7188 / 0.6875 → mean **0.7031**

## Verdict

KEEP. eval Δ = **+0.225** vs baseline 0.5625 (keep needs ≥ +0.06); gates (two-file/renderable/holdout)
PASS; Form-A strict 34.4% → 2.2%; holdout +0.305 (generalizes). `baseline.json` re-based to these values.

## Per-dimension (summed over 5 eval batches)

| prompt (dimension)                                        | pass | soft | fail | /40 | note                                                 |
| --------------------------------------------------------- | ---- | ---- | ---- | --- | ---------------------------------------------------- |
| board — collaborative whiteboard people join (per-object) | 12   | 0    | 28   | 40  | incomplete per-object recipe (built as author-owned) |
| todo (per-visitor)                                        | 22   | 0    | 18   | 40  | incomplete per-visitor model                         |
| guest — guestbook (author-owned)                          | 28   | 0    | 12   | 40  | mixed                                                |
| team (multi-tier)                                         | 35   | 0    | 5    | 40  | minor                                                |
| habit (per-visitor)                                       | 38   | 0    | 2    | 40  | clean                                                |
| photo (author-owned)                                      | 38   | 0    | 2    | 40  | clean                                                |
| shop — invite my partner (per-object)                     | 39   | 0    | 1    | 40  | clean (contrast w/ board)                            |
| blog (owner-published)                                    | 40   | 0    | 0    | 40  | clean (no over-correction)                           |

Next target (iter-4): `board` per-object misclassification — `system-prompt-initial.md` calls "a shared
board" author-owned, colliding with "people can join" → per-object. Disambiguate join-to-co-edit vs
each-posts-their-own.
