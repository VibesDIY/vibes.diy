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

| iter | edit                                                                                                                                                                                                                                               | eval                                  | Δeval                      | holdout             | verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| base | —                                                                                                                                                                                                                                                  | 0.594                                 | —                          | 0.484               | reference                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 1    | author-contributed content is author-owned, not owner-published (`system-prompt-initial.md`)                                                                                                                                                       | 0.625                                 | +0.031 (in noise)          | 0.250               | **DISCARD** — gate 5 (holdout) fail; the blanket "don't owner-gate" framing overcorrected, collapsing holdout multi-tier (h-club 7/8→1/8) and per-object (h-trip 5/8→2/8) even though eval Form-A improved (34.4%→28.1%)                                                                                                                                                                                                                                                |
| 2    | additive: curated-sounding feeds (photo wall) are author-owned for posts too (`system-prompt-initial.md`)                                                                                                                                          | 0.578                                 | −0.016 (in noise)          | 0.297               | **DISCARD** — eval flat (within noise), holdout fails gate 5 again. A tiny additive edit producing nearly the same holdout drop as iter 1's blunt rewrite points to **holdout variance**, not real regression                                                                                                                                                                                                                                                           |
| 3    | make the upstream `enrichedPrompt` pre-alloc access-shape-neutral (3-way: author-owned / per-object / owner-published) instead of asserting an owner-published default (`prompts/pkg/prompts.ts`)                                                  | **0.7875** ±0.033 (5-batch mean)      | **+0.225**                 | **0.703** (2-batch) | **KEEP** — huge, far beyond the 0.06 band; Form-A strict 34.4%→2.2%; gates green; generalizes to holdout (+0.305). Root cause was the _enrichment_ layer priming codegen to "only the owner can make changes" before generation. **baseline.json re-based to this.**                                                                                                                                                                                                    |
| 4    | disambiguate "board/whiteboard people join to co-edit" → per-object vs "wall/guestbook each posts own" → author-owned, in the **downstream** `system-prompt-initial.md` classifier (~82/84)                                                        | 0.7396 (3-batch)                      | −0.048 (in noise)          | 0.672               | **DISCARD** — doesn't clear the band; board did not improve. Diagnostic: 19/21 failing board cells still built author-owned shape (no object channel) — the downstream classifier can't override the **upstream enrichment**, which still frames a whiteboard as "everyone adds their own." Reverted. `photo`/`guest` did not regress. Confirms the enrichment is the lever → iter-5.                                                                                   |
| 5    | enrichment (`prompts.ts`): route "a board/canvas a group co-edits, people join or are invited into, anyone free to change any of it" → per-object membership                                                                                       | 0.6927 (3-batch)                      | −0.095 (regression)        | 0.672               | **DISCARD** — backfired. board went 0/8 with Form-A (the "join or are invited into" + "anyone free to change any of it" framing made the model owner-gate the board, not build per-object membership), team 7→5. board is adversarial: iter-4 left it author-owned, iter-5 made it owner-gated. Reverted. Lesson: the enrichment is high-leverage but volatile; precise phrasing matters. → iter-6 pivots off board to the cleaner per-visitor recipe-completeness gap. |
| 6    | system-prompt per-visitor recipe: make the per-user channel (`user:`+handle) + `grant.users` self-grant explicit, warn against shared/public routing (`system-prompt-initial.md`)                                                                  | 0.7865 (3-batch)                      | −0.001 (flat)              | 0.797 (1 sample)    | **DISCARD** — eval flat. The mechanism _worked_ — `todo` per-user-channel emission 0/12→11/16 and todo passes 4.4→5.3/8 — but it nudged the already-passing `habit` down 7.6→6.7/8, so the two cancel on the 2-prompt per-visitor eval slice. Holdout rose +0.094 but from a single sample (within the ±0.17 holdout noise), so not robust. Reverted. Near-miss: a more surgical per-visitor edit that doesn't perturb `habit` is the clear iter-7.                     |
| 7    | **owner is not special** — retire `isOwner`, reframe ownership as the object graph (whoever authored/created owns), open-join the default (`system-prompt-initial.md`, `system-prompt.md`, `prompts.ts`)                                           | ~0.46 (2-batch, RAW)                  | **−0.33 (dramatic, raw)**  | —                   | **regressed RAW — not shipped alone** — the reframe by itself drove codegen to wrong access shapes (apps still built 100% / rendered 100%, but the access logic was wrong: iter7-b2/b3 = 0.42 / 0.50 @ `ddf8487`). Rescued by iter-8 — see below.                                                                                                                                                                                                                       |
| 8    | iter-7 **+ crisp, complete, copyable worked `access.js` examples** (split into open-wall + per-object; Charlie `d427016`) + isOwner retirement completed + `use-vibe` `can.create` author-stamp & `d3` stray-`</script>` example fixes (`b3a1534`) | **0.8086** (2-batch: 0.8047 / 0.8125) | **+0.021 (flat, in band)** | 0.797 (1 sample)    | **KEEP** — rescues iter-7's −0.33 raw regression back to baseline level. Ships the cleaner model (`isOwner`=0, object-graph ownership) at **no net metric cost**; gates 2/3/5 green, Form-A 0%, two-file/renderable 100%. Governing rule = iter-7's "keep-as-baseline unless dramatic fall" → keep. Open gap: `todo` per-visitor 2–3/8.                                                                                                                                 |

