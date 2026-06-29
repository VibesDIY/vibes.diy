# Two render paths for one panel, and the dark-mode token that only got applied on one of them

Source: `claude/vibe-button-dark-mode-glgehz` — adds a dark-mode override block
for the panel buttons in `vibes.diy/pkg/public/vibes-controls/styles.css`.

The vibe switch's expanded settings panel (Logout / Remix / Invite / Home) exists
**twice**: as a React tree (`base/components/VibesPanel.tsx` → `VibesButton`) used
in-app and Storybook, and as a hand-written SSR template + static stylesheet
(`api/pkg/react/components/vibes-control.tsx` + `vibes-controls/styles.css`) that
is what actually ships into a deployed vibe. The two are supposed to look
identical. In dark mode they didn't.

The React `VibesButton` reads *dark-aware* CSS variables
(`--vibes-button-bg-dark-aware`, `…-text-dark-aware`, `…-border-dark-aware`),
which are generated from `semantic.dark.button.*DarkAware` in `theme/tokens.ts`
and flip to `#2a2a2a` / `#e0e0e0` / `#555` under `prefers-color-scheme: dark`. The
SSR stylesheet is a separate, hand-maintained copy of the design tokens — and its
`[data-vibe-panel] button` rule points at the *plain* `--vibes-button-bg` /
`-text` / `-border`, which have **no** dark override. So while the panel card,
labels and neon variant shadows all flipped to dark correctly, the buttons stayed
cream (`#fffff0`) with a near-black border that vanished against the near-black
card. Readable, but jarring and visibly different from the React path.

The fix is three lines in the SSR stylesheet's dark `@media` block, mirroring the
token values. The interesting part wasn't the fix — it was the gotchas around
*verifying* it.

## The headless binary lied about colors

The cloud Chromium (`/opt/pw-browsers/chromium-1194`) has **Auto Dark Mode
force-darkening hard-on**, and it ignored every opt-out I threw at it
(`--disable-features=WebContentsForceDark,AutoDarkMode,ForceDarkMode`,
`--headless=new`, a `<meta name="color-scheme">` declaration). Force-dark is a
*paint-time* filter: it inverts what you see without touching the CSSOM. So every
dark-mode screenshot showed plausible-looking dark buttons that had nothing to do
with the actual computed CSS — a cream button got inverted to dark on screen,
making the *broken* state look *fixed*. Screenshots were actively misleading here.

`getComputedStyle()` is immune to the paint filter, so the reliable oracle was a
DOM probe (`--dump-dom` + a tiny script that serializes computed colors into a
`<pre>`), comparing before/after against the real edited file by extracting its
`@media (prefers-color-scheme: dark)` block and applying it unconditionally. That
gave hard numbers (`rgb(255,255,240)` → `rgb(42,42,42)`) instead of pixels I
couldn't trust.

Angles worth a full post:

1. **Duplicated design systems drift silently.** A typed-token source of truth
   (`tokens.ts`) is only a source of truth for the code that *reads* it. The SSR
   stylesheet is a parallel hand-copy, so every new token (here, the dark-aware
   button trio) has to be applied in two places or one path quietly regresses.
   Is the right long-term fix to *generate* `vibes-controls/styles.css` from the
   same tokens the React side uses, the way `global-styles.ts` already does?

2. **When the screenshot tool is the unreliable narrator.** Force-dark inverts
   paint but not CSSOM, so a luminance-normalizing filter makes broken and fixed
   dark modes look the same. Worth writing down "verify dark mode with computed
   styles, not pixels, on any browser you don't control the force-dark setting
   on" — it's a non-obvious trap that wastes a lot of time looking at convincing,
   wrong images.
