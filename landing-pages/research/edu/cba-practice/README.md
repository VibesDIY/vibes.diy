# cba-practice

> A college student in an introductory public policy course is struggling to internalize what cost-benefit analysis actually is — they can recite the formula but freeze when asked to apply it to a real decision. They want a casual practice tool to work through small policy scenarios without the burden of producing a full-blown analysis. Build a playful practice app that presents one mini policy decision at a time — a city deciding whether to install a new pedestrian bridge, a school district debating whether to extend the bus service into a rural area, a state choosing between two competing road safety interventions — and walks the student through the elements of a cost-benefit analysis at a beginner level. For each scenario the app prompts the student to name the costs and the benefits, both monetized and unmonetized, identify whose welfare the decision affects (an initial stakeholder analysis), pick a social discount rate appropriate to the time horizon, and apply willingness to pay valuation to the non-market benefits like reduced travel time, lives saved, or avoided injuries. The app should explain each concept as the student touches it, including the trickier ones — shadow pricing when no market price exists, how to handle uncertainty in policy analysis with simple sensitivity analysis, and what welfare economics is implicitly assuming about how to add up gains and losses across people. After each scenario, the student sees a worked solution from a sample policy analyst and can compare their reasoning, with emphasis on where reasonable analysts would differ rather than a single right answer. The app should track which concepts the student is shaky on and serve more practice in those areas, building toward fluency for the final exam without becoming yet another grindy quiz tool.

Live at [https://vibes.diy/vibe/edu/cba-practice](https://vibes.diy/vibe/edu/cba-practice)

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
