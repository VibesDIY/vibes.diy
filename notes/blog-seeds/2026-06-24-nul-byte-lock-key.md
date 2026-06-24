# The clever NUL separator that took down every Postgres write

Source: #2590 (fixes #2557)

A per-doc advisory-lock key joined `(owner, app, db, docId)` with a literal NUL
byte — chosen precisely because NUL "cannot appear in these identifiers," making
it a collision-proof separator. It was too clever: that key is bound into a
Postgres text param, and Postgres rejects `0x00` in text (SQLSTATE 22021), so
*every* pg `putDoc`/`deleteDoc` failed. The exact property that made NUL a
perfect uniqueness trick made it an invalid value one layer down.

Two angles worth a full post:

1. **Robustness over bit-twiddling.** The boring fix — `JSON.stringify` the tuple
   — is unambiguous *and* survives every layer boundary. A clever encoding that
   leans on a low-level invariant ("this byte can't appear") is a latent bug at
   the first boundary that disagrees. Prefer encodings that are obviously correct
   everywhere over ones that are minimal-but-fragile.

2. **Debug against the real engine, and beware the false negative.** The bug was
   invisible in CI because tests run on libsql, which tolerates NUL in text; only
   real Postgres rejects it. The first repro *passed* — because it used a clean
   key, not the actual NUL-separated one. Reproducing with the real input against
   the real engine, and walking the `.cause` chain the WebSocket only surfaces as
   a generic `Failed query:` wrapper, is what pinned SQLSTATE 22021.
