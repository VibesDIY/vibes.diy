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

- **Database**: Fireproof `"pickathon"` — data lives in the browser, syncs across users via the vibes.diy data plane. Read access is scoped by `access.js` channels (below), so a client only syncs what it can read.
- **Auth**: `useViewer()` from `use-vibes`. `can(...)` gates write surfaces. Anonymous users favorite locally (migrated on sign-in); notes/shifts/friends need sign-in.
- **Channels** (`access.js`):
  - **Favorites** (`type: "favorite"`, keyed `favorite-{userId}-{eventId}`) → the owner's **`share-{userId}`** channel _and_ the global **`super`** firehose. The owner reads their own via `share-`; friends read them because a **friend edge grants read of each other's `share-` channel**. Nobody is granted `super` — it exists only to be unlocked by a `grant` doc (see below). This is deliberately NOT world-readable: it's what keeps every client from syncing every user's favorites at scale.
  - **Notes** (`note-{userId}-{eventId}`) → private **`user-{userId}`** channel. Never shared.
  - **Shifts** → `share-{userId}` if `shareWithFriends`, else private `user-{userId}`. So a friend can see your shared shifts (via the friend grant) but not your private ones.
  - **Friend edge** (`friend-{owner}-{slug}`) → lives in both `user-` channels (for following/followers lists) and cross-grants each person read of the other's `share-` channel.
- **Super mode** — URL easter egg (`?super=1` / `?super=true`). Shows `★ N` global pick counts and a peer picker. To see global data you must both (a) open with `?super=1` **and** (b) hold a `super` grant (below) — otherwise the client only has its own + friends' favorites and the counts are friend-scoped.

## Granting super access

The `super` channel (every user's favorites) is unreadable by default. To let a specific
account read it — e.g. to see true global pick counts — write a **`grant` doc** as an
admin. Only handles listed in `ADMIN_HANDLES` at the top of `access.js` may write one
(set that list to your own Vibes handle; it's the handle you're signed in as via the CLI).

```bash
# Grant <handle> read access to the whole "super" favorites firehose:
npx vibes-diy db put --vibe og/pickathon-picker --db pickathon \
  '{"type":"grant","grantTo":"<handle>"}'
```

The grant takes effect on the grantee's next sync. There's intentionally no UI for this.
(To revoke, `db del` the grant doc by its `_id` — the grantee loses `super` on re-sync.)

## Schedule data

Fetched from `https://pickathon.com/wp-content/plugins/pickathon/schedule.php` and cached in `localStorage` for 10 minutes. All times stored/displayed in `America/Los_Angeles`.

## Common edits

| Task                  | Where                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Change festival dates | `FESTIVAL_2026.dates`                                                                                                          |
| Change logo           | `LOGO_URL` constant                                                                                                            |
| Add a new view/tab    | Add to the `["browse", "favorites", "shifts", "schedule"]` array in nav, add `{view === "newview" && ...}` section in the body |
| Change colors         | `c` object near bottom of component                                                                                            |
