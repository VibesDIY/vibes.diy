# arena-breakeven-timeline

> Build an interactive data visualization called The Payback Clock about the proposed public renovation of the Portland Moda Center arena. It answers one question for a taxpayer: if the public commits roughly 1.02 billion dollars over twenty years, and the arena returns only a limited amount of tax-and-fee revenue each year, how many years until the public breaks even, and does the twenty-year lease even last that long. On first load, seed a Fireproof database named payback with a single configuration document whose _id is assumptions, holding these fields: publicCostM 1020 (total public commitment in millions), leaseYears 20, returnLow 17.9 (annual tax revenue actually identified, in millions), returnHigh 29 (tax plus user and parking fees, in millions), renoOnlyCostM 600, renoOnlyPayback 21. Render everything from a live query of that database so the numbers are data-driven. The centerpiece is a large animated chart over a horizon of 0 to 40 years: a cumulative public-cost reference line at the committed total, and a cumulative-return line that climbs each year by the chosen annual return, filling the area between them so the gap is visible. Draw a vertical rule at year 20 labelled LEASE ENDS, and a marker at the break-even crossing where cumulative return finally equals the public cost. Provide a slider for the annual-return assumption ranging from returnLow to returnHigh; as the user drags it, smoothly recompute and animate the return line and the break-even year, which lands around year 35 at the high assumption and much later at the low one. Show a bold headline that updates live, for example BREAK-EVEN: YEAR 35 — BUT THE LEASE ENDS AT YEAR 20. Include a toggle that switches the comparison to the renovation-only figure of 600 million, whose break-even is about year 21, so the reader can see even the smaller number outlasts the lease. Label everything clearly as based on the city VSG study and campaign figures, and keep the copy factual, calm, and dryly wry rather than alarmist. Mark the area where cumulative return is still below cost in a neutral tone and use the ruby-red accent only for the break-even and lease-end markers. Build the chart by hand with animated SVG; do not use any external charting library. STYLE — Civic public-ledger look: ivory paper background, near-black ink, a muted grey for secondary text, and ONE ruby-red accent (#DA291C) reserved for emphasis and current-state markers (the Portland row, the break-even line, the running total). Tabular numbers in a monospace font. Document-like, calm, generous whitespace, thin hairline rules between sections, no clutter. The charts are the hero of the page: make them large, smooth, and clearly labelled with axes, ticks and a legend. Animate on load and on interaction with eased transitions. Fully responsive; tooltips on hover. Single-file React using useFireproof for persistence. Keep all copy factual and dryly wry — never hype, never editorialize beyond a light raised eyebrow. No emojis anywhere.

Live at [https://vibes.diy/vibe/og/arena-breakeven-timeline](https://vibes.diy/vibe/og/arena-breakeven-timeline)

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
