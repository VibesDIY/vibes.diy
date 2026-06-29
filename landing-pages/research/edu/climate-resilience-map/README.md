# climate-resilience-map

> A neighborhood climate resilience group of about 40 members is forming in a coastal community that has experienced repeated flooding events and a brutal heat wave last summer. The group wants a shared coordination workspace to organize collective action and prepare the community for compounding climate risks rather than waiting for government to lead. The membership is mixed: longtime residents, recent transplants, a couple of climate scientists, a retired city planner, several local renters and homeowners worried about insurance and affordability. Build a community coordination app where members can map the climate vulnerability assessment of their own block: which homes lack air conditioning, which residents have mobility issues that would slow evacuation, which intersections flood routinely, which streets have no tree canopy and become heat islands. Members contribute their observations to a shared block-by-block picture, and the group leadership can use it to plan focused climate adaptation strategies — a cool-room buddy network for the next heat wave, a sandbagging mutual aid team for predicted flood events, a tree-planting campaign for the worst heat-island blocks. The app should let the group discuss climate justice considerations honestly: who in the neighborhood is bearing the most climate risk, and is that pattern reflecting environmental racism in past planning decisions? It should provide a space for collective drafting of public comments on city resilience plans, with the working draft visible to all members, and a calendar for upcoming city council meetings and community workshops. The group should be able to share a public-facing version of its climate vulnerability assessment map with elected officials and request specific adaptation interventions, while keeping individual-household details private. Over time the workspace becomes the institutional memory of the group's actions, learnings, and the community changes they have driven.

Live at [https://vibes.diy/vibe/edu/climate-resilience-map](https://vibes.diy/vibe/edu/climate-resilience-map)

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
