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

| iter | edit                                                                                                      | eval  | Δeval             | holdout | verdict                                                                                                                                                                                                                  |
| ---- | --------------------------------------------------------------------------------------------------------- | ----- | ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| base | —                                                                                                         | 0.594 | —                 | 0.484   | reference                                                                                                                                                                                                                |
| 1    | author-contributed content is author-owned, not owner-published (`system-prompt-initial.md`)              | 0.625 | +0.031 (in noise) | 0.250   | **DISCARD** — gate 5 (holdout) fail; the blanket "don't owner-gate" framing overcorrected, collapsing holdout multi-tier (h-club 7/8→1/8) and per-object (h-trip 5/8→2/8) even though eval Form-A improved (34.4%→28.1%) |
| 2    | additive: curated-sounding feeds (photo wall) are author-owned for posts too (`system-prompt-initial.md`) | 0.578 | −0.016 (in noise) | 0.297   | **DISCARD** — eval flat (within noise), holdout fails gate 5 again. A tiny additive edit producing nearly the same holdout drop as iter 1's blunt rewrite points to **holdout variance**, not real regression            |

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
