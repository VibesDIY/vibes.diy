# clinical-model-development

> A research data scientist at a hospital system is building a clinical risk model intended to flag inpatients at elevated risk of sepsis within the next six hours, drawing on vitals, labs, medication orders, and demographic features from the electronic health record. They need a serious analytic app that supports the rigorous model development required for a clinical deployment — every modeling decision must be defensible to a clinical advisory board and a regulatory reviewer. Build a professional model development app that walks the data scientist through the structured pipeline. They start by defining the prediction task formally — the index time, the prediction window, the inclusion and exclusion criteria, the outcome definition — and document each. The app supports feature engineering with explicit handling of time-windowed aggregates, missing-data conventions, and clinical plausibility checks for each derived feature. Model selection is structured: they specify the candidate algorithms (logistic regression with regularization, decision trees and random forests, support vector machines, gradient-boosted trees, a small neural network) and the cross-validation protocol respecting patient-level grouping and temporal validity. The app runs the comparison and produces a structured report including discrimination, calibration in each clinically relevant subgroup, decision-curve analysis, and the operating thresholds the clinical team would actually use. The data scientist documents the tradeoffs — interpretability of logistic regression against the modest accuracy gains of random forests or a neural network — and the recommendation. Principal component analysis or other dimensionality reduction is considered explicitly with the question of clinical interpretability. The final artifact is a model card the clinical advisory board can read, including limitations, subpopulations where the model performs less well, and the planned monitoring protocol after deployment. Nothing about this app generates code — it produces the rigorous decision record around the modeling.

Live at [https://vibes.diy/vibe/edu/clinical-model-development](https://vibes.diy/vibe/edu/clinical-model-development)

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
