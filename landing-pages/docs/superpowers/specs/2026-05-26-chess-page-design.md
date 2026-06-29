# Chess Landing Page — Design Spec

**Date:** 2026-05-26  
**URL:** `/chess`  
**Layout:** `webring` (self-contained, no standard header/footer chrome)

---

## Purpose

Showcase six deployed chess variant apps for chess enthusiasts who want more than standard boards. Target: players who know en passant, enjoy puzzles, are curious about how rules change when the board changes shape or wraps around.

---

## Apps (6 total)

Pull all from the `og` user namespace. Push to `chess` user namespace (no explicit `--app-slug`, CLI auto-generates slug).

| # | Title | Source slug | Improvements |
|---|-------|-------------|--------------|
| 01 | Classic Duel | `exciting-hedgehog-6310` | Pull as-is, push |
| 02 | Toroidal Chess | `indirect-smelt-7561` | Improve wrap-around move visualization; edge-crossing arrows |
| 03 | Hex Chess | `common-fly-2404` | Improve hex click targeting; add coordinate labels |
| 04 | 3D Chess | `advanced-tahr-2423` | Pull as-is, push |
| 05 | AI Match | `vibrant-oshun-8611` | Pull as-is, push |
| 06 | Position Scanner | `industrial-orangutan-3915` | Pull as-is, push |

Skipped (variants collapsed): `confident-baboon-9434`, `round-bat-6533`, `fit-basilisk-8896`, `due-lobster-9961`, `printed-marten-8570`.

---

## Skin: "Tournament Hall"

**Inspiration:** Chess tournament programs, analysis books, classic notation.

```css
--bg:        #1a1a1a   /* near-black */
--sq-light:  #f0d9b5   /* classic light square, warm ivory */
--sq-dark:   #b58863   /* classic dark square, warm brown */
--gold:      #f0d9b5   /* same as sq-light, primary accent */
--ink:       #e8e0d0   /* off-white body text */
--ink-dim:   #a09070   /* muted labels */
--border:    rgba(240,217,181,0.15)  /* subtle warm border */
```

**Typography:**
- Display: `Cinzel` (Google Fonts) — tournament-program serif
- Body/mono: `JetBrains Mono` — notation, move lists, metadata

**Background texture:** 40×40px repeating checker (two `--sq-dark` squares per tile at ~4% opacity) — evokes the board without shouting it.

**Card style:** Dark card (`rgba(255,255,255,0.04)`), `1px solid var(--border)`, `border-radius: 4px`. Screenshot gets a gold top border on hover.

---

## Page Sections

1. **Topbar** — `Vibes DIY` logo left, `CHESS VARIANTS LAB` right in Cinzel small-caps
2. **Crumb** — `Games / Chess` breadcrumb
3. **Hero** — `CHESS VARIANTS LAB` in Cinzel 96px, tagline in JetBrains Mono, two CTAs (play + clone)
4. **App list** — 6 apps, same column layout as college/dating: `[num] [title+desc] [screenshot+CTAs]`
5. **Epilogue** — short copy about remixing/cloning any variant

---

## Frontmatter Schema

```json
{
  "layout": "webring",
  "title": "Chess Variants Lab | Vibes DIY",
  "description": "Six chess variants: toroidal wrapping, hexagonal boards, 3D stacks, AI opponents, position scanner. Clone any and remix.",
  "ogUrl": "https://good.vibes.diy/chess/",
  "source": "chess",
  "apps": [ ... ]
}
```

---

## File Path

`src/pages/chess.hbs`

---

## Workflow

1. Enter git worktree
2. `npx vibes-diy pull <slug>` for each of the 6 source apps → into `vibes/chess/` directory
3. Improve `indirect-smelt-7561` and `common-fly-2404` App.jsx files
4. `npx vibes-diy push --user-slug=chess` each (no `--app-slug`)
5. Verify each deploy has real `fsId` (not "pending")
6. Write `src/pages/chess.hbs` with pushed slugs + chess author
7. `pnpm check` → `open _site/chess.html`
8. Capture OG screenshot → add `ogImage` frontmatter
9. Wire into `index.hbs` and `about.hbs`
10. Commit
