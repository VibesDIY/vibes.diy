# Access Function Eval Playbook

Measures whether the updated system prompt (with Firefly access function support) produces good, working apps — both for existing home-page prompts and for new sharing/permissions prompts written as a non-technical first-time user would phrase them.

## Goal

Not testing whether the model emits `access.js` — testing whether the apps are good. The access function is part of the platform now; if the model uses it, great. If not, also fine. What matters: does the prompt produce a working app that does what the user asked for?

## Prompt sets

### Set A — As-is (25 prompts, run once each)

Home-page prompts run verbatim against the current system prompt. Tests that the prompt update didn't regress app quality. Every enhanced prompt now has an as-is control for clean delta measurement.

### Set B — Enhanced (24 prompts, run once each)

The same concept rewritten so the user naturally describes sharing, privacy, or permissions in plain language. No tech jargon, no platform vocabulary. Reads like someone describing their app idea to a friend — "we each have our own," "only I can," "everyone sees" — not "only the project creator can merge layers."

### Set C — New capabilities (6 prompts, run once each)

Business apps that weren't possible before `allowAnonymous` and channel-based isolation: contact forms, surveys, product configurators, maintenance requests, job applications. These are net-new — no as-is baseline.

### Run count

Derived from the prompt catalog: each prompt runs once, plus `triple: true` prompts get 2 extra runs. The workflow computes this from the data — no hardcoded totals.

## Scoring rubric

5-point scale. One score per app.

| Score | Meaning                                                       |
| ----- | ------------------------------------------------------------- |
| 5     | Renders, all features work, UI is coherent, workflow connects |
| 4     | Renders, most features work, minor UI/UX gap                  |
| 3     | Renders but a key feature is broken or missing                |
| 2     | Renders with errors or crashes on basic interaction           |
| 1     | Fails to render or fundamentally broken                       |

### Tracked signals (informational, don't affect score)

- Emitted `access.js`? (yes/no)
- Used `access.hasChannel()` or `access.hasRole()` in App.jsx?
- Used `isOwner` for management gates?
- Used `ViewerTag`?
- Used `allowAnonymous`?
- **Prompt fidelity** — did it build the constraints/features the user described?
- **Access correctness** — do read/write/visibility rules match prompt intent?
- **Denial UX** — clear "you can't do that" states vs. silent failure?

## Execution

Each prompt runs via:

```
npx vibes-diy@latest generate "<prompt>" --app-slug eval-<id> --verbose
```

Then pull + read files:

```
npx vibes-diy@latest pull eval-<id>
```

A scoring agent reads App.jsx + access.js and scores 1-5.

## Prompt catalog

See `eval-access-fn-prompts.json` for the full prompt list with IDs, categories, original text, and enhanced text.

## 3x consistency picks

Swapped per CharlieHelps review — removed pixel-art-enh and trivia-night-enh (high non-access variance from rendering/game complexity), added contact-form-new and soccer-signup-new (cleaner access-function signal).

| ID                  | Prompt          | Version  | Why                                                    |
| ------------------- | --------------- | -------- | ------------------------------------------------------ |
| `focus-timer-asis`  | Focus Timer     | as-is    | Baseline calibrator — should score 4-5 every time      |
| `brain-dump-asis`   | Brain Dump      | as-is    | Mid-complexity with callAI. Both versions for delta.   |
| `brain-dump-enh`    | Brain Dump      | enhanced | Same concept + sharing language. Does it help or hurt? |
| `meet-up-enh`       | Meet Up         | enhanced | Subtle privacy: "each person pastes privately"         |
| `contact-form-new`  | Contact Form    | new      | Purest allowAnonymous + owner-only inbox               |
| `soccer-signup-new` | Soccer Sign-up  | new      | Own-row editing + coach override                       |
| `survey-new`        | Customer Survey | new      | Richest case: anon + write-once + team role            |
