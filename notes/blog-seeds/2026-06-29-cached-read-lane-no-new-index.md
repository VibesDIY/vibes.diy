# The cache index that was already there: cached-read chips with no new table

Source: `claude/curated-cached-starter-vibe-9ro0vn` (#2801)

The agent-in-vibe epic shipped only the *write* lane: every chip fired real
codegen. The missing *read* lane — a cached chip that instantly navigates to an
already-generated vibe with no login, no codegen, nothing forked — needed
"backing infra": a system handle that owns pre-made forks, and a content-address
dedupe key `(source, transform)` so the same transform of the same source
resolves to the same fork instead of regenerating.

The interesting move is what we *didn't* build. The open design question was
"where does the dedupe index live — a new D1 table on which plane?" The answer
fell out of the model's own premise: cached content is **real, addressable apps
owned by a system handle** ("system is just another owner"). If the
content-address key *is* the app's slug under that handle, then the dedupe index
is the `apps` table — and the lookup is the existing anonymous-safe
`getAppByFsId` read, which already returns `grant: 'not-found'` on a miss and
`public-access` for a logged-out viewer. No new table, no new endpoint, no new
read shard. The cheapest infra is the infra the key shape lets you delete.

Two more lessons worth a post:

- **Normalization is the whole dedupe story.** `(source, transform)` only
  O(1)-dedupes if "▸ Make it a drum kit." and "make it a DRUM kit" hash to the
  same slug. The key is a 2×FNV-1a hash of a newline-joined, normalized tuple,
  fit into the 32-char slug budget — a tiny pure function that carries the entire
  correctness weight.
- **Gate on the click, not the content.** The first instinct was to gate the
  read-lane on "is this a system/curated vibe?" — but that bakes in
  "cached == curated" and kills the whole future of lazy-caching a popular *user*
  vibe's chips. The right boundary is ownership of the *click*: only a **non-owner**
  can ever take a cached read (an owner click is always an in-place write — and if
  their own vibe were cached, an un-gated lookup would wrongly navigate them away
  instead of editing). The cache still *lives* under a system handle, but that's
  storage, not a constraint on the source. The lesson: a gate chosen for
  "make the no-op cheap" can quietly amputate the feature's roadmap — gate on the
  invariant (owner ≠ reader), not on today's only data source. Reads soft-fail to
  the write lane; writes keep fail-loud semantics — the cache-hit *is* the
  read/write (and login/fork) boundary.
