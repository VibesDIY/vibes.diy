# recipe-crowd-multiplier

> Build a single-file React app called Recipe Crowd Multiplier. Use Fireproof via useFireproof from 'use-fireproof' so saved recipes persist and sync across devices. Top: a big textarea where the user pastes a recipe (assume base 4 servings), and a number input 'I'm feeding ___ people'. Parse each line for quantity + unit + ingredient using a regex covering decimals, fractions (1/2, 1 1/2), cups, tbsp, tsp, oz, lb, g, ml. Multiply by feeding/4 and re-round sensibly: convert decimals back to nearest common fraction (¼, ⅓, ½, ⅔, ¾) so '2.67 cups' renders '2¾ cups'. Show two side-by-side panels: left = original parsed recipe, right = scaled recipe with rounded amounts highlighted. A 'Shopping List' button below produces a clean printable list grouped by ingredient with totals. Save current recipe as doc { type:'recipe', text, servings, scaledFor, createdAt } via a 'save' button; show a sidebar list of saved recipes to reopen. Warm cookbook tone, serif type, ivory paper background.

Live at [https://vibes.diy/vibe/og/recipe-crowd-multiplier](https://vibes.diy/vibe/og/recipe-crowd-multiplier)

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
