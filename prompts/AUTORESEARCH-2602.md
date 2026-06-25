# Autoresearch run log — #2602 access-model codegen eval

## Iteration ledger

Frozen baseline — **calibrated** (`baseline.json`, 2-batch mean of base-run1 + base-run2, preview
env, 128 apps @ concurrency 16 each): **eval = 0.5625** (Form-A strict 34.4%, two-file 100%,
renderable 100%), **holdout = 0.3984**. The kickoff single-batch draw (eval 0.594 / holdout 0.484)
is preserved in the rows below as "base"; its holdout was a high outlier — see the noise section
and #2637.

Keep rule (calibrated, #2637): keep only when the eval gain exceeds the measured **eval band ≈0.06**
with all gates green — two-file/renderable ≥ baseline − 0.05, holdout ≥ baseline − **0.17** (the
measured holdout jitter, now the `gates.ts` default `holdoutBand`) — then a confirmation batch.

| iter | edit                                                                                                                                                                                              | eval                             | Δeval             | holdout             | verdict                                                                                                                                                                                                                                                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| base | —                                                                                                                                                                                                 | 0.594                            | —                 | 0.484               | reference                                                                                                                                                                                                                                                                                                                                                                             |
| 1    | author-contributed content is author-owned, not owner-published (`system-prompt-initial.md`)                                                                                                      | 0.625                            | +0.031 (in noise) | 0.250               | **DISCARD** — gate 5 (holdout) fail; the blanket "don't owner-gate" framing overcorrected, collapsing holdout multi-tier (h-club 7/8→1/8) and per-object (h-trip 5/8→2/8) even though eval Form-A improved (34.4%→28.1%)                                                                                                                                                              |
| 2    | additive: curated-sounding feeds (photo wall) are author-owned for posts too (`system-prompt-initial.md`)                                                                                         | 0.578                            | −0.016 (in noise) | 0.297               | **DISCARD** — eval flat (within noise), holdout fails gate 5 again. A tiny additive edit producing nearly the same holdout drop as iter 1's blunt rewrite points to **holdout variance**, not real regression                                                                                                                                                                         |
| 3    | make the upstream `enrichedPrompt` pre-alloc access-shape-neutral (3-way: author-owned / per-object / owner-published) instead of asserting an owner-published default (`prompts/pkg/prompts.ts`) | **0.7875** ±0.033 (5-batch mean) | **+0.225**        | **0.703** (2-batch) | **KEEP** — huge, far beyond the 0.06 band; Form-A strict 34.4%→2.2%; gates green; generalizes to holdout (+0.305). Root cause was the _enrichment_ layer priming codegen to "only the owner can make changes" before generation. **baseline.json re-based to this.**                                                                                                                  |
| 4    | disambiguate "board/whiteboard people join to co-edit" → per-object vs "wall/guestbook each posts own" → author-owned, in the **downstream** `system-prompt-initial.md` classifier (~82/84)       | 0.7396 (3-batch)                 | −0.048 (in noise) | 0.672               | **DISCARD** — doesn't clear the band; board did not improve. Diagnostic: 19/21 failing board cells still built author-owned shape (no object channel) — the downstream classifier can't override the **upstream enrichment**, which still frames a whiteboard as "everyone adds their own." Reverted. `photo`/`guest` did not regress. Confirms the enrichment is the lever → iter-5. |

### iter-3 — KEPT (the breakthrough), and the deploy flake that preceded it

After the noise calibration, the first real win. Charlie's review (#2631) pointed past the codegen
prompt to the **upstream `enrichedPrompt` pre-allocation** in `prompts/pkg/prompts.ts`: before any
code is generated, the model writes a plain-language product description, and that step was
instructed to assert "**by default only the app's owner can make changes; everyone else sees a
read-only view**." That primed every app toward owner-published — the dominant Form-A failure.
iter-3 replaced it with a 3-way, shape-aware framing (author-owned default / per-object membership /
owner-published for blog+announcements), consistent with `system-prompt-initial.md`. A 5-persona
predict-gate caught that an early 2-way draft dropped per-object and would regress team/club; fixed
to genuine 3-way before any batch.

Result (5 eval batches + 2 holdout, calibrated bands):

| metric                | baseline | iter-3 (mean)     | Δ          |
| --------------------- | -------- | ----------------- | ---------- |
| eval.metric           | 0.5625   | **0.7875** ±0.033 | **+0.225** |
| Form-A strict         | 34.4%    | **2.2%**          | −32.2pp    |
| holdout.metric        | 0.3984   | **0.703**         | **+0.305** |
| two-file / renderable | 1 / 1    | 1 / 1             | flat       |

Eval batches 0.797 / 0.813 / 0.734 / 0.828 / 0.766; holdout 0.719 / 0.688 — both tight and far above
the noise band, so this is a durable win, not a lucky draw. **`baseline.json` re-based to iter-3** as
the new hill-climb reference (explicit, with `supersedes`), so iters 4+ are judged against 0.7875 /
0.703, not the original 0.5625 / 0.3984.

Per-dimension (mean over 5 eval batches), worst-first — the new frontier:

| prompt (dimension)                                | pass | fail | /40 | dominant failure                                                                                                                        |
| ------------------------------------------------- | ---- | ---- | --- | --------------------------------------------------------------------------------------------------------------------------------------- |
| board — "whiteboard people can join" (per-object) | 12   | 28   | 40  | **"incomplete per-object recipe"** — model builds it as author-owned (public board, each posts own) instead of a joinable shared object |
| todo (per-visitor)                                | 22   | 18   | 40  | "incomplete per-visitor model" — partial per-user isolation                                                                             |
| guest — guestbook (author-owned)                  | 28   | 12   | 40  | mixed                                                                                                                                   |
| team (multi-tier)                                 | 35   | 5    | 40  | minor                                                                                                                                   |
| habit / photo / shop / blog                       | ≥38  | ≤2   | 40  | clean                                                                                                                                   |

Root cause for the #1 failure (`board`): `system-prompt-initial.md` line ~82 blanket-classifies
"a shared **board**, wall, guestbook, or map" as **author-owned**, which collides with the per-object
expectation for "collaborative whiteboard people can **join**." `shop` ("invite my partner") correctly
maps to per-object and passes 97% — it's the ambiguous "people can join" cue that misfires. → **iter-4
target**: disambiguate join-to-co-edit-one-shared-surface (per-object) from each-posts-their-own
wall/guestbook (author-owned), without regressing the passing photo-wall/guestbook.

### Deploy infrastructure note (one-off, did not change the shared system)

The iter-3 deploy hit a Cloudflare **versions+secrets deadlock** (error 10215): the shared
`vibes-diy-pr-preview.yaml` runs `wrangler secret bulk` _before_ `wrangler deploy`, and a pile-up of
cancelled-mid-flight deploys (rapid pushes + a rebase) left the worker with an uploaded-but-undeployed
version, so the secret step failed and the deploy that would clear it never ran. Fixed with a
**one-shot, self-limiting** workflow (`oneshot-unstick-preview.yaml`, `paths:`-filtered to fire exactly
once) that did `wrangler deploy` first; the shared workflow then recovered on its own. The shared
workflow was left untouched. Follow-up worth filing: reorder the shared workflow to deploy-before-secrets
so this can't recur.

### Noise measurement — the key methodology finding

Re-ran the **unchanged baseline prompts** a second time (`base-run2`, same 128-app protocol):

| run (baseline prompts)             | eval      | holdout   |
| ---------------------------------- | --------- | --------- |
| base-run1 (frozen `baseline.json`) | 0.594     | 0.484     |
| base-run2                          | 0.531     | 0.3125    |
| **same-prompt run-to-run Δ**       | **0.063** | **0.172** |

The run-to-run jitter on identical prompts is **≈0.06 (eval)** and **≈0.17 (holdout)** — far wider than
the `gates.ts` default `noiseBand = 0.05`. Across all four baseline-equivalent holdout draws
(0.484 / 0.3125 / 0.250 / 0.297) the frozen `baseline.json` value (0.484) is the **high outlier**;
the true holdout level is ≈0.30.

Consequences:

- **iters 1 & 2 were _not_ real regressions** — their holdout (0.25 / 0.30) sits inside the variance
  band around ≈0.31; gate 5 fired against a lucky-high frozen baseline. And neither cleared the
  measured eval band (≈0.06), so neither is a real win either. Both correctly discarded, but for the
  noise, not for harm.
- **At 64 apps/batch the eval cannot resolve prompt-level effects this small.** The bottleneck is
  measurement noise (codegen + the stochastic "second-visitor" LLM judge), not prompt quality.
- **`noiseBand = 0.05` is ~3× too tight for the holdout gate**, and the frozen baseline holdout is a
  high draw — so the loop systematically discards.

Recommendation (before chasing more prompt edits): either raise `reps` (more apps/batch shrinks the
band ~1/√n), or average K batches per condition, or wire the **measured** bands (eval ≈0.06,
holdout ≈0.17) into `gates.ts` and re-capture `baseline.json` as a multi-batch mean (≈0.56 eval /
≈0.40 holdout) with `--force`. Tracked for #2602.

This branch drives the [`eval/access-model`](../eval/access-model/README.md) autoresearch
loop (issue VibesDIY/vibes.diy#2602): _modify `prompts/pkg/**` → deploy to this PR's
preview env → `generate`/`score`/`report` against it → keep/discard against the composite
PASS/SOFT/FAIL metric behind the 5 verify gates_.

Why a PR preview env: the system prompts under `prompts/pkg/**` are served by the
backend, so each candidate prompt edit only takes effect once it is **deployed**. The
PR-preview workflow rebuilds `pr-{N}-vibes-diy-v2` on every push, so the eval's
`generate` (pointed at the preview API, authed by `VIBES_DEVICE_ID_PREVIEW`) exercises
the candidate prompts. The pinned codegen model is `anthropic/claude-opus-4.8`.

Config + loop discipline: [`agents/access-model-autoresearch.md`](../agents/access-model-autoresearch.md).
Outer-loop runbook: [`agents/autoresearch-outer-loop.md`](../agents/autoresearch-outer-loop.md).

This file is intentionally not part of the assembled system prompt; it exists to document
the run and to trigger the first preview deploy on baseline-identical prompts so the frozen
`baseline.json` is captured against the same env class the candidates run on.

## Auth setup for this run (reproduce in a fresh session)

The eval's `generate` authenticates against the preview API via the CLI device-id keybag.
The CLI reads **only** the `VIBES_DEVICE_ID` env var (`vibes-diy/cli/device-id-env.ts`) — a
preview secret in `VIBES_DEVICE_ID_PREVIEW` is **not** consulted — and an existing keybag
certificate always wins over the env var. In this container the keybag is pre-seeded with the
**prod** device cert, which the preview worker (dev device-id CA) rejects with
`authentication_required`. So, before running any stage against the preview:

1. Clear the persisted keybag so the env var can seed the preview cert:
   `rm -f ~/.fireproof/keybag/*.json` (back it up first if you need the prod cert later).
2. Export the **preview** secret into the var the CLI actually reads, for every stage:
   `export VIBES_DEVICE_ID="$VIBES_DEVICE_ID_PREVIEW"`.

The shared Neon DB already has the `eval` handle owned by the prod user, so this run uses a
dedicated handle the preview user can claim — `evalpr2631` (`config/matrix.json` → `handle`).
`apiUrl`/`runtimeHostBase` in `matrix.json` point at this PR's preview worker; the model pin
(`anthropic/claude-opus-4.8`) and the scored matrices are unchanged.
