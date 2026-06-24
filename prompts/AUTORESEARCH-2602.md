# Autoresearch run log — #2602 access-model codegen eval

## Iteration ledger

Frozen baseline (commit `3fac49e`, preview env, 128 apps @ concurrency 16):
**eval = 0.594** (Form-A strict 34.4%, two-file 100%, renderable 100%), **holdout = 0.484**.
Keep rule: eval gain > 0.05 noise band with gates green (two-file ≥ 0.95, renderable ≥ 0.95,
holdout ≥ baseline − 0.05 = 0.434), then a confirmation batch.

| iter | edit                                                                                                      | eval  | Δeval             | holdout | verdict                                                                                                                                                                                                                  |
| ---- | --------------------------------------------------------------------------------------------------------- | ----- | ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| base | —                                                                                                         | 0.594 | —                 | 0.484   | reference                                                                                                                                                                                                                |
| 1    | author-contributed content is author-owned, not owner-published (`system-prompt-initial.md`)              | 0.625 | +0.031 (in noise) | 0.250   | **DISCARD** — gate 5 (holdout) fail; the blanket "don't owner-gate" framing overcorrected, collapsing holdout multi-tier (h-club 7/8→1/8) and per-object (h-trip 5/8→2/8) even though eval Form-A improved (34.4%→28.1%) |
| 2    | additive: curated-sounding feeds (photo wall) are author-owned for posts too (`system-prompt-initial.md`) | 0.578 | −0.016 (in noise) | 0.297   | **DISCARD** — eval flat (within noise), holdout fails gate 5 again. A tiny additive edit producing nearly the same holdout drop as iter 1's blunt rewrite points to **holdout variance**, not real regression            |

Observation after iters 1–2: eval is flat across both perturbations (0.578–0.625, ≈±0.025) and
holdout swings hard (0.484 → 0.25 / 0.30) for two very different edits. The single-shot baseline
holdout (0.484) is likely a high draw and the 0.05 gate band is too tight to trust. Next step:
re-measure the baseline (baseline-run2) on the same prompts to quantify the true noise band
before judging further edits.

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
