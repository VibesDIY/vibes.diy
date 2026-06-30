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
- **The read decision is the cache-hit, and *only* the cache-hit.** This took two
  wrong gates to get right. First instinct: gate on "is this a system/curated
  vibe?" — bakes in "cached == curated," kills lazy-caching user vibes. Second
  try: gate on "is the clicker a non-owner?" — still wrong, because it smuggles
  identity into a decision that has nothing to do with identity. The actual
  question a chip click asks is "has this `(source, transform)` already been
  generated?" — full stop. If yes, it's a read; if no, it's a generate. *Who*
  you are only changes what a **write** does (owner edits in place, non-owner
  forks) — never whether the click is a read. The lesson: when you catch yourself
  adding an identity check to a content-addressed lookup, you've probably confused
  the read decision with the write behavior. Separate them. The one thing left
  open is downstream of the hit, not the decision: for the owner of a cached
  source, does a hit *navigate* to the result or *adopt* it in place as their next
  version — a write-path question, deferred until precache can actually fire.
