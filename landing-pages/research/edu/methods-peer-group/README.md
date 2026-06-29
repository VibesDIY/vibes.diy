# methods-peer-group

> A research methods peer group at a college of education brings together six doctoral candidates spread across different substantive interests but united by methodological needs. They want a shared workspace to practice their quantitative chops together, swap notes on tricky regression analysis decisions, and avoid each of them solving the same methodological puzzle in isolation. Build a community methods workspace where each member can post a methodological question from their own dissertation work — 'My data has students nested in schools nested in districts, and the district-level variation looks small; should I drop the district level from my hierarchical linear modeling specification?' — and other members can weigh in with their reasoning, references to relevant texts, and analogues from their own work. The workspace should support sharing structured project descriptions: the research question, the data structure, the proposed quasi-experimental research design or observational design, the candidate model specifications, the planned model diagnostics, and the interpretation strategy. For members doing mixed methods research design, the workspace should accommodate the qualitative coding schemes side of the work alongside the quantitative regression analysis, treating them as integrated. The group can hold scheduled methodological work-throughs where one member presents a tricky decision — choosing between fixed effects estimators and random effects models, deciding whether to include an interaction term that is theoretically motivated but statistically marginal, handling panel data with attrition — and the group discusses live. A library of resolved questions becomes the group's reference for future cohorts. The workspace also tracks reading group selections, with each book or paper getting a discussion thread tied to the methodological decisions the readings clarify.

Live at [https://vibes.diy/vibe/edu/methods-peer-group](https://vibes.diy/vibe/edu/methods-peer-group)

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
