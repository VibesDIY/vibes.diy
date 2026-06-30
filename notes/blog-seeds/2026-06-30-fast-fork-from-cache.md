# Serving unblessed code is fine — if it forks instead of stays

Source: `claude/cached-fast-fork-vslbzn` (#2929 item 1) — when a signed-in
non-owner clicks an offered chip that has a *produced but unblessed* cached
result, seed their fork from that chip-applied code instead of re-running
codegen. A "fast fork" instead of a slow one. The whole point of interest: this
deliberately serves code the **bless gate does not cover**, and that's safe for a
structural reason, not a policy one.

- **The bless gate gates *staying*, not *caching*.** The converged model has two
  independent bits: `cached` (materialized) and `blessed` (approved). Blessed →
  fast *stay* (in the owner's namespace, on the owner's data — needs the explicit
  bless). Unblessed-but-cached → fast *fork* (the forker's own namespace, no owner
  data). So fast-fork reads the **produce** map, not the bless map, and needs no
  bless — because a fork can't do the thing the bless gate exists to prevent
  ("owner clicks a bad chip and it's instantly live on their data"). The forker
  gets their own copy; there's nothing of the owner's to harm.

- **"Serves unblessed code" sounds scarier than it is, because of what a fork
  copies.** A fork copies `fileSystem` + `env` into a fresh namespace — never the
  owner's *data* (documents live in the owner's namespace; the fork gets an empty
  one). And the produced result is an *offered-chip* transform (the produce map is
  offered-chip-only; custom prompts are never produced) of an already-*public*
  source version (re-verified at fork time, same `cachedSuggestionSourceIsPublic`
  the stay grant uses). So the forker receives exactly the code they could already
  get by forking the public source and running the same offered chip themselves —
  fast-fork just skips the codegen. It's a performance optimization, not a new
  exposure surface.

- **Fold the serve into the existing serve, don't add a new reader.** The tempting
  shape is "a reader that returns the produced fsId, then fork it." But that leaks
  produced fsIds to clients and needs a second grant. Instead `forkApp` takes an
  optional `cacheKey`: it resolves the produce entry server-side, seeds from it
  when the public checks pass, and returns a `seededFromCache` flag — the produced
  fsId never leaves the server, and the client just uses the flag to decide whether
  the chip's codegen still needs to run (it doesn't, when seeded). One server
  change, no new endpoint, smaller attack surface. A dev fsId is still only
  forkable *via* a valid cacheKey that resolves to it (`granted = seededFromCache ||
  isPublic`), so passing a bare dev `srcFsId` without a key is still denied.

Accepted bound (same as Finding A): the grant trusts the owner-written produce
entry's fsId without proving it's genuinely a chip transform, so an owner who
hand-registers an arbitrary fsId could fork-seed their own draft's code — bounded
to owner-self-exposure, no third-party victim. Ran a dedicated `/security-review`
on the serve path; flag is client-gated so prod stays inert until the lane is on.
