# The edit invitation now tells the truth about what happens next

**Hook:** One string was quietly promising visitors a superpower they don't have.

**Source:** `vibes.diy/base/components/UnifiedVibeCard.tsx` — the chips/composer
explainer in the `/vibe` switch card.

**Why:** "Describe a change to edit this app live:" is accurate only for the
owner — that's the in-place codegen lane. For everyone else the same write
forks a copy first ("Making it yours…"), per §2 "Ownership decides, at the
write". The card already received `isOwner` (reserved since the verb-collapse
work, #2679, never wired); the copy now follows the same split: owners get
"edit this app live", everyone else gets "remix your own copy of this app".

**Gotcha:** The unset/undefined case reads as non-owner on purpose. Ownership
resolves async on the route (it starts `false`), so the safe default is the
copy that makes no false promise — a brief remix-flavored flash for the owner
beats telling a visitor they're editing the live app.
