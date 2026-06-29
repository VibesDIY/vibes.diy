# behavior-journal

> A college student took one behavioral economics lecture and walked out convinced their roommate's whole life can be explained by present bias and the endowment effect. They want a casual journaling app where they catalog real-world behavior — their own and other people's — and try to identify which behavioral economics concept best explains each episode. Build a playful self-study app where the student logs a short story: 'My roommate refused to sell her old hoodie for $40 but would not pay $40 to replace it,' or 'I said yes to a gym membership at the start of the month and never went,' or 'My friend chose the smaller-sooner reward instead of waiting two weeks for double.' For each entry, the student picks the concept they think applies — prospect theory, loss aversion, present bias, hyperbolic discounting, bounded rationality, framing effects, reference-dependent preferences, heuristics and biases, social preferences, endowment effect, or intertemporal choice — and writes a one-paragraph defense of why it fits. The app should respond with a brief explanation of what that concept actually predicts and ask the student a clarifying question that probes whether they picked the best fit or just the most famous one. Over weeks of journaling, the app should help the student notice their own pattern recognition — they might be over-applying loss aversion to everything — and surface concepts they have not yet practiced with. Optionally the student can share a story with a friend who is also using the app, letting both of them guess the concept independently and then compare. The point is to build genuine intuition rather than rote memorization for an exam.

Live at [https://vibes.diy/vibe/edu/behavior-journal](https://vibes.diy/vibe/edu/behavior-journal)

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
