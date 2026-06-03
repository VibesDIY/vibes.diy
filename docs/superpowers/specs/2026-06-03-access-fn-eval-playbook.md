# Access Function Eval Playbook

Measures whether the updated system prompt (with Firefly access function support) produces good, working apps — both for existing home-page prompts and for new sharing/permissions prompts written as a non-technical first-time user would phrase them.

## Goal

Not testing whether the model emits `access.js` — testing whether the apps are good. The access function is part of the platform now; if the model uses it, great. If not, also fine. What matters: does the prompt produce a working app that does what the user asked for?

## Prompt sets

### Set A — As-is (20 prompts, run once each)

Home-page prompts run verbatim against the current system prompt. Tests that the prompt update didn't regress app quality.

### Set B — Enhanced (24 prompts, run once each)

The same concept rewritten so the user naturally describes sharing, privacy, or permissions in plain language. No tech jargon, no platform vocabulary. Reads like someone describing their app idea to a friend.

### Set C — New capabilities (4 prompts, run once each)

Business apps that weren't possible before `allowAnonymous` and channel-based isolation: contact forms, surveys, product configurators. These are net-new — no as-is baseline.

### Set D — 3x consistency (6 prompts × 3 runs each = 18 runs)

A distribution of prompts run three times to measure reliability vs. luck. Includes easy, mid, hard, and subtle cases, plus one with both as-is and enhanced versions for delta measurement.

### Total: 62 single runs + bonus signal from 18 triple runs

## Scoring rubric

5-point scale. One score per app.

| Score | Meaning                                                       |
| ----- | ------------------------------------------------------------- |
| 5     | Renders, all features work, UI is coherent, workflow connects |
| 4     | Renders, most features work, minor UI/UX gap                  |
| 3     | Renders but a key feature is broken or missing                |
| 2     | Renders with errors or crashes on basic interaction           |
| 1     | Fails to render or fundamentally broken                       |

### Bonus signals (logged, don't affect score)

- Emitted `access.js`? (yes/no)
- Used `access.hasChannel()` or `access.hasRole()` in App.jsx?
- Used `isOwner` for management gates?
- Used `ViewerTag`?
- Used `allowAnonymous`?

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

| ID                 | Prompt          | Version  | Why                                                            |
| ------------------ | --------------- | -------- | -------------------------------------------------------------- |
| `focus-timer-asis` | Focus Timer     | as-is    | Baseline calibrator — should score 4-5 every time              |
| `brain-dump-asis`  | Brain Dump      | as-is    | Mid-complexity with callAI. Both versions for delta.           |
| `brain-dump-enh`   | Brain Dump      | enhanced | Same concept + sharing language. Does it help or hurt?         |
| `trivia-night-enh` | Trivia Night    | enhanced | Host/player roles, private answers, score reveal               |
| `pixel-art-enh`    | Pixel Art       | enhanced | Most ambitious — collaborative layers. High variance expected. |
| `meet-up-enh`      | Meet Up         | enhanced | Subtle privacy: "each person pastes privately"                 |
| `survey-new`       | Customer Survey | new      | Richest access function case: anon + write-once + team role    |
