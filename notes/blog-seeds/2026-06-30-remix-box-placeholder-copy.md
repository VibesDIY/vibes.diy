# Remix box placeholder: "Make it your own…" → "Describe a change…"

**Hook:** A one-word-vague invitation became a concrete instruction.

**Source:** `vibes.diy/base/components/UnifiedVibeCard.tsx` — the `/vibe` switch
remix input placeholder.

**Why:** "Make it your own…" tells a visitor the *outcome* but not the *action*.
The input wants a sentence describing what to change; "Describe a change…"
prompts that directly, matching the round send button's submit semantics.

**Gotcha:** The same phrase still appears as the "Remix →" heading on the About
page (`landing-pages/src/pages/about.hbs`) and in historical blog copy — those
are intentionally left untouched (heading is a different surface; blog posts are
a dated record of the UI as it was).
