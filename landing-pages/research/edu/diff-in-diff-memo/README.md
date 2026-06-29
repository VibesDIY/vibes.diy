# diff-in-diff-memo

> A policy analyst at a state health department is evaluating whether a Medicaid expansion affected emergency department utilization rates. They have county-level panel data: years 2018 through 2024, treatment timing varies by county because expansion happened in waves, the outcome is ED visits per 1000 residents, and they have covariates like poverty rate, baseline insurance rate, rural-urban classification, and hospital bed supply. They know about the Callaway-Sant'Anna and Goodman-Bacon critiques of two-way fixed effects estimators when treatment timing is staggered, and they want to be sure their design is defensible to a methodologically literate reviewer. Build a workflow that walks them through specifying their difference-in-differences design under the potential outcomes framework, asks them to articulate the parallel trends assumption in the language of their specific case, flags whether their setup has staggered adoption, and lays out which estimator family is appropriate. The app should help them think about treatment effect heterogeneity across counties — whether the effect should be expected to vary by baseline insurance rate or rural-urban status — and prompt them to decide whether they want an average treatment effect on the treated or a more granular decomposition. It should also walk through alternative designs they should consider as robustness: a synthetic controls approach using untreated counties as donors, a propensity score methods analysis on county-year observations, and an instrumental variables analysis if a plausible instrument exists. The output is a structured methods memo they can hand to their supervisor: design choice, identifying assumption, threats to identification, robustness plan, and a list of pre-specified subgroups for heterogeneity analysis. Nothing in the app does the estimation — it produces the design document a senior methodologist would want before any data is touched.

Live at [https://vibes.diy/vibe/edu/diff-in-diff-memo](https://vibes.diy/vibe/edu/diff-in-diff-memo)

Single-file React app built with [vibes.diy](https://vibes.diy). Visit the live url to manage access.

## Run it

```sh
npx vibes-diy push     # uploads App.jsx, prints a live HTTPS URL
```

Edit [App.jsx](App.jsx) and push again to iterate.

## Commands

- `npx vibes-diy push` — deploy the current directory
- `npx vibes-diy push --instant-join` — deploy with auto-accept sharing
- `npx vibes-diy generate "prompt"` — generate a new app from a prompt
- `npx vibes-diy help` — full command list
