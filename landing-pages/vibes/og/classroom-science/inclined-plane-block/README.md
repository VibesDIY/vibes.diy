# inclined-plane-block

> Inclined plane experiment lab — emphasis on running trials and collecting data, less on the diagram. The simulator shows a simpler ramp (no detailed free-body arrows on the block — just the block on the ramp), but provides rich experimental controls: ramp angle, surface choice (rubber/wood/ice/teflon — each presets a different μ), block mass. The student presses "Run trial" to release the block; the app times its slide and reports the measured acceleration and final velocity at the bottom. After at least 3 trials with varying angles or surfaces, the app generates a scatter plot of acceleration vs angle (or vs μ) so the student can see the relationship. Trials are saved automatically as Fireproof docs into the current "lab session" — the student names the session at the start. The app shows a results table with all trials and their measured values, plus an inferred best-fit line on the chart. Reset button starts a new session. Single-file React; use Chart.js via importmap or just custom SVG for the scatter plot. Tone: data-collection lab notebook, plain chart, stopwatch-clean UI.

Live at [https://vibes.diy/vibe/jchris/inclined-plane-block](https://vibes.diy/vibe/jchris/inclined-plane-block)

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
