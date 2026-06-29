# Showing a stranger your vibe's "next moves" without showing them your chat

Source: `claude/anon-suggestion-chips-wzrfdg` (PR pending) — fixes #2755

The edit-card suggestion chips ("Make it a drum machine · Add 808s · Other") are
the model's own trailing `▸` options from the vibe's last codegen turn. They're
the perfect public call-to-action — yet only the owner ever saw them, because the
only way to read them was `getChatResponse`, which is owner-scoped (the chat is
private). So every stranger landing on a public vibe got an empty, text-input-only
card — the opposite of the #1896 "land on an app, see curated transforms" pitch.

The interesting bit isn't "drop the `enabled: isOwner` gate" — it's *how* you make
a slice of private data public without forking the data model. The wrong instinct
is to side-persist a copy of the chips (in `appSettings`, say); that's a second,
low-traffic write path that silently rots out of sync with the chat. Instead: keep
the private chat as the single source of truth and expose exactly one **projection
endpoint** over it. `getVibeChips` reads the same `ChatSections`, but (a) runs
under `optAuth` and gates on app-access *visibility* (`isPublicReadable`, or a
signed-in owner/member via `checkDocAccess`) rather than ownership, and (b)
returns *only* the capped chip strings — never a raw section. The parse logic that
used to live in a frontend hook moved into the browser-safe `api-types` leaf so
the server projection and the in-place-generation hook share one implementation
with zero drift.

The trade-off worth a paragraph: a generic "read `chatSections`" surface would
have been less code, but it's a latent over-read that future UI leaks through. A
dedicated endpoint per public slice (chips today, history maybe later) is more
boilerplate now in exchange for an auditable allowlist — the response schema *is*
the security boundary. The gotcha that proves the discipline: the gated-but-not-
public vibe. A member-only app stays chip-less for non-members, which is correct
precisely because "the chips are harmless CTAs" is an argument about the strings,
not about who's allowed to see the app.
