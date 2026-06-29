# evidence-review-protocol

> A research integrity team at a large federal funding agency reviews program evaluation reports submitted by grantees and needs to standardize how they assess the credibility of causal claims before the agency cites a result in policy briefs that influence billion-dollar appropriations. The team currently relies on a few senior methodologists whose review notes are inconsistent across reviewers and over time. Build a mission-critical review tool that takes a submitted evaluation report and walks a reviewer through a rigorous protocol grounded in the potential outcomes framework. For each report, the reviewer logs the claimed treatment, the claimed outcome, the target population, the design used (randomized controlled trials, regression discontinuity design, difference-in-differences, instrumental variables, propensity score methods, matching estimators, synthetic controls, panel data methods, or two-stage least squares), and the identifying assumption stated by the authors. The reviewer then evaluates whether the assumption was tested where testable, what robustness checks were run, and whether treatment effect heterogeneity was explored for the subgroups most relevant to policy. The app should let the reviewer attach a directed acyclic graph reflecting their reading of the design, flag confounders the authors did not address, note any selection bias concerns, and rate the overall credibility on a structured rubric the agency has adopted. A second reviewer is independently assigned for any report above a dollar-threshold, and the app reconciles the two reviews, surfacing disagreements for adjudication by the head of methods. Every review is preserved with full version history because these reports are FOIA-requestable and may be cited in litigation. The app should also produce an internal dashboard showing which design families the agency's portfolio leans on most heavily, where credibility ratings tend to fall, and which grantees consistently produce the most defensible evidence — feeding back into future funding decisions.

Live at [https://vibes.diy/vibe/edu/evidence-review-protocol](https://vibes.diy/vibe/edu/evidence-review-protocol)

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
