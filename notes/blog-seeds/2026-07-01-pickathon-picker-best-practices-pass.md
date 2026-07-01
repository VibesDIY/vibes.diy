# Refining a real vibe against its own system prompt — the Pickathon Picker pass

- **Branch / PR:** `claude/pickathon-picker-refinement-9dygz6`
- **Hook:** We took a shipped, non-trivial vibe (`og/pickathon-picker` — a
  multi-file festival scheduler) and reviewed its source against the _composed_
  codegen system prompt (`npx vibes-diy system`), then fixed the deviations and
  redeployed to a staging handle (`garden-gnome/pickathon-picker`). Interesting
  because it's the codegen guidance used as a _lint spec for hand-maintained vibe
  source_, not just as a generator prompt.

## What changed

Five findings fixed (emoji/glyph findings deliberately left for a later pass):

1. **`&amp;` in the UI** — the Pickathon feed (`schedule.php`) returns
   HTML-entity-encoded titles ("Outdoor Skills &amp;amp; Games"). They were stored
   and rendered as text, so the literal `&amp;` showed up in event cards. Fixed
   with a one-pass `decodeEntities` (textarea `.innerHTML`→`.value`) applied at
   ingest to `title` and `venueTitle` — decode once on the way in, not per render.
2. **Write-gating moved from `useViewer().can("write")` → `useVibe("pickathon").can`.**
   The prompt is explicit: `useViewer()` is identity/display only; the write gate
   is `useVibe(dbName).can`, which runs the app's own `access.js` (the same fn the
   server enforces). Representative draft: `can.create({ type: "favorite", userId }).ok`,
   guarded on `ready`.
3. **Dropped the app's own header `<ViewerTag>` pill.** The current viewer's pill
   and sign-in are system chrome in the Vibes Switch — an app shouldn't paint its
   own. `ViewerTag` stays imported (still used to render _other_ users in the
   Friends/Favorites rosters).
4. **Raw bracket colors out of JSX** — the delete-`×` button had inline
   `bg-[#B22222] …` in `className`; moved to a `c.deleteX(pending)` token in
   `styles.js`, matching the existing `c.navBtn(active)` function-token pattern.
5. **`access.js` unknown-type fall-through** `return {}` → `throw { forbidden:
   "unknown document type" }`. Both reject (a no-channel result is an unreadable
   write), but the throw is the documented pattern and surfaces a clear error.

## Gotcha worth a post

The repo copy and the deployed copy were **byte-identical** for every code file —
the only diff was `RUNBOOK.md` table whitespace, where the repo copy was the
prettier-formatted one. So "pull the deployed version over the repo" would have
been a _downgrade_. The lesson: `pull` round-trips top-level files including docs,
so a naive "take prod" can clobber locally-improved non-code files. Diff first,
keep the better copy per-file.

Also worth noting: the composed system prompt currently ships a **Neobrutalist**
theme block, but this vibe is the original rounded lime/green Pickathon look. The
mismatch is harmless for hand-edits, but a `vibes-diy edit` follow-up would try to
repaint it — a reminder that theme blocks in the prompt are sticky for regeneration.
