# Predict-gate — iter 3: make enrichment layer access-shape-neutral

**Change:** `prompts/pkg/prompts.ts` — `PRE_ALLOC_PLATFORM_PARAGRAPH` + Sentence-3 instruction of the `enrichedPrompt` pre-allocation, replacing an owner-published-by-default assertion with shape-aware framing (participant/author-owned default; owner-published named for blog/announcements).

**Hypothesis:** the enrichment layer (a plain-language product description the model writes *before* codegen, which then shapes the app) was priming codegen toward owner-published, driving the ~34% Form-A strict failures. Removing the contradictory prior should lower Form-A and raise the eval metric without regressing genuinely owner-published (blog) or per-object (team/club) apps.

## Consensus verdict: **GO to batch** (net-positive, ~60–70% likely to clear the 0.06 eval band)

This removes a contradictory prior rather than adding guidance, and aligns the upstream layer with the newcomer-first default already in `system-prompt-initial.md:80-86`. Low blast radius, easy revert. Spend one 64-app eval batch and read the per-shape breakdown.

## Top findings (ranked)

| # | Lens | Finding | Sev | Conf |
|---|------|---------|-----|------|
| 1 | Architect | Root-cause fit is strong: enrichment was the one layer asserting owner-only as a *default*; codegen reads the enriched preamble as product intent, so an owner-only description is a hard prior. Fixing it is higher-leverage than adding codegen-prompt guidance (iter 1/2). | — | 80 |
| 2 | Devil's Advocate | **Per-object omission.** ~~The new framing is binary (author-owned vs owner-published) and drops the per-object/invite/"share with" shape. A collaborate/team app could now be described as "each visitor adds their own" → author-owned, regressing per-object rows. Charlie's suggestion was a *3-way* classifier; this edit encodes 2.~~ **ADDRESSED pre-batch:** both strings revised to genuine 3-way (author-owned / per-object "inviting people into a shared thing" / owner-published), matching `system-prompt-initial.md:80-86`. | Med→Resolved | 65 |
| 3 | Reliability | **Over-correction on blog.** Leading with "most apps … first-class participant" could nudge a genuinely owner-published app toward author-owned (the inverse error). Mitigated by naming blog/announcements explicitly, but "most apps" is a thumb on the scale. Watch owner-published sub-rate for a dip. | Med | 55 |
| 4 | Signal/Noise | Form-A is ~34%; if even a third of those flip, formAStrictRate moves ~0.10 and the composite metric likely clears the 0.06 eval band — **detectable on eval**. Holdout (per-prompt, ±0.17) is too noisy to judge this; weight the eval batch. | — | 70 |
| 5 | Security/Correctness | No over-permissive risk: this changes *description wording*, not `access.js` generation rules; the runtime still enforces. Worst case is a wrong *shape*, caught by the grader, not a security hole. | Low | 75 |

## Watch items for the batch (read the breakdown, not just the headline metric)
- **formAStrictRate** — expect ↓ (primary hypothesis).
- **per-object rows** (team/club/invite) — expect flat; a dip confirms finding #2.
- **owner-published rows** (blog/announcements) — expect flat; a dip confirms finding #3.

## Pre-registered keep/discard (calibrated bands, #2637)
Keep iff eval metric ≥ baseline + 0.06 **and** all 5 gates green (two-file/renderable ≥ baseline − 0.05, holdout ≥ baseline − 0.17, check + guardrail green). A gain inside the band → discard or confirm with a second batch. If finding #2 or #3 fires (sub-rate regression) even with a net metric gain, prefer a follow-up that restores the per-object/owner clause before keeping.
