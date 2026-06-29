# ramp-friction-sim

> Inclined plane with friction — high school physics simulator. Render an SVG scene with a wedge-shaped ramp on the left rising to an angle the student controls, and a horizontal floor. A small block sits on the ramp surface. Three sliders control: ramp angle θ (0 to 60 degrees, default 30), coefficient of kinetic friction μ (0 to 1, default 0.3), and block mass m (1 to 20 kg, default 5). Draw a free-body diagram on the block with four labeled SVG arrows: gravity (vertical, magnitude m·g), normal force (perpendicular to ramp, magnitude m·g·cos θ), kinetic friction (along ramp opposing motion, magnitude μ·m·g·cos θ), and net force along ramp (magnitude m·g·sin θ − μ·m·g·cos θ when sliding). Each arrow shows its magnitude in newtons next to it. Above the canvas, render the algebra symbolically with current numerical values: "Net force = m·g·sin θ − μ·m·g·cos θ = X N" and "Acceleration a = g·(sin θ − μ·cos θ) = Y m/s²". Below the canvas, label the current state: "STATIC" (block at rest, friction balances gravity), "SLIDING" (block accelerating), or "BORDERLINE" (very close to threshold). A "Release block" button animates the block sliding down with the correct acceleration in real time, showing a live velocity readout. The block stops at the bottom of the ramp; show its final velocity. Add a "Save trial" button to persist current config + final velocity as a Fireproof doc; list trials in a "Lab notebook" table below with a Replay button per row. Single-file React with SVG. Tone: physics-textbook clean, graph-paper background, sharp arrow heads, monospace force labels.

Live at [https://vibes.diy/vibe/jchris/ramp-friction-sim](https://vibes.diy/vibe/jchris/ramp-friction-sim)

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
