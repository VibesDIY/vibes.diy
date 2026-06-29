# parabolic-trajectory

> Projectile motion simulator for high school physics. The student adjusts three sliders: initial launch velocity v₀ (1 to 100 m/s, default 30), launch angle θ (0 to 90 degrees, default 45), and gravity g (0.1 to 25 m/s², default 9.81 for Earth, with quick-pick buttons for Moon 1.62, Mars 3.71, Jupiter 24.79). Render an SVG canvas with axes labeled in meters, gridlines every 10 meters. Above the canvas show the live equations: x(t) = v₀·cos(θ)·t and y(t) = v₀·sin(θ)·t − ½·g·t² with current numeric values plugged in. Below the canvas show three computed values updating live as sliders move: maximum height (m), horizontal range (m), and total flight time (s) using the closed-form formulas. As sliders change, redraw the parabolic trajectory as a faint dashed curve. A "Launch" button animates a small ball traveling along the trajectory at simulation speed (use requestAnimationFrame with t scaled to flight-time). Show a velocity vector arrow on the ball during flight, decomposed into horizontal and vertical components. Include a "Save shot" button that stores the slider config + range + height + time as a Fireproof doc with a student-supplied label. List saved shots below in a "Lab notebook" table with columns Label, v₀, θ, g, range, height, time, plus a "Replay" button per row that restores those settings. Single-file React with SVG. Tone: clean physics textbook, monospace numbers, navy + white aesthetic.

Live at [https://vibes.diy/vibe/jchris/parabolic-trajectory](https://vibes.diy/vibe/jchris/parabolic-trajectory)

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
