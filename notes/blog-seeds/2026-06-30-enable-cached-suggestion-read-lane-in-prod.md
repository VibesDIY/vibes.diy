# Flipping a flag is the smallest, scariest line in the diff

Source: `claude/cached-suggestion-read-lane-0o0nf8` (#2928) — turning the
cached-suggestion read lane **on in production** by adding
`VIBES_CACHED_SUGGESTIONS="on"` to `[env.prod]` in `wrangler.toml`. The lane was
fully built and validated in PR preview (#2801, #2890, #2915, #2917); until this
flip, every chip click still took the codegen/fork path and no blessed result
ever served as an instant in-namespace "stay".

The interesting part isn't the one-word value change — it's what had to be true
*before* you're allowed to type it, and how you avoid flying blind after.

- **A flag flip inherits the gate, not the convenience.** The single thing that
  explicitly blocked prod was Finding A: the grant trusted an owner-written serve
  map entry for an `fsId` with no provenance, so an owner could conjure an
  unpublished draft into the anonymous serve path. The bless gate (#2915) closes
  it — blessing is a server-authenticated owner action over a specific
  `{key, fsId, sourceFsId}` tuple, and a bless now requires a *matching produced*
  entry. The flip is one line; the prerequisite was a whole security model. The
  wrangler comment records *why* it's safe, not just *that* it's on — so the next
  person reading the env doesn't have to reconstruct the gate from four PRs.

- **Pair the flip with outcome telemetry, or you're guessing.** The read lane
  *fails to fork*: a miss, a private source, an invisible app, even a settings
  read error all degrade to the same `fsId`-absent answer so it can never become
  an existence oracle. That's the right safety posture and a terrible
  observability posture — a real infra regression (settings reads failing) looks
  identical to a cold cache. So the reader now emits one structured
  `cached-suggestion-read` line per lookup with an `outcome` of
  `hit | miss | lookup-error` (plus a `reason` sub-tag). `lookup-error` is the
  only outcome that's *degraded* rather than a genuine answer — separating it out
  is the whole point: a spike there means infra, not user behavior.

- **The key is safe to log; the prompt would not be.** Telemetry logs the cache
  key, owner handle, and app slug. That's fine *because the lane caches only
  offered chips, never custom free-text prompts* — the key is a content-address
  of a curated transform, so it carries no user PII. If the lane ever cached
  custom prompts, this log line would be the leak.

Deferred companion (filed separately): size/count telemetry on the per-app
AppSettings cached-suggestion maps — they're a single JSON blob full-read and
full-rewritten on every settings op, and the per-app index does not bound them.
Low risk today, but worth watching before any heavily-iterated vibe approaches
the danger zone.
