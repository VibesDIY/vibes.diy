# methods-reading-group

> A small research methods reading group at a community college meets monthly to work through papers that use causal inference techniques, but members come from wildly different backgrounds — a nurse, a school principal, two journalists, a city councilmember, and a software engineer. They want a shared space where each meeting can be organized around a single paper and everyone contributes their reading of how the causal claim was made. Build a coordination app where one person posts the paper for the upcoming meeting along with its abstract, the claimed treatment, and the claimed outcome. Other members can then drop in beforehand and tag what method the paper used — randomized controlled trials, difference-in-differences, regression discontinuity design, instrumental variables, propensity score methods, matching estimators, or synthetic controls — and write a short note on whether they think the identifying assumption holds in this case. The app should let the group collectively sketch a directed acyclic graph of the variables in the study and vote on whether they believe the authors handled the most important confounder. After the meeting, the group can record a final consensus note: which method, which assumption was most contested, and whether the paper survived the discussion. Over time the app builds the group's shared library of papers they have worked through, organized by method, so a new member can browse the back catalog and see how the group's reasoning has evolved. Members should be able to flag papers as candidates for next meeting, attach links to follow-up papers that critique or extend the original, and leave private notes that only they see while still contributing to the shared write-up.

Live at [https://vibes.diy/vibe/edu/methods-reading-group](https://vibes.diy/vibe/edu/methods-reading-group)

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
