---
name: Neobrutalist
colors:
  background: "#f5f0e0"
  card-background: "#ffffff"
  text: "#1a1a2e"
  border: "#1a1a2e"
  muted: "#6b6b80"
  primary: "#DA291C"
  on-primary: "#ffffff"
  secondary: "#fedd00"
  on-secondary: "#1a1a2e"
  success: "#22c55e"
  on-success: "#1a1a2e"
  info: "#3b82f6"
  on-info: "#ffffff"
  primary-light: "rgba(218, 41, 28, 0.1)"
typography:
  h1:
    fontFamily: Space Grotesk
    fontSize: 2rem
    fontWeight: "700"
    lineHeight: 2.4rem
    letterSpacing: -0.02em
  h2:
    fontFamily: Space Grotesk
    fontSize: 1.5rem
    fontWeight: "700"
    lineHeight: 2rem
    letterSpacing: -0.02em
  body-md:
    fontFamily: Space Grotesk
    fontSize: 0.875rem
    fontWeight: "400"
    lineHeight: 1.5rem
    letterSpacing: 0em
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 0.65rem
    fontWeight: "600"
    lineHeight: 1rem
    letterSpacing: 0.15em
  mono:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    fontWeight: "500"
    lineHeight: 1.5rem
    letterSpacing: 0em
rounded:
  sm: 4px
  DEFAULT: 4px
  md: 4px
  lg: 4px
spacing:
  unit: 8px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  container-max: 920px
  gutter: 16px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
    padding: 12px
    height: 40px
  button-primary-hover:
    backgroundColor: "{colors.primary}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
    padding: 12px
    height: 40px
  button-ghost:
    backgroundColor: "{colors.card-background}"
    textColor: "{colors.text}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
    padding: 12px
    height: 40px
  card:
    backgroundColor: "{colors.card-background}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "{spacing.lg}"
  input-field:
    backgroundColor: "{colors.card-background}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 12px
  badge-active:
    backgroundColor: "{colors.success}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
    padding: 4px
  badge-pending:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.label-caps}"
    rounded: "{rounded.sm}"
    padding: 4px
---

## Brand & Style

Neobrutalist Design System. A bold, retro-arcade-inspired neobrutalist theme. Hard edges, chunky black borders, thick offset drop shadows, vivid primary color blocks, and uppercase display typography. The mood is playful and unapologetically loud — "level dashboard" energy: raw, graphic, readable, kinetic. Never pill-shaped, never blurred shadows, never gradients on strokes.

## Colors

The palette is rooted in high-contrast ink on warm canvas with four vivid signal colors.

- **Primary (#DA291C):** "Vibes Red" — primary actions, danger states, hero accents. Always white text on top.
- **Secondary (#fedd00):** "Signal Yellow" — highlights, hover fills, warning states. Always dark ink text on top.
- **Success (#22c55e):** Active/success states, status indicators, toggle-on. Dark ink text.
- **Info (#3b82f6):** Informational accents, modal title bars. White text on top.
- **Background (#f5f0e0):** Warm off-white canvas. Never pure white for the page.
- **Card Background (#ffffff):** Pure white surfaces for cards. Don't tint surfaces.
- **Text (#1a1a2e):** Near-black ink with cool undertone. Same as border — every stroke is bold.
- **Muted (#6b6b80):** Secondary labels, metadata, captions.

## Typography

Dual-font strategy: display + data.

- **Space Grotesk** is the primary typeface for all text, headings, labels, and buttons. Headings are UPPERCASE with tight tracking (-0.02em) and heavy weight (700). Section labels use 0.65rem, uppercase, letter-spacing 0.15em, muted color. Nav/button labels: 0.7-0.8rem, uppercase, letter-spacing 0.05-0.08em.
- **JetBrains Mono** is used for stats, numbers, and tabular data only. It provides a technical, monospaced contrast.
- Load from Google Fonts with `display=optional`. No other external dependencies.

## Layout & Spacing

A single centered column layout. Max-width 920px, padding 3rem 2rem. The content sits above ambient background decorations with position relative and z-index 10.

Spacing is based on an 8px unit. Components use tight internal spacing but generous section gaps.

## Elevation & Depth

Elevation is achieved through **hard offset shadows only**. No blur, no soft shadows, ever.

- **Default:** 4px 4px 0px var(--border) — standard card/surface elevation
- **Small:** 3px 3px 0px var(--border) — chips, badges, small elements
- **Hover lift:** 6px 6px 0px var(--border) — combined with transform: translate(-2px, -2px) for "card pops forward" effect
- **Modal:** 8px 8px 0px var(--border) — highest elevation
- **Pressed:** box-shadow: none + transform: translate(2px, 2px) — object slams back down

Every shadow is a discrete offset block. Nothing uses soft blur.

## Shapes

Tiny corner radius everywhere: 4px. Never pill-shaped. Every primary surface (nav, cards, hero, modal, inputs, buttons) has a solid 3px border in the border color and border-radius of 4px. No gradients on strokes, no thin hairlines.

## Components

### Action Elements

Buttons are uppercase with letter-spacing. Primary button: red background, white text, 4x4 hard shadow. Secondary: yellow background, 3x3 shadow. Ghost: card background, no shadow, gains 3x3 on hover. All buttons lift on hover (translate -2px, -2px + larger shadow) and slam on press (translate 2px, 2px, no shadow). Transitions resolve in 0.15s.

### Containers & Surfaces

Cards have 3px borders, 4px radius, and hard offset shadows. Keep all card backgrounds pure white. Hero cards feature a 6px horizontal accent bar at the top split into four equal color segments: red 0-25%, yellow 25-50%, green 50-75%, blue 75-100%.

### Inputs & Selection

Inputs lift on focus with translate(-2px, -2px) + shadow. Checkboxes: 22x22, 3px border, green when checked. Toggles: 48x26, 3px border, 4px radius, yellow when on, knob translates with 0.2s cubic-bezier overshoot.

### Tables

Full-bleed inside bordered cards. Headers: 0.6rem uppercase, 2px bottom border. Cells: 0.82rem, thin separators. Numeric columns use JetBrains Mono. Row hover fills with yellow instantly.

## Do's and Don'ts

- DO use hard offset shadows on every elevated surface
- DO keep all hovers/presses resolving in <=0.2s
- DO use UPPERCASE for headings and labels
- DO use the four-color system consistently: red=danger/primary, yellow=highlight/warning, green=success, blue=info
- DON'T use blurred shadows ever
- DON'T use pill-shaped elements (border-radius > 4px)
- DON'T tint card surfaces — keep them white
- DON'T use gradients on borders
- DON'T ease slowly — everything snaps
