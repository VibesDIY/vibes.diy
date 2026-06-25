# iter-7 — "ownership = the object graph; reinvest in open-join" (human-guided big change)

**Decision rule (user):** treat this as the **new baseline** — keep unless scores fall _dramatically_,
then refine the preamble in iter-8. So this is NOT judged by the +0.06 eval rule.

## What changed (net diff vs iter-3 base = main)

1. **Removed every owner-published mention** — enrichment (`prompts.ts` platform paragraph + Sentence-3)
   and `system-prompt-initial.md` ("read the blog"; the whole blog/announcements → `requireRole("owner")`
   recipe paragraph). Owner is no longer a salient shape.
2. **Object-graph ownership** replaces it: ownership = authorship (`doc.authorHandle`, `oldDoc`-checked);
   no broadcaster default; single-writer is "a rare exception, not a starting point." The reserved
   `owner` role is mentioned exactly **once** (the roles/channels paragraph); never `user.isOwner`.
3. **Reinvested the freed budget into open-join (the hardest case):**
   - **Converted the canonical example `access.js`** from an owner-manages-channels board to the full
     **open-join per-object recipe** (object channel + creator self-grant + `requireAccess` any-child +
     member `share` + `request`-to-join with no `requireAccess` + write-once creator).
   - Expanded the per-object prose with the open-join cues + the **two traps** our failures found:
     don't build it as an open public feed (author-owned), don't gate it behind a single writer.
4. **Per-visitor private** made explicit (the iter-6 mechanism that worked): per-user channel + self-grant,
   "never route these to one shared channel." Removed "board" from the author-owned list (it's per-object now).
5. `oldDoc` author-immutability woven through each recipe (Charlie).

## Watch-items when judging (keep unless dramatic)

- `blog` (owner-published): **expected to drop** — the frozen grader still wants owner-gating there; isolated/accepted.
- **`board` (open-join)**: the target — expect the per-object shape to finally stick.
- `todo` (per-visitor): expect ↑ from the explicit private channel.
- **Blast-radius watch (example conversion):** `photo`/`guest` (author-owned) and `team` (multi-tier)
  must not get dragged into per-object membership. A dramatic crater here = revert.
- **holdout** = the real generalization signal.
