# carbon-cycle-visualizer

> Interactive carbon cycle visualizer for high school earth science. Render a clear scientific diagram (using SVG) of the major carbon reservoirs as labeled rectangles laid out spatially: Atmosphere (top), Plants & Forests (mid-left), Soil (bottom-left), Ocean Surface (mid-right), Deep Ocean (bottom-right), Fossil Fuels (far bottom). Each reservoir shows its carbon stock in gigatons of carbon (GtC) as a number that updates live (atmosphere ~870 GtC, plants ~550, soil ~1500, ocean surface ~900, deep ocean ~37000, fossil fuels ~5000). Connect them with directional SVG arrows representing fluxes: photosynthesis (atmosphere→plants ~120 GtC/yr), respiration (plants→atmosphere ~120), decomposition (plants→soil ~60, soil→atmosphere ~60), ocean uptake (atmosphere→ocean ~92), ocean release (ocean→atmosphere ~90), fossil fuel combustion (fossil→atmosphere, slider-controlled), deforestation (plants→atmosphere, slider-controlled). Each arrow is labeled with its current flux rate in GtC/yr. Provide three sliders below the diagram: "Fossil emissions (GtC/yr)" 0–15 default 10, "Deforestation (GtC/yr)" 0–5 default 1.5, "Years to simulate forward" 0–100 default 0. As sliders change, run a simple Euler-step simulation in a useEffect updating reservoirs each year. Show a live readout of atmospheric CO2 in ppm (assume 1 GtC ≈ 0.47 ppm). Use a science-textbook color palette: forest green for plants, ocean blue for oceans, soil brown, gray atmosphere, near-black fossil fuels. Add a "Save scenario" button storing slider values + final reservoir snapshot + ppm as a Fireproof doc with a student-supplied label. List saved scenarios below in a "Lab notebook" panel showing each entry: label, year-end CO2 ppm, emissions setting. Single-file React with useFireproof. Tone: serious classroom tool, clean labeled SVG, no animations beyond optional pulsing arrow tips during simulation.

Live at [https://vibes.diy/vibe/jchris/carbon-cycle-visualizer](https://vibes.diy/vibe/jchris/carbon-cycle-visualizer)

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
