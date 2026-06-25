# iter-6 predict-gate — GO (per-visitor recipe completeness; lower-risk than iter-5)

**Change:** `system-prompt-initial.md` per-visitor guidance (line ~82) — make the two missing recipe
elements explicit for todo/habit/journal/notes/budget apps: route each doc to a per-user channel
(`user:` + handle) **and self-grant that channel** (`grant: { users: { [user.userHandle]: ['user:' +
user.userHandle] } }`), with an explicit "never route these to a shared/public channel" warning.

**Why (diagnosed, not guessed):** across the iter-3 base, **12/12 failing `todo` cells have the
authorHandle create + oldDoc immutability checks but miss BOTH `perUserChannel` and the `grant.users`
self-grant** — i.e. the model builds todo as author-checked-but-shared, not per-user-private. `habit`
(also per-visitor) already passes, so the recipe is achievable; making the two missing pieces explicit
should pull `todo` toward it.

## 5-lens

1. **Architect (75):** targets a 100%-consistent gap with concrete code; the passing `habit` proves the
   recipe works. High mechanism confidence.
2. **Devil's advocate (55):** risk of spurious per-user channels on apps that shouldn't be private.
   Scoped to per-visitor app types (todo/habit/journal/notes/workout/budget); board/shop/guest/photo
   aren't in that list. **Watch board/shop/guest don't sprout per-user channels.**
3. **Reliability / holdout (60):** per-visitor holdout prompts (h-notes, h-water) should benefit;
   **watch `habit` (already passing) doesn't break** from more prescriptive guidance.
4. **Signal/noise (50):** per-visitor = 2 eval prompts; `habit` already passes, so the gain is bounded
   by `todo` (~+0.05–0.07). Tight vs the 0.8475 keep bar; holdout per-visitor lift may help. Run 3
   batches, confirm if near the edge.
5. **Correctness (70):** prompt-only; the self-grant is the correct per-visitor isolation.

**Lesson applied from iter-5:** that backfired by over-phrasing the _enrichment_ (volatile layer). iter-6
edits the _system-prompt recipe_ (where the shape is already correct — it's a completeness gap), and the
change is additive + concrete. **Verdict: GO**, tight margin, watch habit + non-per-visitor dims.
