# ml-toolkit-explorer

> A self-taught learner has been hearing the same machine learning vocabulary words on every podcast and wants to actually understand what each one does and when each is the right tool, without committing to a 16-week MOOC. They want to play with toy datasets, try the methods, and watch the methods fail in instructive ways. Build a playful learning app where the learner picks from a small library of classic toy datasets — irises, MNIST digits, a synthetic two-moons cluster, a credit default tabular dataset, a few thousand customer churn records — and walks through a guided exploration of each method in the basic toolkit: logistic regression, decision trees and random forests, support vector machines, clustering algorithms, dimensionality reduction including principal component analysis, and a small neural network. For each method, the app should explain in plain language what it is doing, walk the learner through some lightweight feature engineering decisions, run a cross-validation pass to estimate honest performance, and surface the results so the learner can see why one model wins on one dataset and loses on another. The learner should be able to compare two methods side-by-side on the same dataset, watch how regularization strength changes the decision boundary, see how dimensionality reduction with principal component analysis lets them visualize high-dimensional data on a 2D plot, and observe gradient descent literally moving through the loss landscape on a simple problem. Every concept gets a 'why does this matter' sidebar tying it to model selection — when this method shines, when it breaks. The goal is not to teach them to ship production models but to leave them with grounded intuitions for every entry in the machine learning vocabulary they keep hearing.

Live at [https://vibes.diy/vibe/edu/ml-toolkit-explorer](https://vibes.diy/vibe/edu/ml-toolkit-explorer)

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
