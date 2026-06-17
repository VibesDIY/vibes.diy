# Composable theme fidelity — recover pre-#2199 output quality without losing live palette swap

Date: 2026-06-17
Status: Design proposed, awaiting review
Issue: VibesDIY/vibes.diy#2356

## Motivation

Since #2199 ("viewmaster canonical tokens"), generated apps look noticeably
worse — washed-out, half-styled, with tokens that visibly got dropped
(`garden-gnome/naxos-historic-tour`, `garden-gnome/story-crossroads`). The
model is not at fault: the composed `design.md` we hand the LLM is itself
broken. Reproduced by running `composeDesignMd()` over all 44 shipped
colorsets (#2356 has the full data):

1. **The LLM-facing `:root` is starved.** `renderTokenDisciplineBlock` renders
   the `:root` with `includeExtras:false`, and `deriveCanonical()` only
   backfills `warning/success/error/neutral/text-disabled` + cross-fills
   `primary↔accent`. It never backfills `background`, `surface`, `border`,
   `text-secondary`, or `secondary`. Most theme palettes were authored with
   bespoke names (`parchment`, `leather`, `brass-*`) that the alias map routes
   into **extras**, which are then stripped. Result: **42 of 44 themes emit a
   `:root` missing core colors**; `desktop` and `neon` emit a `:root` with
   **zero** colors. The model is then told this block is the VERBATIM single
   source of truth and is FORBIDDEN from inventing anything else → unstyled
   surfaces.
2. **Every theme renders generic typography/shape.** Zero of 44 colorsets
   define a `structural:` block, so all 8 structural slots fall to the same
   hardcoded defaults (`system-ui`, `0.5rem` radius, `1rem` spacing). Brutalist
   loses Space Grotesk + 4px corners; aether loses its typewriter fonts; every
   theme collapses to the same rounded sans-serif — while the prose still names
   the real fonts, a contradiction the discipline block resolves *against* the
   theme.
3. **The `classNames` example we show the model is invalid JS.** Keys like
   `text-primary:` / `text-secondary:` / `text-disabled:` are not valid
   unquoted JS identifiers. We hand the model broken code as the pattern to
   imitate.
4. **The discipline block is simultaneously incomplete and maximally strict.**
   It's the last thing the model reads (recency-weighted), bans `bg-[#hex]`,
   `bg-[oklch()]`, named Tailwind utilities, and any non-canonical `var()` —
   so given defects 1–2 the model has no legal way to express backgrounds,
   accents, borders, real fonts, or theme decoration. It under-styles (safe)
   or quietly violates the rules (inconsistent). Both read as "half-done."

Amber's original split #2002 deliberately "kept the LLM-facing format
identical" and still looked good. The regression is entirely in #2199, which
shipped the canonical-only contract for live swap but never populated the data
behind it (the alias migration only *renamed* tokens; it never *completed* the
canonical color set or authored any structural values).

## Goal

Recover pre-#2199 generation quality **while keeping full live palette swap**.
The canonical-only `:root` contract stays — but it must be **complete and
theme-accurate** for every theme, and the prompt must stop fighting the model.

## Non-goals

- Rewriting the viewmaster modal / runtime override pipeline (it already
  publishes the app's real `:root` and remaps utilities — unchanged here).
- Adding new themes or changing the theme catalog.
- Changing the pre-allocation theme-pick LLM call.
- Restyling the platform UI itself (this is purely the codegen prompt + theme
  data).

## Design

Five coordinated changes. (1)+(2) fix the data; (3)+(4) fix the prompt;
(5)+(6) lock it in and prove it.

### 1. Rebuild every colorset from its exemplar (complete canonical + dark + structural)

The exemplar apps in `prompts/pkg/themes/exemplars/<slug>/App.jsx` are the
complete, theme-accurate ground truth — they render correctly and already
express each theme in canonical-aliasable roles. e.g. `aether` exemplar:

```css
:root {
  --bg: #dcbfa6;        /* → background  (the value the current yaml DROPPED) */
  --accent: #cfa562;    /* → accent / primary */
  --text: rgba(20,20,20,0.92);   /* → text-primary */
  --muted: rgba(20,20,20,0.5);   /* → text-secondary */
  --border: rgba(20,20,20,0.14); /* → border */
  --card-bg: rgba(255,255,255,0.85); /* → surface */
  --accent-text: #fafafa;  /* → on-accent (extra) */
}
@media (prefers-color-scheme: dark) { :root { … } }  /* → colorsDark */
```

Add `prompts/scripts/rebuild-colorsets-from-exemplars.mjs` that, for each
slug, parses the exemplar's light `:root` + dark `@media` block, maps old
names → canonical via the existing `TOKEN_ALIASES`, writes a **complete**
`colors/<slug>.yaml`:

- `colors:` / `colorsDark:` — every core canonical slot present
  (`background`, `surface`, `primary`, `secondary`, `accent`, `text-primary`,
  `text-secondary`, `border`) plus state colors where the theme defines them.
- `structural:` — `font-family` from the catalog `bodyFont`, `font-family-mono`
  where the theme uses mono, and `radius`/`radius-sm`/`radius-lg`/`spacing`/
  `border-width` from the theme `.md` frontmatter (`rounded:`/`spacing:`) when
  present, else theme-appropriate values (brutalist → 4px; pill themes →
  larger). No theme keeps the generic defaults unless that genuinely is its
  look.
- `extras:` / `extrasDark:` — genuinely bespoke flourish tokens
  (`on-accent`, `parchment-dark`, `brass-light`, …) preserved for prose
  decoration. With canonical now complete, stripping extras from the LLM
  `:root` is harmless to the core look.

The script is deterministic and re-runnable; its output is the reviewable
artifact (a 44-file diff). Then regenerate `colorsets-bundle.ts` via the
existing bundle step. Where the exemplar `:root` is ambiguous (no clear
`secondary`, or a theme that legitimately has only one surface), fall back to
the composer's derivation (below) rather than inventing a value.

### 2. Harden the composer so it can never emit a starved or invalid block

In `prompts/pkg/themes/colorsets.ts`:

- **`deriveCanonical()` backfills every core slot**, so even an incomplete
  yaml never produces a color-less `:root`:
  - `surface ← background`
  - `secondary ← accent ?? primary`
  - `border ← text-primary ?? neutral`
  - `text-secondary ← color-mix(in srgb, text-primary 60%, background)` (or a
    neutral mid when either is missing)
  - `background`/`text-primary` get last-resort neutral fallbacks so the
    `:root` is never empty (`desktop`/`neon`-class themes).
  This is the safety net; (1) makes it rarely fire, but it guarantees the
  invariant the tests assert in (5).
- **Fix the `classNames` example to be valid JS** — quote the keys (or
  camelCase them): `'text-primary': 'bg-[var(--text-primary)]'`. The example
  must `eval`/parse as valid JS (asserted in tests).

### 3. Rebalance the token-discipline block

Keep the live-swap contract, drop the gag. `renderTokenDisciplineBlock`:

- **Keep:** "route the core palette + structural through the canonical
  `var(--token)` names"; "no color literals inside bracket classes
  (`bg-[#hex]`, `bg-[oklch()]`)"; the verbatim `:root` to copy; the dark-mode
  rule.
- **Change:** soften "copy VERBATIM / FORBIDDEN to add any token" to a positive
  framing: the canonical `:root` is the **swap contract** — express the
  theme's core surfaces/text/actions/borders through it, and you are
  **encouraged** to build richness *on top of* it: gradients, shadows,
  decorative pseudo-elements, and translucency via `color-mix(... ,
  var(--canonical) ...)`. Bespoke flourish values that don't need to swap may
  be inlined locally (not in `:root`). This removes the "no legal way to
  express the theme" trap while keeping the core swappable.

### 4. Re-enrich gutted structural prose (scoped)

Most theme `.md` bodies are 100–200 words vs brutalist's rich,
section-by-section composition. The thin ones lost concrete component recipes
when colors were extracted. Restore concrete, vivid guidance (hero/nav/card
recipes, decoration, interaction) **using canonical `{{token}}` names** for the
weakest themes. Scope/effort is an open question for review (see below) — the
token fixes (1–3) are the primary quality lever; prose is secondary.

### 5. Guardrail validation + tests (the thing that makes it "complete")

Add a `themes` validation (a test + an optional `pnpm --filter
@vibes.diy/prompts themes:lint`) that, for **every** theme in the catalog,
composes the design.md and asserts:

- all 8 core canonical color tokens present in the emitted `:root`
  (`background`, `surface`, `primary`, `secondary`, `accent`, `text-primary`,
  `text-secondary`, `border`);
- all 8 structural tokens present;
- structural is **not** the all-defaults set (catches "every theme is
  system-ui" regressions) — at least font-family or radius differs from the
  generic default for themes that should differ;
- the `classNames` example parses as valid JS (`new Function`);
- no unresolved `{{token}}` placeholders remain in the body;
- light/dark token key sets match when `colorsDark` is present.

This converts the four defects into permanent regression guards.

### 6. Eval before merge

- **Cheap inner loop (no LLM/auth):** run `composeDesignMd()` per theme and
  diff the emitted `:root` before/after — confirm completeness + accuracy.
- **Generation eval:** use `eval/codegen-edit` to drive `cli generate` over a
  small theme-stressing corpus with pinned `theme`/`colorTheme` (the
  historic-tour and story-crossroads shapes are good representatives), render
  the output, and compare against pre-#2199 / #2002-era output. Capture
  before/after screenshots in the PR.

## Why composability is preserved

The app's `:root` still contains **canonical + structural only**, so a
viewmaster palette swap overrides every variable the app uses — full live
swap, unchanged. The difference is that the canonical set is now *complete and
theme-true*, so "swappable" no longer means "stripped of its identity." Extras
stay out of the app `:root` (so they can't block a swap); they live in the
theme prose as decoration the model layers via `color-mix` from canonical.

## Alternatives considered

- **Include extras in the app `:root`** (`includeExtras:true`) — smallest diff,
  fast quality win, but a palette swap then only restyles canonical tokens and
  leaves bespoke ones stuck. Rejected as the primary fix: it trades the live-
  swap guarantee away. (It remains the trivial fallback if rebuilding the data
  proves infeasible.)
- **Decouple codegen from runtime swap** (generate with full richness; enforce
  the canonical contract only in the runtime override) — Amber's "Option 1 +
  2" hybrid. Best long-term separation of concerns but the largest change and
  leans hardest on the runtime utility-remap. Proposed as the north star if
  (1)–(4) can't satisfy both quality and swap; **explicit question for review.**

## Open questions for review (@CharlieHelps)

1. **Data source.** Is rebuilding `colors/<slug>.yaml` from the exemplar
   `:root` blocks the right ground truth, or is there a canonical
   palette source I'm missing (e.g. the pre-#2199 `.md` frontmatter in git
   history, or a Stitch export)? Exemplars look authoritative and re-renderable
   but I want to confirm they aren't themselves generated *from* the current
   (starved) yaml. *(Spot-check says no — aether's exemplar has `--bg #dcbfa6`,
   which the current yaml lacks — but please confirm the exemplar generator's
   input.)*
2. **`secondary`.** Most themes are single-accent. OK to derive
   `secondary ← accent` everywhere rather than inventing a second hue per
   theme? Or should single-accent themes drop `secondary` from the contract
   entirely?
3. **Discipline-block strictness.** Is the "encourage richness on top of the
   canonical contract" reframing the right call, or do we want to stay strict
   (canonical-only, no decoration) and rely on richer prose instead? This is
   the core quality-vs-swap trade.
4. **Prose enrichment scope (task 4).** Worth investing in per-theme prose
   richness now, or land the token fixes first and treat prose as a follow-up?
5. **Architecture.** Stay with "complete canonical contract in the prompt"
   (this spec), or commit to the decouple-codegen-from-runtime architecture
   instead?

## Files touched (anticipated)

- `prompts/pkg/themes/colorsets.ts` — `deriveCanonical` backfill; valid-JS
  `classNames`; discipline-block reframing.
- `prompts/pkg/themes/colors/*.yaml` — rebuilt, complete (44 files).
- `prompts/pkg/themes/colorsets-bundle.ts` — regenerated.
- `prompts/pkg/themes/*.md` — scoped prose re-enrichment (task 4).
- `prompts/scripts/rebuild-colorsets-from-exemplars.mjs` — new, deterministic.
- `prompts/tests/themes.test.ts` (+ a new completeness suite) — guardrails.
- `vibes.diy/pkg/app/components/ColorsetPicker.tsx` — verify the
  regenerate-with-palette path (`renderRootCssBlock({includeExtras:false})`)
  still behaves once canonical is complete (likely no change).
- `eval/codegen-edit/prompts/seed.jsonl` — theme-stressing eval entries.
