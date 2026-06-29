# household-carbon-explorer

> A teenager who just watched a documentary about climate change wants to understand which of their own household behaviors actually matter for greenhouse gas emissions and which are basically symbolic, and they want a casual exploration tool rather than a guilt-inducing carbon calculator. Build a playful explorer app where the teenager logs the rough shape of their household — number of people, transportation patterns (car miles per week, flights per year, transit), home heating and electricity, diet patterns, big-ticket goods purchased per year — and the app walks them through a simplified life cycle analysis of each category, showing the order-of-magnitude greenhouse gas emissions associated with each. The app should help them see, for instance, that one transatlantic flight outweighs a year of careful recycling, or that home heating dominates in some climates and transportation in others. The teenager can play with hypothetical changes — what if I went vegetarian? what if my family switched to a heat pump? what if I biked to school? — and see how the household's footprint shifts. The app should introduce climate change vocabulary as it comes up: mitigation strategies versus climate adaptation strategies, the difference between a carbon pricing mechanism and a behavioral choice, why some actions are individual and others depend on broader energy transition policy. Crucially the app should also be honest about what individual action cannot do alone — most household emissions are downstream of the electricity grid mix, building codes, and transportation systems, so a section frames the teenager's individual choices alongside the kinds of policy advocacy that could change the system they are embedded in. The output is not a guilt score but a coherent personal picture of where their emissions actually come from.

Live at [https://vibes.diy/vibe/edu/household-carbon-explorer](https://vibes.diy/vibe/edu/household-carbon-explorer)

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
