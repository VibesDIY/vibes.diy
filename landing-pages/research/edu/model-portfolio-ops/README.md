# model-portfolio-ops

> A data scientist at a mid-sized e-commerce company maintains a portfolio of recurring production models — churn risk, fraud flag, lifetime value, recommended next product — and needs an operational workflow app for the regular tasks the role demands: weekly performance monitoring, monthly retraining, periodic model selection reviews when business conditions shift. The current workflow is a mix of notebooks and Slack reminders, and decisions get lost. Build an operational workflow app where each production model has a page that records its current specification: the algorithm family (logistic regression, decision trees and random forests, support vector machines, gradient-boosted trees, a deployed neural network), the feature set with documented feature engineering steps, the regularization strategy, the cross-validation protocol used in the last training run, and the held-out performance metrics. Weekly, the app prompts the data scientist to log monitoring observations: any drift in input feature distributions, any drift in predicted-versus-observed outcomes, any operational issues. Monthly retraining is templated: the workflow steps the data scientist through pulling a fresh training window, re-running the model selection comparison among candidate algorithms, applying the established feature engineering pipeline, and producing a structured retraining report that documents the cross-validation results and the decision to keep or replace the current model. Quarterly the workflow forces a deeper review: should the model family change? Should new features be engineered? Should dimensionality reduction (principal component analysis or otherwise) be considered to reduce the feature footprint? Each decision is logged with rationale, so when a model is challenged six months later — by a stakeholder, an auditor, or a future data scientist inheriting the role — the full record of why this model looks the way it does is recoverable.

Live at [https://vibes.diy/vibe/edu/model-portfolio-ops](https://vibes.diy/vibe/edu/model-portfolio-ops)

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
