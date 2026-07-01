# A local-first shim that makes a vibe work logged-out — one "mode" on the database

- **Branch / PR:** `claude/pickathon-picker-refinement-9dygz6` — #2979
- **Hook:** We wanted logged-out visitors to save festival favorites. Anonymous
  Fireproof writes are rejected on a standard deploy (the hosting layer needs an
  authenticated principal — `allowAnonymous: true` in `access.js` is necessary
  but not sufficient), and even if they weren't, `user` is null server-side so
  there's no way to attribute or protect a per-anon doc. So instead of a second
  write path, we put the whole database behind a **Fireproof-compatible
  localStorage adapter** (`vibe-store.js`) that is local while logged out and
  real Fireproof once signed in — and migrates local → cloud on first login.

## The trade-off / why

The win is that **app code doesn't branch on auth**. `App.jsx` calls the same
`database.put/del`, `useLiveQuery(index, opts)`, and `useDocument(initial)` in
both modes; the adapter picks the backend. It works because the adapter calls
*both* the real Fireproof hooks and the local-store hooks unconditionally every
render (Rules of Hooks stay satisfied) and just returns whichever the current
mode selects. The local side is a per-dbName singleton `Map<_id, doc>` mirrored
to `localStorage`, plus a ~40-line query engine covering the surface this app
uses: string/function index, `{ key }` equality over scalar **or array** keys,
`{ prefix }`, `{ range }`, `{ descending }`, `{ limit }`.

Migration is the interesting bit — "fish the local stuff out after login." On the
logged-out→signed-in transition the adapter walks the local docs, runs an
app-supplied `migrate(doc, userHandle)` to re-stamp ownership and re-key the
`_id` (favorites/notes re-key deterministically; shifts get a fresh id), `put`s
each into Fireproof, then clears local. Keeping `migrate` app-supplied is what
lets the adapter stay generic while the app owns its `_id` scheme.

## Gotcha worth a post

Two dead ends came first, and both are worth the note: (1) `allowAnonymous: true`
looked like the answer but a live logged-out click still got "Failed to save" —
the access-fn flag governs the *room*, not the *door*. (2) A per-device
localStorage id stamped onto Fireproof docs "works" but is spoofable and
per-browser, because the server can't verify a null-user doc's owner. The clean
resolution was to stop trying to make anonymous writes *server* data at all:
keep them entirely client-side until there's a real identity to attach them to.
The adapter is designed to lift out of this one vibe into the platform later —
a drop-in `useFireproof` with an offline mode.
