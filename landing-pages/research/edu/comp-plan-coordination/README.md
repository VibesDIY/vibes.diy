# comp-plan-coordination

> A neighborhood association is preparing for the city's once-in-a-decade comprehensive plan update and the board wants a shared workspace to organize community engagement across the year-long process. The association represents about 800 households and wants real participatory plan-making rather than the usual two-meeting consultation. Members include a mix of homeowners, renters, small business owners, parents with school-age kids, retirees, and a few professional planners who happen to live in the area. Build a coordination app where the association can run its parallel community process. The board lays out the planning topics that will be addressed in the comprehensive plan — housing policy, transportation planning, parks and open space, economic development, environmental impact assessment, urban growth management — and creates a working group for each. Members sign up to working groups based on interest, and each group can hold its own discussions, draft position papers, and propose neighborhood priorities. The app should help the association document the diversity of voices contributing — who is showing up, who is not, where outreach needs to be expanded — and support multiple modes of engagement: synchronous workshops, asynchronous comment threads, and lightweight surveys for residents who cannot attend meetings. Each working group's outputs roll up into a draft neighborhood position document on the comprehensive plan, which the full membership can comment on before the board adopts it. The app should also track every official city engagement opportunity, schedule speakers for hearings, and produce talking points for residents who want to testify. After the city adopts the new plan, the workspace preserves the association's positions, the city's responses, and the final language, becoming the institutional memory for the next plan cycle.

Live at [https://vibes.diy/vibe/edu/comp-plan-coordination](https://vibes.diy/vibe/edu/comp-plan-coordination)

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
