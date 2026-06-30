# Blog seed — the bless gate: produce ≠ publish ≠ "bless"

**Hook:** A cached suggestion-chip result has *three* states, and conflating any
two of them is a security bug. We named them and built the gate that keeps them
apart.

**Source:** PR (follow-up to #2890) — the cached-suggestion bless gate. #2801.

## The trade-off / why / gotcha

The first enablement slice served a cached chip result as an in-namespace **stay**
the moment it was *produced* (generated + source-was-public). That's the
"owner clicks an exploratory chip that wipes their data, and it's instantly live
for every visitor" hazard — because **clicking is exploration, and exploration
includes clicking bad ideas.**

The fix is a vocabulary, then a gate:

- **produced** — generated, cached, deny-by-default. A click *forks*.
- **blessed** — the owner *explicitly* elevated that one result to a fast-path
  stay. Pinned to the exact `{key, fsId, sourceFsId}`, revocable.
- **published** — production HEAD, the no-`fsId` default landing (the blessing
  primitive we already had).

The gate is one structural move: the reader and the grant read a **separate bless
map**, not the produce map. Not-blessed or revoked ⇒ absent ⇒ fork. Everything
fails to a fork; no failure path degrades to an *unsafe stay*. The produce map
becomes "what I generated" (for the bless UI / telemetry / future fast-fork-seed);
the bless map is "what I vouched for / what serves."

**Gotcha worth writing up:** "bless" isn't a new permission system — it's the
publish axis at a finer grain. Production already *is* the maximally-blessed state
(it's what you get by default). The new middle tier exists so an owner can feature
an *alternative* result as a fast stay **without** making it their app's HEAD. And
the load-bearing realization: you bless a **result**, not a chip — so there's no
"blessed but not yet generated" state to reason about (`blessed ⊃ produced`), which
collapses a 2×2 into a clean linear lifecycle.

**Also worth a line:** human curation replaces the safety oracle. We can't
automatically answer "is this suggestion safe to run in-namespace?" — so we don't.
An owner vouches for a specific frozen result; that vouch *is* the provenance check
(and the real resolution of Finding A). It's revocable and bounded to already-public
sources, so a bad bless self-exposes at worst.
