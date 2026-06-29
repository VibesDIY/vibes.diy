# carbon-cycle-flow

> Animated carbon cycle visualizer — a more visual take on the carbon cycle for middle-school earth science. Render six round reservoir bubbles arranged in a circle: Atmosphere, Plants, Soil, Surface Ocean, Deep Ocean, Fossil Fuels. Each bubble is sized in proportion to its current carbon stock and displays the GtC number inside. Between bubbles, animate small carbon particles (tiny dots) flowing along curved paths from source to sink at speeds proportional to the flux rate. Particle direction reverses when flux reverses. The student adjusts two big knobs: "Human emissions" and "Forest cover" (each 0–100%). Above the bubbles show the year (1850–2100, controlled by a Play/Pause/Reset button stepping through years). Below show atmospheric CO2 as a big readout in ppm. Use a friendly palette: pastel blues, greens, browns. Add a "Bookmark this moment" button that saves year + slider settings + ppm as a Fireproof doc; list past bookmarks below as cards. Build in single-file React; use SVG for bubbles and particle animation via requestAnimationFrame in useEffect. Tone: engaging, visual, BBC-Earth–style.

Live at [https://vibes.diy/vibe/jchris/carbon-cycle-flow](https://vibes.diy/vibe/jchris/carbon-cycle-flow)

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
