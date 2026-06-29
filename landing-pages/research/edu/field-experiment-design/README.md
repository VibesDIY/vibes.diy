# field-experiment-design

> An academic researcher running an experimental economics lab is designing a multi-wave field experiment to test whether reference-dependent preferences predict labor supply decisions among rideshare drivers better than standard income-targeting models. They need a rigorous experimental design tool that helps them structure the protocol, pre-register hypotheses, and document analytic decisions before data collection begins. Build a professional design app where the researcher specifies the population, the treatment variation (a randomized message manipulating the salience of a daily earnings reference point), the primary outcome (hours worked that day after the message arrives), and the predictions derived from prospect theory and loss aversion under the reference point hypothesis versus the predictions of a standard intertemporal choice model. The app should walk the researcher through specifying the experimental conditions, the randomization design, the sample size justification, and the planned heterogeneity analysis across driver tenure, baseline earnings, and prior-day shortfall relative to a typical reference point. It should support pre-registration of the directional hypotheses: under reference-dependent preferences with loss aversion above the reference, drivers below the reference should work longer; under standard income smoothing, they should work less when wages are temporarily high. The researcher uses the app to draft the IRB protocol section on subject welfare, document how the experimental manipulation respects subjects' bounded rationality (no deceptive content), and pre-commit to the analytic decisions that distinguish a strong test from a confirmatory just-so story. The output is a complete pre-analysis plan, time-stamped, ready for posting to a public registry. The app also supports the post-experiment phase: a structured space for recording deviations from the plan, the reasons, and how the deviation affects the strength of the inference.

Live at [https://vibes.diy/vibe/edu/field-experiment-design](https://vibes.diy/vibe/edu/field-experiment-design)

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
