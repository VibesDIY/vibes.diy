# nudge-pipeline

> A behavioral interventions team inside a large workplace wellness vendor designs and pilots dozens of small behavioral nudges per year for client employers — retirement contribution defaults, health screening reminders, choice architecture around benefits enrollment, savings prompts at payroll moments. The team needs an operational workflow tool for the recurring intervention pipeline because right now design decisions live in scattered Google docs and pilot results are forgotten by the time the next intervention is queued. Build a workflow app where each intervention starts as a one-page design brief: the target behavior, the population, the behavioral mechanism the team is leveraging (drawing explicitly from prospect theory, loss aversion, present bias, hyperbolic discounting, framing effects, nudge theory, reference-dependent preferences, social preferences, or default effects), the predicted direction of the effect, and the metric of success. The team then drafts the actual nudge content — message variants, decision moment, channel — and the brief moves through stages: design, internal review, client review, pilot launch, evaluation, scale decision. Each stage has structured prompts: in review, a colleague checks whether the intervention is consistent with the stated mechanism or accidentally invokes a different one; at evaluation, the team logs the measured effect size, any heterogeneity by subgroup, and any signs of unintended consequences such as backfiring on a group with different reference-dependent preferences. The app should maintain an institutional memory of every past intervention indexed by behavioral mechanism, so when the team is designing the next savings nudge they can browse the history of every savings intervention they have run and what worked. The team lead should be able to see at a glance which mechanisms the team has been over-relying on (suggesting bounded rationality blind spots in the design team itself).

Live at [https://vibes.diy/vibe/edu/nudge-pipeline](https://vibes.diy/vibe/edu/nudge-pipeline)

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
