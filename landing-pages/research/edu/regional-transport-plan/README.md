# regional-transport-plan

> A regional metropolitan planning organization is leading the long-range transportation planning update that will allocate billions of dollars in federal and state funding over the next twenty years across a metro region with several million residents. The lead planner needs a serious analytic app that integrates travel demand forecasting, land use regulation scenarios, and project prioritization under multiple plausible futures. Build a professional regional planning app where the analyst defines the planning horizon, the regional growth assumptions, and the scenarios under consideration — a smart growth scenario concentrating growth in existing centers, an urban growth management scenario with stronger boundaries, a trend-continuation scenario, and a sustainable city planning scenario emphasizing transit and infill. For each scenario the app supports specifying the underlying land use forecast — distribution of households and jobs by zone — and the travel demand forecasting outputs at the corridor level for vehicle miles traveled, transit ridership, and walk/bike trips. The analyst can evaluate proposed transportation projects (a new rail extension, a bus rapid transit corridor, a highway widening, a network of separated bike lanes) for their performance under each scenario, with each project carrying its capital cost, operating cost, environmental impact assessment results, and equity impact analysis. The app supports a structured project prioritization workflow where regional goals (greenhouse gas reduction, housing access, equity, congestion relief) are weighted and projects are scored, with sensitivity analysis on the weights. Participatory plan-making is integrated: every scenario and project carries the public comment record and the response, and the analyst can produce engagement-ready materials at each milestone. The output is the long-range plan document itself, with full traceability from regional goals through scenario analysis to project list, defensible to the federal funding partners, the regional board, and a litigious development community.

Live at [https://vibes.diy/vibe/edu/regional-transport-plan](https://vibes.diy/vibe/edu/regional-transport-plan)

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
