# projectile-launcher

> Multi-shot projectile motion lab. A more comparative take on projectile motion: the student configures one set of slider parameters (velocity, angle, gravity), clicks "Add shot", and the trajectory is added to a shared SVG canvas as a colored curve. Up to 6 shots can be displayed simultaneously, each in a different color, all drawn on the same axes for direct visual comparison. Each shot is labeled at its peak with its launch parameters. Below the canvas show a comparison table listing every shot with its v₀, θ, g, range, height, flight time. The student can delete individual shots or "Clear all". A "Save lab session" button stores the full set of shots as a Fireproof doc; past sessions are restorable from a dropdown. Encourage exploration: include three preset buttons "Compare angles" (loads three shots at 30°, 45°, 60° same v₀), "Compare gravities" (Earth/Mars/Moon same v₀ and θ), "Match the target" (places a target marker on the canvas; student tunes parameters to hit it). Single-file React with SVG. Tone: more playful than the basic simulator — a physics sandbox.

Live at [https://vibes.diy/vibe/jchris/projectile-launcher](https://vibes.diy/vibe/jchris/projectile-launcher)

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
