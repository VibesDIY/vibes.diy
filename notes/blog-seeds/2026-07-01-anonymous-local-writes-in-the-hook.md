# "Local until you log in" belongs in the hook — and the guard has to be un-bypassable

Source: #2988 (`claude/impl-2985-dn2crc`, stacked on the #2985 optimistic-writes work)

The onboarding path every shareable app wants: let a logged-out visitor *do*
something — favorite an event, save a draft — before asking them to sign in,
then carry that state onto their account. The hosting layer rejects anonymous
cloud writes, so today each app hand-rolls a localStorage store with a
Fireproof-shaped API, a one-time migration on sign-in, and a home-grown query
engine that only covers the subset of `useLiveQuery` that one app happens to use.

`useFireproof(name, { anonymousLocal: true, migrate })` now does it: while logged
out, `put`/`del`/`useLiveQuery`/`useDocument` run against a `LocalDatabase`; on
first sign-in the local docs migrate into the cloud and local storage clears.
Worth a post:

1. **Reuse the query engine, don't re-hand-roll the subset.** The whole
   complaint about the workaround was its query engine only covered `{ key }`,
   `{ prefix }`, etc. that its one app needed. So I extracted FireflyDatabase's
   materialization into a pure `materializeQuery(docs, mapFn, opts)` and had
   *both* the cloud and local stores call it. String/function index,
   key/keys/range/prefix/descending/limit — identical in both modes, because
   it's literally the same function. Swapping auth modes can't change query
   behavior if there's only one implementation.

2. **The returning-user guard must be automatic and hard to work around.** The
   original spec wanted to *expose* a `hasAuthedBefore` flag so apps could steer
   returning-signed-out visitors to sign in. But an exposed flag is a flag app
   code forgets, branches on wrong, or bypasses. So it's internal: a per-db
   localStorage marker set on first sign-in, and the hook itself refuses to hand
   a returning signed-out visitor a fresh local session (it falls through to the
   cloud db, whose anonymous-write rejection *is* the "please sign in" signal).
   No app-visible knob, nothing to get wrong.

3. **Clear local only after the whole migration succeeds.** `migrateLocalToCloud`
   runs each doc through an optional `migrate(doc, userHandle)` (falsy → drop),
   writes them all, *then* clears — a throw mid-way leaves local storage intact
   and recoverable. Idempotent when `migrate` preserves `_id`, so a retry on the
   next session overwrites rather than duplicates. The failure mode you must
   never hit is "migration half-finished, local wiped, data gone."

4. **Type the seam, not the class.** Both stores implement a small
   `FireflyQueryDatabase` interface (the surface the hooks actually drive), so
   `useFireproof` returns "either store" without the hooks knowing which. The
   only churn was three test annotations that had typed `database` as the
   concrete `FireflyDatabase`.

Distinct from #2985 (optimistic writes) but the same thesis: the write-side
ergonomics apps keep re-implementing belong in the hook. An app doing both
stacks an optimistic overlay *and* an anonymous-local adapter — now neither is
hand-rolled.
