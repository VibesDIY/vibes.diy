# Caching a suggestion chip is just staging a version — the model we walked into

Source: `claude/curated-cached-starter-vibe-9ro0vn` (#2801)

The agent-in-vibe epic shipped only the *write* lane: every suggestion chip fired
real codegen. The missing *read* lane is a chip that, when its result already
exists, instantly navigates instead of regenerating. The whole story of this PR
is how the data model for "the result already exists" got progressively simpler
as each clever version was knocked down — a good case study in not marrying your
first architecture.

**Where it started (and why it was wrong).** First model: cached results are
forks owned by a reserved *system handle*, and the content-address key `(source,
transform)` *is* the slug under that handle — so the dedupe index is just the
`apps` table and the lookup is the existing `getAppByFsId`. Elegant! "No new
table." But it baked three assumptions that didn't survive contact with the
product owner:

1. **It tied caching to a special owner.** Gating the read on "is this a
   system/curated vibe?" kills the actual goal — lazy-caching a *popular user
   vibe's* chips. (First correction.)
2. **It still smuggled identity into the read decision** when re-gated on
   "non-owner." But the question a chip asks is purely *"has this `(source,
   transform)` been generated?"* — nothing about who clicks. Identity only
   changes what a **write** does. (Second correction. Lesson: when you add an
   identity check to a content-addressed lookup, you've confused the read decision
   with the write behavior — separate them.)
3. **It put the result in the wrong place.** The real model (third correction):
   a cached chip result is just **a new `fsId` under the source vibe's own
   owner/slug** — a staged code version (same slug + new fsId = new code, data
   carried), unpublished until the owner publishes. "If tokens were free we'd
   precompute every chip" — so the cache is nothing exotic, just precomputed
   versions. The system handle was never infra; it was one person's demo-content
   account.

**What survived all three rewrites** is the part worth trusting: the pure
primitives. `normalizeTransform` (so "▸ Make it a drum kit." and "make it a DRUM
kit" dedupe) and a deterministic content-address key over `(source, transform,
model)`, plus an *injected* `resolveCachedRead` decision whose lookup is the one
seam the backend plugs into. They didn't change as the storage model thrashed —
because they encode the identity of a transform, which is invariant, not where its
result is stored. The lesson: when a design is still moving, push the moving parts
behind an injected boundary and make the stable core pure and tested. The "no new
index" cleverness died; `normalizeTransform` and the key never flinched.

The one genuinely-open thread is downstream of the hit: for the **owner** of a
cached source, does a hit *navigate* to the staged version, or *adopt* it in place
as their next fsId (skip codegen, keep their data namespace)? A write-path
question, deferred until precache can actually fire.
