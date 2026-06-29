# zoning-explorer

> A renter in their late twenties just discovered that their city's zoning and comprehensive plans determine why their neighborhood has no corner stores, no apartments, and no bus that runs after 7 PM, and they want a casual introductory tool to understand what their own city's land use regulation actually says. They have heard terms like single-family zoning, missing middle housing, parking minimums, and smart growth but cannot connect them to the official documents that govern their block. Build a playful exploration app where the renter picks their city (or types in their address) and the app walks them through the basics of how land use regulation works: what zoning and comprehensive plans are, who writes them, how they are amended, what each zone designation actually allows on the ground. The app should let them browse a simplified version of their own city's land classification plans, showing what is allowed where, and let them experiment with hypotheticals: what if duplexes were allowed in single-family zones? What if parking minimums were eliminated near transit? It should introduce companion concepts like housing policy, transportation planning, and smart growth, showing how they fit together and where the user's city falls on each. The app should also point to upcoming opportunities for community engagement — the next planning commission hearing, an open comment period on a draft plan amendment, a participatory plan-making workshop in their neighborhood — so the renter sees that the rules they just learned about are actively being rewritten. The goal is not to make them a planner but to give them a coherent map of how the system works, so they can engage with their own city's planning process as an informed resident.

Live at [https://vibes.diy/vibe/edu/zoning-explorer](https://vibes.diy/vibe/edu/zoning-explorer)

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
