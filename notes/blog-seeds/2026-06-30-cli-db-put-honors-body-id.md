# CLI `db put` honors body `_id` (no more silent UUID orphans)

- **Branch / PR:** `claude/issue-2668-uy2k9y` — fixes #2668
- **Hook:** You run `vibes-diy db put '{"_id":"my-doc","msg":"hi"}'`, get back
  `{ "id": "019f…", "ok": true }`, then `db get my-doc` → "Document not found".
  The CLI minted a UUID and dropped your `_id` on the floor.

## The trade-off / why

The server write path only ever looks at `req.docId` —
`const docId = req.docId ?? sthis.timeOrderedNextId().str` — and never inspects
`doc._id`. The CLI only filled `docId` from the `--id` flag, so a body `_id`
(the *normal* shape of a Fireproof doc) was silently ignored and replaced with a
generated UUID. The footgun compounds: id-based upsert looks like it worked, and
a later `db del my-doc` quietly no-ops against a doc that never had that id.

Fix is CLI-side and centralized in `cmds/db/shared.ts:resolveDocId`, shared by
both `db put` and the MCP `vibes_put` tool:

- `--id` flag still wins (explicit beats implicit).
- When `--id` is omitted, fall back to a non-empty string body `_id`.
- When both are present and **disagree**, the flag wins but we **warn** to stderr
  so the dropped body id can't bite silently.
- A present-but-unusable body `_id` (non-string / empty) with no `--id` also
  warns instead of silently generating — same class of bug, surfaced.

## Gotcha worth a post

The "silent substitution" anti-pattern: a default that's *individually*
reasonable (generate an id when none is supplied) becomes a data-integrity trap
once two layers each think the other owns id resolution. The fix wasn't a new
feature — it was making the *absence* of an honored id observable.
