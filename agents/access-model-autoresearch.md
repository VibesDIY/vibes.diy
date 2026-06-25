# Access-Model Autoresearch

Autoresearch config block + loop discipline for the `eval/access-model` harness — the loop that drives `prompts/pkg/**` edits so newly-generated vibes adopt the #2588 access model on the default codegen model.

- Harness runbook: [`eval/access-model/README.md`](../eval/access-model/README.md) (the `generate`/`score`/`report` stages, the `verify` Verify command, the matrices, baseline, concurrency lever).
- Design doc the grader encodes: [`docs/superpowers/specs/2026-06-24-vibe-access-model-design.md`](../docs/superpowers/specs/2026-06-24-vibe-access-model-design.md) (Form-A trap, A/B/C/D shape taxonomy, channels-as-objects / roles-as-types, owner dissolved, per-object reduce/projection).
- Issues: VibesDIY/vibes.diy#2602 (the loop, scope, metric, 5 verify gates, concurrency, baseline), #2588 (eval playbook + pass criteria + the 8-prompt matrix), #2595.

## Autoresearch config block

This is the classic-loop config (see [`.claude/skills/autoresearch/SKILL.md`](../.claude/skills/autoresearch/SKILL.md) — `Verify:` is an exact shell command that emits a parseable metric):

```
Goal:    Newly-generated vibes adopt the access model (#2588) on the default codegen model.
Metric:  composite mean(PASS=1/SOFT=.5/FAIL=0) over the 8-prompt matrix, adaptive reps (4 base + top-up to 8;
         #2631). Shape METRIC drives the frozen gates; CONSENT METRIC is the side-by-side view (#2631)
Verify:  cd eval/access-model && pnpm run verify
Success: metric plateaus (no margin-beyond-noise gain across two confirmation batches) with all 5 gates green
Modify:  prompts/pkg/** (scored: fireproof.md, use-vibe.md, use-viewer.md, both system prompts;
         correctness-only: the other llms/*.md + footers + recovery addenda). NOT prompts/pkg/themes/**.
         Prompt-quality edits MUST land in system-prompt-initial.md (the one-shot invariant).
Frozen:  the grader, both matrices, baseline.json. The loop may not edit what scores it.
Iterations: unlimited (run until plateau)
```

The pinned model is `anthropic/claude-opus-4.8` (`eval/access-model/config/matrix.json` → `model`). Every iteration is byte-identical on the model axis; the resolved id is recorded in each run's `run.json`. A later default-model bump must explicitly invalidate `baseline.json` (re-capture with `--force`), never silently move it.

`Verify:` emits `METRIC=<x>` and a `GATES: pass` / `GATES: FAIL(...)` line, exiting non-zero on any gate failure so the loop **discards** the iteration regardless of whether the metric improved.

## Loop discipline

From #2602 — hold to these so the loop spends its batches on real wins, not noise:

- **Adaptive reps (#2631).** `verify` runs a 4-rep base wave for every prompt, then tops up to `repsMax` (8) only the prompts whose base-wave reps **disagree**; a prompt whose 4 reps all agree — pass _or_ fail — is saturated and stays at 4. So the variable prompts (where the noise lives) still get 8 reps, while easy prompts don't burn reps (a ~40-app batch vs a flat 64). Don't judge a _variable_ prompt on fewer than its topped-up reps; bump `matrix.repsMax` if a close call needs more. Split-half analysis (#2631) showed a 4-rep read already carries the directional + diagnostic signal; the extra reps mainly buy precision the eval can't push below the noise floor anyway.
- **Margin beyond the noise band.** Keep an iteration only when the metric gain exceeds the noise band (the run-to-run jitter measured at the same prompt corpus). A gain inside the band is noise — discard. The band was **measured** (re-running identical baseline prompts, #2637): **≈0.06 on eval, ≈0.17 on holdout** — far above the old 0.05 default. `gates.ts` now defaults `rateBand` 0.05 (two-file/renderable sit at ~1.0) and `holdoutBand` 0.17, and `baseline.json` is a multi-batch mean (eval 0.5625 / holdout 0.3984) rather than a single high-variance draw. The baseline stays **frozen at its 8-rep capture** (maintainer decision #2631 — _not_ re-captured for the adaptive switch); the gates compare _rates_, which are comparable across rep counts.
- **Verify-twice.** Re-confirm any kept win with a second independent adaptive batch before treating it as durable. A win that doesn't reproduce on the confirmation batch is discarded.
- **Predict-gate before every batch.** Run [`/autoresearch:predict`](../.claude/skills/autoresearch/SKILL.md) on each proposed `prompts/pkg/**` edit BEFORE spending a batch (5 expert personas debate the change). Cheap deliberation up front beats a wasted live batch.
- **Affirmative shape→model grammar, constrained by the last failure breakdown.** Frame each modify step as a positive instruction that maps the request's access shape (per-visitor / per-object / owner-published / author-owned / multi-tier) to the correct model — and target the specific failure mode the previous iteration's breakdown surfaced (e.g. Form-A strict rate up → strengthen the Form-A trap guidance; per-object recipe incomplete → tighten the object-channel + self-grant + member-authored-share recipe). Do not add negative/prohibition-only rules.
- **Iterations: unlimited until plateau.** Run unbounded. Stop only when the metric plateaus — no margin-beyond-noise gain across two confirmation batches — with all 5 gates green.

## Platform failures

Generate/platform failures (CLI dispatch errors, non-emission, timeouts) are excluded from the score (`ok=false` cells are dropped from the metric denominator) and logged as GitHub issues with the `agent-created` label, linked to #2602. They are infrastructure noise, not access-model signal — do not let them drag the metric or get silently swallowed.
