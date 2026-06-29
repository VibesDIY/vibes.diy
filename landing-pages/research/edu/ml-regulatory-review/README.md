# ml-regulatory-review

> A federal regulatory agency reviews machine learning models that companies deploy in regulated decisions — lending, hiring, insurance underwriting, healthcare risk stratification — for compliance with fairness, transparency, and statistical validity standards. The review team needs a mission-critical audit app that lets reviewers examine submitted model documentation with the same rigor across submissions, generate the structured findings that go into enforcement decisions, and maintain a complete audit trail. Build a high-stakes regulatory review app where each submission opens a structured review case. The reviewer logs the model's stated purpose, the algorithm family (logistic regression, decision trees and random forests, support vector machines, neural networks, or ensembles), the training data description, the documented feature engineering, the regularization and model selection protocol, and the cross-validation strategy used to estimate performance. The app walks the reviewer through a standardized rubric: was the cross-validation protocol appropriate to the data structure? Was the model selection process documented and defensible? Were the features engineered without leakage of outcome information? Is the choice of algorithm proportionate to the decision's stakes — is a black-box neural network being used where a regularized logistic regression would have sufficed? The reviewer then evaluates subgroup performance using the submitted disaggregated metrics, flagging disparate performance that the submitter must explain. Dimensionality reduction techniques like principal component analysis are scrutinized for whether they obscure protected attributes. The reviewer can request additional documentation from the submitter through the app, and every exchange is logged. The output is a structured findings document with cited evidence, suitable for the agency's enforcement workflow and defensible if litigated. Across submissions the app surfaces patterns — which industries are submitting which algorithm families, which review issues recur — feeding the agency's policy guidance work for the next rulemaking cycle.

Live at [https://vibes.diy/vibe/edu/ml-regulatory-review](https://vibes.diy/vibe/edu/ml-regulatory-review)

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
