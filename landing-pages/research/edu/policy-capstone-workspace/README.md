# policy-capstone-workspace

> A graduate policy workshop at a school of public affairs runs in teams of 4-5 students, each team working with a real client agency on a year-long capstone project that produces a formal policy memo with a quantitative analysis. The teams need a coordination app for the iterative work of policy analysis — sharing drafts, debating assumptions, and tracking the inputs that go into the final recommendation. Build a team coordination app where each capstone team has a project page that starts with the client's problem statement, the policy alternatives under analysis (typically 3-5), and a structured stakeholder analysis identifying whose interests are at stake. Team members can divide up the analytic work: one teammate scopes the cost-benefit analysis for each alternative, another conducts the risk analysis methods workup, another runs the multi-criteria evaluation comparing alternatives across non-monetized goals, another handles the optimization modeling if the problem has a constrained-choice structure. Each component lives in its own section with documented assumptions and the team's debate over those assumptions in threaded comments — Is this social discount rate defensible? Whose willingness to pay are we measuring, and is that consistent with the agency's equity commitments? What shadow pricing approach are we using for ecosystem services? The app should support the iterative drafting of the policy memo with version history, and produce a structured table of every assumption underlying the analysis so the client agency can see exactly what the team did. Teams can compare their memo structure to anonymized exemplars from past workshops, and the workshop faculty can leave milestone reviews. After the final presentation, the project artifacts are preserved as the team's professional portfolio and the program's institutional memory.

Live at [https://vibes.diy/vibe/edu/policy-capstone-workspace](https://vibes.diy/vibe/edu/policy-capstone-workspace)

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
