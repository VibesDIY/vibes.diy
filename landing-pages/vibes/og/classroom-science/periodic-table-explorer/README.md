# periodic-table-explorer

> Interactive periodic table of the elements for high school chemistry. Render a full 18-column × 7-row periodic table grid using CSS grid (place lanthanides and actinides in their conventional spots below the main grid). Each element cell shows: atomic number (small, top-left), element symbol (large, centered), element name (small, below symbol), atomic mass (small, bottom). Color-code cells by category: alkali metals (red), alkaline earth (orange), transition metals (gold), post-transition metals (light gray), metalloids (yellow-green), nonmetals (green), halogens (teal), noble gases (purple), lanthanides (lavender), actinides (pink). Render a small color-coded legend below the table. When the student clicks any element, slide in a detail panel from the right showing: full name, symbol, atomic number, atomic mass, electron configuration (e.g., "1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d¹⁰ 4p⁵"), group and period, state at room temperature (solid/liquid/gas/synthetic), discovery year, and one fun fact (1–2 sentences). Hard-code accurate data for at least the first 36 elements (H through Kr). For elements 37+, show a placeholder cell with just symbol + atomic number. Add a search field above the table that highlights matching elements as the student types (by name, symbol, or number). Save "elements visited" as a Fireproof doc per session — show a "Lab notebook" panel below with the list. Single-file React. Tone: clean educational tool, accessible colors with sufficient contrast, large click targets suitable for tablets.

Live at [https://vibes.diy/vibe/jchris/periodic-table-explorer](https://vibes.diy/vibe/jchris/periodic-table-explorer)

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
