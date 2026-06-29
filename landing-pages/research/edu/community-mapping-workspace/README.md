# community-mapping-workspace

> A neighborhood organizing committee is preparing testimony for a city council hearing about a proposed bus route restructuring and wants a shared workspace where members can collect and discuss the spatial evidence they think the council should see. The committee includes a retired transit planner, three regular bus riders, a parent who walks kids to a school the proposed route would no longer serve, and a small business owner. They need a coordination app where members can each contribute spatial observations and the committee can stitch them together into a coherent argument. Build a community mapping app where a member can drop a pin on a location and write up what they observe — a bus stop with broken shelter, a stretch where the proposed reroute would force a long walk along a street with no sidewalk, a school dismissal location that depends on the current route — and tag it with the relevant concern. The committee should be able to lay these observations on top of city-provided base layers and conduct simple network analysis from key locations like the elementary school: how does walking time and transfer count change under the current route versus the proposal? Proximity analysis around each major destination shows what fraction of which census blocks are within 10-minute access today and under the proposal. Members can comment on each other's pins, draft a collaborative narrative about the equity implications using urban data visualization that anyone in the group can revise, and produce a public-facing version of the map for the council hearing. The app should also support generating a brief packet of cartographic representations the committee can hand to council members, with each map captioned and sourced from the underlying observations.

Live at [https://vibes.diy/vibe/edu/community-mapping-workspace](https://vibes.diy/vibe/edu/community-mapping-workspace)

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
