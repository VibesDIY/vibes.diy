# The owner seed has to be a stored contribution, not a mutation, or a rebuild eats it

Source: `claude/owner-role-seeding-phase1` (phase 1 of #2553 / #2554)

Implementing owner-role seeding, the obvious move is to inject the owner into
`effectiveMembers` directly. That's a bug: `GrantReduce` does full-rebuild on any
doc update (`rebuild()` re-unions only stored `docContributions`), so a later
real doc write would silently wipe the directly-mutated seed and re-lock the
owner. The fix is to add the seed as a synthetic contribution under a reserved
docId so it's part of the rebuild set. Worth a short post on why "materialized
view that rebuilds from source rows" forces every injected fact to *be* a source
row — and the test that pins it (seed survives a doc update).
