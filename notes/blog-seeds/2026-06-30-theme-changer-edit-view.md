# Moving the theme changer from Settings to the Edit card

Source: `claude/theme-changer-edit-view-3rxz9i`

The new `/vibe` editor had inherited a thin version of theme-changing: a plain
`<select>` dropdown buried in the Settings tab. Meanwhile the legacy `/chat`
route still carried the *good* version — the visual structural-theme grid
(`ThemePickerModal`) plus the live palette/token editor (`ColorsetPicker`) sitting
right above the composer, with instant `pushColorOverride` recolors and a
regenerate-with-palette flow. This PR brings that whole component tree into the
new edit experience and drops the `<select>` from Settings.

The interesting part was the seam. On `/chat`, the theme handlers drove the
textarea through a ref — `setPromptIfEmpty("Please update the theme")` then
`clickSubmit()`. The `/vibe` card's composer (`UnifiedVibeCard`'s `OtherRow`)
owns its own input and exposes no ref, so the same handlers re-target the
in-vibe generation hook directly (`generation.sendPrompt(...)`) after the theme
lands in `app_settings`. Same UX (persist → restyle turn), different submit
plumbing. The shared button+picker cluster got extracted into a `ThemeControls`
component so both surfaces render identically, and `UnifiedVibeCard` gained a
single `composerControls` slot that rides *inside* the chips region — so it's
hidden+inert during a streaming turn for free.

Two things worth a fuller post: (1) the controls are owner-gated, because in the
new model a non-owner's edit forks and a non-owner can't persist settings — so
"who sees the theme changer" follows the same write-lane logic as the chips; and
(2) the imported-`.md` custom-theme path is the one place the surfaces diverge —
without a textarea to carry the design.md, a non-catalog theme updates the button
state but doesn't auto-fire a turn (catalog themes, the main path, persist +
regenerate correctly).
