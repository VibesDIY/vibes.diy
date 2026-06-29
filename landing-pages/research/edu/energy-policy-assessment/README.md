# energy-policy-assessment

> A climate analyst at a state environmental agency is leading the technical analysis behind a proposed update to the state's energy transition policy package — a portfolio of mitigation strategies including a carbon pricing mechanism, a clean electricity standard, a building electrification incentive, and a transportation electrification program. They need a serious analytic app that helps structure the multi-policy assessment with the rigor the agency's economists and the state legislature will demand. Build a professional assessment app where the analyst defines each candidate policy with its design parameters and scope. For each policy, the analyst documents the greenhouse gas emissions reduction pathway it is expected to drive, the timeline, the affected sectors and populations, and the assumed costs. The app supports a structured life cycle analysis for the policies whose impact depends on supply-chain emissions (e.g., the electrification incentives turn on the assumed grid mix and the embodied emissions of replacement equipment). Climate justice and environmental racism considerations are first-class: for each policy the analyst documents the distributional impact on frontline communities, low-income households, and historically disinvested neighborhoods, with both quantitative metrics and qualitative narrative. Climate vulnerability assessment data is layered in so the analyst can map proposed adaptation funding against measured vulnerability. The app supports comparing policy packages — a more aggressive carbon pricing mechanism with weaker complementary policies versus a moderate price with stronger sectoral mandates — and surfacing the tradeoffs in emissions, equity, fiscal impact, and political feasibility. The output is a multi-chapter analytic report ready for legislative briefing and public comment, with full sourcing for every assumption and a structured uncertainty discussion. Every analytic decision is logged so the analysis is defensible at hearings and reproducible by a successor analyst.

Live at [https://vibes.diy/vibe/edu/energy-policy-assessment](https://vibes.diy/vibe/edu/energy-policy-assessment)

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
