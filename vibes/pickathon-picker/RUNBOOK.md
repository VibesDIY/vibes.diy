# Pickathon Picker — Update Runbook

Live URL: https://vibes.diy/vibe/og/pickathon-picker
Super mode: https://vibes.diy/vibe/og/pickathon-picker?super=true

## Edit → Push

```bash
cd /Users/jchris/code/fp/vibes.diy/vibes/pickathon-picker
# edit App.jsx
npx vibes-diy push
```

That's it. `push` deploys `App.jsx` to `og/pickathon-picker` and prints the live URL.

## Pull current live version

```bash
cd /Users/jchris/code/fp/vibes.diy/vibes/pickathon-picker
npx vibes-diy pull og/pickathon-picker
```

**Warning:** `pull` currently writes the compiled/transpiled JS, not raw JSX (see issue #2056). Use the source in this directory as the authoritative copy and don't overwrite it with a pull unless you manually verify the output is clean JSX.

## Architecture notes

- **Database**: Fireproof `"pickathon-festival"` — data lives in the browser, syncs across users via the vibes.diy data plane.
- **Auth**: `useViewer()` from `use-vibes`. `can("write")` gates all write surfaces. Anonymous users see browse-only (read-only) mode.
- **Favorites** (`type: "favorite"`) — fetched globally (all users) so super mode can show peer picks and global counts. Keyed `favorite-{userId}-{eventId}`.
- **Shifts / Notes** (`type: "shift"` / `type: "note"`) — user-scoped via compound Fireproof index `[doc.type, doc.userId]`. Keyed `note-{userId}-{eventId}`, `shift` docs get a random `_id`.
- **Super mode** — URL easter egg (`?super=true`). Shows `★ N` pick counts in browse and a peer picker in Favorites. Not toggleable from the UI.

## Schedule data

Fetched from `https://pickathon.com/wp-content/plugins/pickathon/schedule.php` and cached in `localStorage` for 10 minutes. All times stored/displayed in `America/Los_Angeles`.

## Common edits

| Task | Where |
|------|-------|
| Change festival dates | `FESTIVAL_2026.dates` |
| Change logo | `LOGO_URL` constant |
| Add a new view/tab | Add to the `["browse", "favorites", "shifts", "schedule"]` array in nav, add `{view === "newview" && ...}` section in the body |
| Change colors | `c` object near bottom of component |
