# causal-design-workshop

> A graduate student instructor is teaching a quarter-long undergraduate seminar on causal inference and needs a recurring tool for managing weekly problem sets that ask students to identify, set up, and critique causal designs. Each week the instructor posts a real-world scenario — a school district that rolled out a tutoring program in some buildings before others, a state that raised its minimum wage at a known date while neighboring states did not, a hospital that admitted patients above a clinical threshold to an intensive program — and students must work through a structured workflow. Build an operational app that takes the scenario text and walks each student through naming the treatment, defining the outcome, articulating the population of interest, drawing the directed acyclic graph they believe represents the data-generating process, picking the appropriate design from a menu of regression discontinuity design, difference-in-differences, instrumental variables, panel data methods, two-stage least squares, propensity score methods, matching estimators, or synthetic controls, and stating the identifying assumption their chosen design requires. The student then writes a short paragraph defending why the assumption is plausible in this case and what would break it. The instructor needs a separate view that aggregates the class responses so they can see which designs students gravitated toward, where the class was split, and which assumptions were articulated weakly. Each scenario should support re-submission after class discussion so students can revise their reasoning, with versioning preserved. The instructor should also be able to mark exemplary answers (with student permission) and surface them in next quarter's library so the same scaffolding can be reused across cohorts.

Live at [https://vibes.diy/vibe/edu/causal-design-workshop](https://vibes.diy/vibe/edu/causal-design-workshop)

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
