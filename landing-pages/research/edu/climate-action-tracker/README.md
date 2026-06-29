# climate-action-tracker

> A sustainability program manager at a mid-sized municipality runs the recurring workflows behind the city's climate action plan implementation: tracking progress against the city's greenhouse gas emissions reduction targets, coordinating the annual community greenhouse gas inventory, managing the portfolio of active mitigation strategies and adaptation projects, and producing the annual sustainability assessment report the council requires. The current process lives across spreadsheets, shared drives, and individual department contacts, and important context evaporates between annual cycles. Build an operational workflow app where the city's climate policy frameworks are the spine — emissions reduction targets by sector (buildings, transportation, waste, electricity supply) and resilience targets by hazard (heat, flood, drought, wildfire smoke) — and every active project is tagged to the targets it serves. For each project the manager logs the project lead in the relevant department, the expected emissions or vulnerability impact, the timeline, the budget, and the status. The annual greenhouse gas inventory workflow walks the manager through pulling data from each sector source, applying the city's chosen accounting protocol, computing the sectoral and total emissions, and producing the comparison-to-target chart. The annual climate risk assessment workflow steps through updating hazard exposure data, refreshing climate vulnerability assessment for priority populations, and updating the climate adaptation strategies portfolio. The app should support carbon pricing mechanism design if the city is considering one, walking through revenue projections, equity impact, and a stakeholder engagement plan. Every report the manager produces — for the council, for state filings, for the regional climate compact — pulls from the same underlying records, so consistency is automatic. The workflow also tracks community engagement obligations under climate justice commitments, ensuring frontline community voices are documented in the planning record.

Live at [https://vibes.diy/vibe/edu/climate-action-tracker](https://vibes.diy/vibe/edu/climate-action-tracker)

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
