# The scheduled sweep that couldn't read

**Hook:** We asked for the most boring backend feature imaginable — "prune a
leaderboard to the top 50, once a day" — and discovered the platform's vibe
backend could write and delete but not *read*. You can't keep the best 50 if
you can't see the scores.

**Source:** The /start word-games lane (word-jumble → spelling-hive): reworking
jchris/spelling-hive with real ENABLE-dictionary puzzles (CLI-loaded), private
per-device play, and a public top-50 board pruned by a `backend.js` scheduled
handler.

**The gap:** `ctx.db` shipped with `put` and `delete` only — by design, since
the write lane's whole story is "re-enter the exact frontend write gate." But a
retention sweep is read → decide → delete. Without a read op the workarounds
get silly (mirror state into onChange-maintained docs you also can't read).

**The fix shape:** `ctx.db.query({ db })` — the whole db's latest non-deleted
revisions, capped at 2000, read-ACL-gated as the acting identity, with two
fail-closed v1 restrictions: anonymous fetch-lane callers are denied, and
access-fn-bound databases are denied outright (returning unfiltered docs would
bypass the channel filter; replicating it is future work). No index semantics —
filter in the handler. The isolate shim bumps the binding-schema version so a
warm isolate can never serve the old capability surface.

**The payoff:** the prune is 20 lines of backend.js — query, sort, slice(50),
delete, stamp a prune-meta doc. Hourly tick (the platform caps intervals at
1h), daily gate on the meta doc.

**Also worth telling:** the word lists. The old spelling-hive generated puzzles
with callAI — hallucinated words, duplicate entries at different point values,
"snirt". The new ones are computed offline from the public-domain ENABLE list
(slur-filtered), validated pangram seeds, and loaded as docs with
`vibes-diy db put`. The dictionary is data, not a prompt.
