# The seed turn that inherited the wrong version

**Hook:** We activated the /start music tree in prod and two of the three
curated chips just… weren't there for anonymous visitors. The seed had
succeeded. The bless had succeeded. The chips were invisible anyway.

**Source:** Activating the Instant Starter Stack (#2941) — seeding the Blooms'
curated "fake chat" chips and blessing the cross-slug edges with the new
`starters:activate` script (`vibes.diy/pkg/scripts/activate-starter-tree.ts`),
then verifying as a logged-out visitor.

**The gotcha:** The starter-chip seed is a talk-only narration turn with no
`fsId` — by design it should attach to "whatever version is currently live."
But `getVibeChips`' talk-only inheritance walks the *chat's own turns* and
pins the seed to the nearest OLDER turn's version. CLI re-pushes mint releases
without appending chat turns, so on any re-pushed starter (bloom-machine: 8
releases, 1 chat turn) the seed inherited release #1's fsId while the
non-member read hard-restricts to the deployed release — chips filtered to [].
bloom-root only worked because it had exactly one release. "Inherits the
deployed version" and "inherits the nearest older turn's version" are the same
sentence until someone re-pushes.

**The fix:** In the projection, a `starter-chip-seed` turn with no own fsId is
pinned to the resolved app row's fsId (the served version), not the inherited
one — implementing the documented semantics. Regression test builds the
re-pushed shape (production v1 → production v2 with no chat turn → seed → read
as a non-member) and fails without the fix.

**Also worth telling:** the whole activation is one idempotent script derived
from the checked-in graph — the seeded chips, the rendered chips, and the
blessed edges can't drift because they're all the same list.
