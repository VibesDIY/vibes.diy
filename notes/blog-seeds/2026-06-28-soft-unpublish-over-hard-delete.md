# Why "delete a vibe" became "tombstone the slug, keep the bytes"

Source: `claude/build-2688-4m3hud`

A deployed vibe looks like one thing (`ownerHandle/appSlug`) but is really a
fan-out: append-only code versions, Firefly CRDT data, remix lineage anchored to
an immutable content hash, member grants, chat history, and CID-shared assets.
"Add a delete command" is the trap — the interesting move was refusing to, and
instead designing the *cheapest reversible* operation: a single
`unpublishedAt` column on `AppSlugBindings` that copies the existing `pinnedAt`
soft-state pattern (empty string = on, ISO timestamp = off, one HOT write).

The trade-off worth a post: soft-unpublish answers every hard question
(lineage, other people's data, esm.sh stale-cache, "did I mean it") by keeping
the bytes, because the serving path already separates "latest production"
(blockable) from "explicit fsId" (must keep resolving so remix chains and
permalinks survive). Hard delete — the thing that *sounds* like the feature — is
deliberately deferred behind ownership + lineage + member-data guards, with its
constraints written down so the follow-up doesn't re-derive them. Lesson: when a
destructive feature is requested, the design win is often finding the reversible
90% and naming the irreversible 10% precisely enough to postpone it safely.
