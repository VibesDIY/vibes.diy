# evidence-clearinghouse

> A national education research clearinghouse evaluates submitted impact studies for inclusion in its evidence base, which informs federal program decisions, state adoption choices, and district purchasing decisions affecting tens of millions of students. The review staff need a mission-critical evidence review app that applies consistent methodological standards across hundreds of submissions per year. Build a high-stakes evidence review app where each submitted study opens a structured case file. The reviewer logs the study's research question, target population, intervention description, comparison condition, outcome measures, and the design (randomized trial, quasi-experimental research design with matching, regression discontinuity, interrupted time series, or other) along with the analytic approach (multiple regression, multilevel models, hierarchical linear modeling, panel data methods with fixed effects estimators, mixed methods research design with both quantitative and qualitative coding schemes components). The app walks the reviewer through the clearinghouse's structured methodological rubric: was the design adequate to support the causal claim, was the analysis appropriately matched to the data structure (does the multilevel models specification respect the nesting, do the fixed effects estimators capture the unobserved confounders the design relies on), are the planned interaction terms theoretically grounded or fishing for subgroup effects, are model diagnostics adequate, are random effects models versus fixed effects estimators justified rather than defaulted to? The reviewer evaluates the strength of evidence each finding supports, the populations to which it generalizes, and any sample restrictions that bound the conclusions. For mixed methods studies the qualitative side is reviewed for trustworthiness and integration with the quantitative findings. Every review is independently conducted by two reviewers and reconciled, with disagreements adjudicated by a senior methodologist. The app maintains the clearinghouse's complete evidence database with the methodological metadata, supporting both the public-facing evidence ratings and the internal research that informs the clearinghouse's standards. Every review is preserved because the clearinghouse's ratings affect federal funding eligibility and are routinely challenged by both program developers and competing researchers.

Live at [https://vibes.diy/vibe/edu/evidence-clearinghouse](https://vibes.diy/vibe/edu/evidence-clearinghouse)

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
