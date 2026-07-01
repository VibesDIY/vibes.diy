# The chip that cleared its own feedback

**Hook:** Our suggestion chips had a perfectly good pressed-state spinner — and
a comment directly underneath that said `// Return false so OptionButtons
clears the press`. The feedback wasn't missing; we were deliberately deleting
it one frame after the click.

**Source:** /start tree follow-up (PR after #3006): clicked chips on the vibe
card gave zero feedback while the cached-suggestion lookup + cross-slug
navigation ran (visible seconds for an anonymous visitor on a starter vibe).

**Why it was there:** the `return false` was right when every chip led to
in-place codegen — the streaming overlay took over instantly, so a locked
button was just in the way. Then chips learned to navigate (the curated spine),
and the old assumption became a dead click window.

**The fix shape:** the handler now returns a promise on the async path and the
card forwards it — the chip holds an animated "working" sweep (a faint gradient
drifting across the button, `prefers-reduced-motion`-gated) until the
navigation actually completes (`await navigate(...)`), then releases. Sync
paths keep the instant-release behavior. One contract: resolve `false` when
your own feedback takes over.

**Worth saying:** feedback removed on purpose for lane A becomes feedback
missing by accident when lane B arrives. The comment saved the archaeology.
