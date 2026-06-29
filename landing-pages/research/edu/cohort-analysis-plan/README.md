# cohort-analysis-plan

> A senior epidemiologist at an academic medical center is leading the analysis of a long-running prospective cohort study with twenty years of follow-up on a panel of about 18,000 participants. They need a serious analytic companion for the design and pre-registration phase of each new analysis. The participant data includes baseline questionnaires, repeated biomarker measurements, linked electronic health record data, mortality follow-up, and detailed exposure assessment from validated instruments. The epidemiologist runs an observational study analysis on a defined research question — say, whether a particular dietary pattern is associated with incident colorectal cancer — and wants to articulate the design rigorously before touching the data. Build a professional design tool that walks them through: stating the research question as a comparison of exposure groups, drafting a directed acyclic graph that lays out the assumed causal structure including the exposure, outcome, and candidate confounders, identifying the minimal sufficient adjustment set from the graph, deciding on the appropriate measure of association (hazard ratio, risk ratio, risk difference), and pre-specifying which subgroup analyses will be conducted to test for effect modification by sex, race, age at baseline, and family history. The app should explicitly walk through threats to validity — selection bias from differential loss to follow-up, confounding from variables not measured at baseline, exposure misclassification in the dietary instrument — and the epidemiologist's planned mitigation for each. The output is a pre-analysis plan suitable for posting to a public registry before the analysis begins, time-stamped and version-controlled. The app should also support a parallel sensitivity analysis section where the analyst lists which assumptions they will probe with alternative specifications. This is the document a methodologically demanding journal will expect to see referenced when the paper is submitted.

Live at [https://vibes.diy/vibe/edu/cohort-analysis-plan](https://vibes.diy/vibe/edu/cohort-analysis-plan)

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
