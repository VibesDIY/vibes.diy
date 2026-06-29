# fair-deal-builder

> Build an interactive what-if tool called Build Your Own Fair Deal about the Portland Moda Center arena negotiation. Frame: the deal currently on the table returns the public essentially zero — no private capital, no rent, no revenue share, no payment in lieu of taxes, and no relocation penalty. This tool lets the user switch ON, one at a time, the individual deal terms that the same team owner or comparable cities have already agreed to elsewhere, and watch the projected twenty-year public return climb from zero toward roughly 1.1 to 1.2 billion dollars. On first load, seed a Fireproof database named fair-deal-terms with one document per term, using a slug as the _id so seeding is idempotent, with fields: label, lowM (twenty-year value low estimate in millions), highM (twenty-year value high estimate in millions), precedent (a short source note), enabled (boolean, default false), and order (integer for stable sorting). Seed these eight terms: rent, low 121, high 188, precedent Owner pays this in Raleigh plus a Charlotte-style capital reserve, order 1. pilot, low 165, high 330, label Payment In Lieu Of Taxes, precedent Peer-city standard, the building is tax-exempt today, order 2. revenue-share, low 80, high 140, label Premium Revenue Share, precedent 18 percent of gross premium club and naming, peer standard, order 3. parking, low 50, high 100, label Event Parking Share, precedent City takes 30 percent of gross event parking, peer standard, order 4. development, low 150, high 250, label Rose Quarter Development, precedent Ground rent plus property taxes, the owner signed this in Raleigh, order 5. naming, low 40, high 100, label Naming Rights Share, precedent Share arena and district naming, peer standard, order 6. user-fees, low 50, high 50, label Close Ticket-Fee Carve-Outs, precedent Bridge-lease standard, order 7. operator-cash, low 245, high 245, label Operator Puts In Real Money, precedent Peer-average private capital into revenue upgrades, order 8. Render from a live query. The UI: a vertical list of toggle rows, each showing the term label, its precedent note, and its twenty-year value range; toggling a row optimistically flips and persists the enabled boolean in Fireproof. At the top, a large animated running total that sums the low and high values of all enabled terms and displays the result as a range that counts up smoothly when a toggle changes, alongside a progress bar scaled from 0 to 1.2 billion. Below that, a custom animated stacked horizontal bar that adds one colored segment per enabled term, each labelled, so the total visibly grows as terms switch on. Include a SELECT ALL button that enables every term at once and lands the total near 1.1 to 1.2 billion, with a caption contrasting that with the single number on the table today, which is zero. Keep the tone factual and dryly wry. Build all bars and the counter animation by hand with SVG and CSS; do not use any external charting library. STYLE — Civic public-ledger look: ivory paper background, near-black ink, a muted grey for secondary text, and ONE ruby-red accent (#DA291C) reserved for emphasis and current-state markers (the Portland row, the break-even line, the running total). Tabular numbers in a monospace font. Document-like, calm, generous whitespace, thin hairline rules between sections, no clutter. The charts are the hero of the page: make them large, smooth, and clearly labelled with axes, ticks and a legend. Animate on load and on interaction with eased transitions. Fully responsive; tooltips on hover. Single-file React using useFireproof for persistence. Keep all copy factual and dryly wry — never hype, never editorialize beyond a light raised eyebrow. No emojis anywhere.

Live at [https://vibes.diy/vibe/og/fair-deal-builder](https://vibes.diy/vibe/og/fair-deal-builder)

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