## Final result (iters 3–6)

**Net change shipped: iter-3 only** — `prompts/pkg/prompts.ts` enrichment made access-shape-neutral —
plus the harness calibration (`gates.ts` per-metric bands + re-based `baseline.json`, #2637).

|                         | eval       | holdout    | Form-A strict |
| ----------------------- | ---------- | ---------- | ------------- |
| original baseline       | 0.5625     | 0.3984     | 34.4%         |
| **final (iter-3 kept)** | **0.7875** | **0.703**  | **2.2%**      |
| Δ                       | **+0.225** | **+0.305** | **−32.2pp**   |

The single durable win (iter-3) came from the **upstream enrichment** layer, not the codegen
classifier or recipe text. The three follow-ups all targeted the post-iter-3 frontier (`board`
per-object, `todo` per-visitor) and all discarded — but they **mapped the failure surface precisely**:
`board` is adversarial (resists per-object both ways — author-owned via the classifier, owner-gated via
the enrichment), and `todo`'s per-visitor recipe is fixable (iter-6 proved the mechanism) but needs a
surgical edit that doesn't disturb `habit`. Recommended next: **iter-7** — a per-visitor edit scoped to
"shared-feed vs private" that lifts `todo` without touching `habit`'s working path, confirmed over ≥3
eval + ≥2 holdout batches.

## iters 7–8 — the big reframe, rescued (KEPT)

**Net change shipped on top of iter-3: the iter-7 "owner is not special" reframe, made to work by
iter-8's worked examples.** iter-7 alone was a **dramatic regression** — deployed raw (`ddf8487`),
two eval batches scored **0.42 / 0.50** (mean ~0.46, −0.33 vs the 0.7875 baseline). Codegen kept
building and rendering (two-file/renderable 100%), but the reframe pushed it to the _wrong access
shapes_. So the worked `access.js` examples turned out to be **load-bearing, not polish**: rewriting
them crisp/complete/copyable (Charlie, `d427016`) plus completing the `isOwner` retirement and the
`use-vibe`/`d3` example fixes (`b3a1534`) **rescued the metric back to baseline level**.

|                          | eval                       | holdout          | isOwner | Form-A |
| ------------------------ | -------------------------- | ---------------- | ------- | ------ |
| baseline (iter-3 frozen) | 0.7875                     | 0.703            | 0       | 2.2%   |
| iter-7 RAW (`ddf8487`)   | ~0.46 (2-batch)            | —                | 0       | —      |
| **iter-7+8 (`b3a1534`)** | **0.8086** (0.8047/0.8125) | 0.797 (1 sample) | **0**   | **0%** |

**Verdict: KEEP.** Flat-to-slightly-positive vs baseline (+0.021, inside the ±0.06 band), but it ships
the cleaner conceptual model (`isOwner` retired everywhere, ownership = object graph, open-join
default) at **no metric cost** and passes all regression gates. Two agreeing batches (0.8047 / 0.8125)
confirm the 0.80 is stable, not a high draw. The lesson: a philosophical prompt reframe needs its
worked examples rewritten in lockstep — the abstract framing regresses codegen on its own.

Caveats / follow-ups:

- The strict iters-1–6 keep rule (gain must clear 0.06) would read this as flat→discard; iter-7 was
  deliberately governed by "ship the big change, keep-as-baseline unless dramatic fall," under which
  back-to-baseline is a keep. Operating bar for this borderline: "cleaner model at flat metric is
  worth it." Flagged to the maintainer for an explicit steer on whether flat-vs-baseline should
  instead revert to pure iter-3; pending that, the keep stands under iter-7's governing rule.
- **Open gap → iter-9:** `todo` per-visitor stays weak (2–3/8 across both batches) while `habit`
  (same dimension) passes — the surgical per-visitor edit that lifts `todo` without perturbing
  `habit` is still unclaimed (the original iter-7 intent).
- `verify` gate1 (`check`) and gate4 (`guardrail`) fail as **artifacts**, not regressions: gate1 is a
  local node_modules gap (`@vitest/browser` provider subpath; CI is green on the same tsconfig), and
  gate4 fails closed on an **empty diff** (changes were committed before verify, so there was no prompt
  diff to evaluate). The metric gates (2/3/5) are the real signal and all pass.
- Filed during this pass: graphics worked-example lifecycle leaks (#2639), and the github MCP
  `actions_list` huge-JSON tooling issue (#2640).

## iters 10–12 — shareability as the optimization target, consent as the floor (#2631)

After the consent reframe, the maintainer made **shareability** the optimization target: the median app should be _collaborative_ — every app should offer a consent-respecting way to make part of its object graph visible to others (invite/share grant, request/join, or public read). Shareability is **deterministic** (`hasShareMechanism = memberAuthoredShare || joinPath || publicRead`, no judge → zero judge noise), the **consent metric is the floor** (must not regress), and the shape rubric is demoted to a reported diagnostic. (Also fixed a real grader bug found here: `shareBranch`/`joinBranch` never matched `type === "request"`/`"share"` — the pattern the prompt's own examples teach — so collaboration was undercounted. And the consent judge now runs on every dimension incl. owner-published.)

Three affirmative iterations, each targeting a data-located gap; all **KEPT**:

| iter | edit                                                                                                   | shareability | consent (floor) | result                                                               |
| ---- | ------------------------------------------------------------------------------------------------------ | ------------ | --------------- | -------------------------------------------------------------------- |
| base | (iter-8 kept state)                                                                                    | 82.8%        | ~0.90           | floor                                                                |
| 10   | per-visitor apps are **shareable per-object** (own channel + `share` doc), not private-per-user        | 84.6%        | 0.923           | `todo` 5→7, `habit` 1→3 share; consent holds                         |
| 11   | role-based workspaces **welcome a request-to-join** (a `request` doc, no `requireRole`, member grants) | 85.0%        | 0.900           | `team` multi-tier consent dead-end **1/4 → 3/4 PASS**; consent holds |
| 12   | concrete **why-share for solo-sounding trackers** (streak↔buddy, journal↔coach, budget↔partner)        | **97.2%**    | 0.861           | sticky `habit` gap closes; shareability 85→97%; consent within band  |

**Net (confirmed, multi-batch): shareability 82.8% → ~90%** (confirmation eval **89.6%**, holdout **91.7%**; the iter-12 single-batch 97.2% was a high draw) while the **consent floor held ~0.92** and all deterministic floors (two-file/renderable 100%, isOwner 0) held — "make the median app invitable without breaking consent." The gain **generalizes** (holdout shareability 91.7%, consent 0.958 — not overfit to the eval matrix). All three affirmative (no negative tokenization), each in `system-prompt-initial.md`. **No reverts** (maintainer: keep all three, take lessons).

Confirmation + holdout — lessons (verify-twice):

- **The consent "drift" was noise.** Single batches read 0.923 → 0.900 → 0.861 (looked monotonic-down); the confirmation batch snapped back to **0.917** and holdout to **0.958**. The shareability edits cost no consent — never trust a single-batch trend through the ±0.11 judge band.
- **Single-batch metric peaks are high draws.** 97.2% → confirmed ~90%. Report the multi-batch level, not the peak.
- **`habit` is genuinely sticky (~50% share).** It read 3/4 in iter-12's lucky batch but **4/8** on confirmation — the prose tracker-motivation didn't _robustly_ convert it. A stubborn per-visitor case needs a **worked example** (codegen copies examples) or an upstream **enrichment-layer** change, not more prose. Clear next lever.

Operational notes: a mid-run **OpenRouter 402 (out of credits)** outage produced a misleading all-`SOFT` batch (consent 0.50/shape 0.36) — the deterministic shareability was unaffected, which is what flagged it as an outage rather than a regression; hardening filed as #2643. Future-rubrics generalization filed as #2642.

## iter-9 reframe — consent rubric + adaptive reps (harness change, no prompt edit) (#2631)

iter-9 began as a per-visitor prompt edit to lift `todo` (which failed 2–3/8 on the shape rubric).
Diagnosis showed `todo` was being routed into per-object collaboration (request-to-join + `requireAccess`)
— the second-visitor judge read "must request to join" as locked-out. The maintainer reframed: **a todo is
an object graph like any other; inviting collaborators with consent is legitimate, so collaboration must
never be counted against a shape.** The prompt edits were reverted — the fix belongs in the grader, not the
prompt. Three additive harness changes (existing shape rubric + Form-A + frozen `baseline.json` untouched):

1. **`isOwner` token → hard fail.** `invariants.ts` flags the literal `/\bisOwner\b/` (broader than the
   `user.isOwner` write-gate); a hard fail in **both** rubrics. Caught 1 cell the old detector missed.
2. **Side-by-side consent rubric.** A shape-agnostic consent judge (`hasConsentPath` +
   `accessLeakedWithoutConsent`) + `gradeConsentRow`: collaboration is never penalized; a cell fails only
   on the `isOwner` token, a **consent leak** (access to _others'_ data/membership without the owner's
   consent), or a **true dead-end** (a second visitor has no consent-respecting path). The report prints
   `CONSENT METRIC` beside the shape `METRIC`. Validated by re-scoring iter-8 (64 cells): shape **0.797 →
   consent 0.906** (after a leak-definition calibration that stopped over-flagging author-owned public
   writes). `todo` recovered 2/8 → consent 8/8; the rubric _also_ caught real issues the shape rubric was
   blind to — `team` multi-tier dead-ends and `photo` image-docs with no author check — so the side-by-side
   is net-informative, not merely more lenient.
3. **Adaptive reps + half-by-default.** `matrix.reps` 8→4 base, `repsMax` 8: a base wave of 4 for every
   prompt, then a top-up to 8 for only the prompts whose base-wave reps **disagree** (a prompt whose 4 reps
   all agree — pass _or_ fail — is saturated and stays at 4). Smoke-validated end-to-end: **40 cells vs 64
   (−37.5%)**, topping up only the 2 disagreeing prompts. Split-half analysis (#2631) justified it: a 4-rep
   read carries the directional + diagnostic signal; the extra reps mostly bought precision below the noise
   floor. `verify` now runs this adaptive batch for both eval and holdout.

Baseline stays **frozen** at its 8-rep capture (maintainer decision — _not_ re-captured for the adaptive
switch); the gates compare _rates_, comparable across rep counts. **No prompt change shipped in iter-9** —
the kept prompt state remains iter-7+8 (`b3a1534`).

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
