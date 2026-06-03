# Access Function Eval Playbook

Eval harness for the Firefly access function system prompt update. Tests whether the updated system prompt produces good apps — both for existing home-page prompts and for new sharing/permissions prompts.

## What it tests

- **Set A (as-is):** Home-page prompts run verbatim. Regression check.
- **Set B (enhanced):** Same concepts rewritten with natural sharing language ("only I can delete," "my team sees these"). Tests whether the model handles permission-shaped requests well.
- **Set C (new capabilities):** Business apps (contact form, survey, configurator) that weren't possible before `allowAnonymous` + channel isolation.
- **Set D (3x):** 7 prompts run three times for consistency/variance signal.

## Files

- Spec: `docs/superpowers/specs/2026-06-03-access-fn-eval-playbook.md`
- Prompts: `docs/superpowers/specs/eval-access-fn-prompts.json`
- Workflow: `docs/superpowers/specs/eval-access-fn-workflow.js`

## Running

The workflow uses `npx vibes-diy@latest generate` to create apps, `pull` to download files, and agent-based scoring to rate 1-5 on app quality. Access function usage is tracked as informational signals, not scored.

To run a single prompt manually:

```sh
npx vibes-diy@latest generate "Contact page for my landscaping business..." --app-slug eval-contact-form-new --verbose
npx vibes-diy@latest pull eval-contact-form-new
# inspect eval-contact-form-new/App.jsx and access.js
```

## Scoring

5-point scale on app quality: renders, features work, UI coherent, workflow connects. Not testing whether access.js is emitted — testing whether the app is good.

## PR

[#2201](https://github.com/VibesDIY/vibes.diy/pull/2201) — pending CharlieHelps review.
