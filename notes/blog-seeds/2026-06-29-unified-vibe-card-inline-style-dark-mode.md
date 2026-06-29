# When half your component does dark mode and the other half doesn't: inline styles vs utility classes

Source: `claude/vibe-button-dark-mode-glgehz` (PR #2818, second commit) — dark-mode
fix for `UnifiedVibeCard` (the remix/edit overlay that floats over a deployed vibe).

The bug looked impossible at first glance: in OS dark mode the card's suggestion
chips and body text flipped to dark correctly, but the **card surface stayed
white** — a white card holding dark chips and washed-out light text. Half the
component responded to dark mode and half didn't.

The split is mechanical. The chips/text use Tailwind utility classes
(`bg-light-background-01 dark:bg-dark-background-01`, `text-light-primary
dark:text-dark-primary`). In this repo those `dark:` variants are compiled for
**both** triggers — `:is(.dark *)` AND `@media (prefers-color-scheme: dark)` (see
`pkg/generated-tailwind-utilities.css`) — so they flip on OS dark even inside a
deployed-vibe iframe that has no `.dark` class. But the card's surface, the handle
tag, and the dividers are **inline React styles** reading `var(--color-light-*)`
directly. No `dark:` variant can reach an inline style, so those surfaces were
permanently pinned to the light palette. The two halves of the same card were on
two different dark-mode mechanisms, and only one of them fired in the iframe.

The fix avoids restructuring the JSX entirely: scope a remap of the
`--color-light-*` tokens to the dark palette on the card element, under both dark
triggers (`@media (prefers-color-scheme: dark)` and `.dark` ancestor, matching the
utilities). Because the inline styles already read `var(--color-light-background-00)`
etc., redefining those custom properties on the card scope flips every inline
surface at once — and harmlessly reinforces the same values the `dark:` utilities
already set on the class-based elements (both resolve to `#1a1a1a` / `#e0e0e0` /
`#222`). One `<style>` block, one `data-` attribute, zero changes to the markup.

Angles worth a full post:

1. **"Mixed dark-mode mechanisms in one component" is a recognizable smell.** Inline
   styles can't carry a `dark:` variant, so any component that mixes Tailwind color
   utilities with inline `var(--color-light-*)` will dark-mode *partially*. The tell
   is exactly this symptom: chips/text flip, surfaces don't. The cheapest fix is
   usually to remap the tokens at a scope, not to hand-convert every inline style.

2. **Custom-property remapping as a dark-mode adapter.** Instead of editing N inline
   styles, redefine the handful of `--color-light-*` tokens they already read, scoped
   to the subtree. The cascade does the rest. It's the same trick the SSR vibe-controls
   panel uses (PR #2818's first commit) — override the variables, leave the consumers
   untouched — applied to a React component injected into an untrusted iframe where you
   can't rely on the host's `.dark` class.

3. **Verifying dark mode when the screenshot lies.** As with the sibling fix, the cloud
   headless Chromium force-darkens *paint* but not the CSSOM, so I verified with
   `getComputedStyle()` against the real `generated-tailwind-utilities.css` rather than
   pixels. The `.dark`-class trigger exercises the same compiled rules the media query
   does, so a class-toggle harness gives a faithful before/after without fighting
   force-dark.
