# Adding a write-path past the owner gate, when there's no admin to gate on

Source: `claude/cached-admin-bless-vslbzn` (#2929 item 3) — letting a trusted
platform admin bless/revoke a cached-suggestion result in an app they don't own
(the curation seam). The issue framed it as "use the existing `approvedBy` seam,"
which made it sound like a field wiring. It wasn't — the interesting discovery
was that the thing the seam was waiting for didn't exist.

- **"The seam exists" ≠ "the authority exists."** The bless record already carried
  `approvedBy` as the explicit hook for admin-on-behalf. But mapping the codebase
  turned up the real gap: there is **no server-side admin authority at all**. The
  client `adminMode` flag is self-asserted and only ever elevates the *owner*
  (`checkDocAccess` returns `override` solely when `isOwner`). So "admin blesses on
  behalf" first required *introducing* a platform-admin primitive — a much bigger
  decision than wiring a field. The minimal, reversible choice: a
  `VIBES_ADMIN_USER_IDS` allowlist of **verified** userIds, empty by default, so
  the whole capability is inert in every environment until an operator opts in.
  Empty-default is the same safety pattern as the lane's preview flag: ship the
  mechanism dark, light it deliberately.

- **Force the row owner; record the actor separately.** The settings row is keyed
  on `(userId, ownerHandle, appSlug)` with `userId` = the row owner. The naive
  admin write would carry the admin's `userId` straight through to the `onConflict`
  target — minting a *stray* `(adminUserId, ownerHandle, appSlug)` row that the
  reader/grant (which resolve via the owner's handle binding) never read. So the
  fix is two identities, not one: `res.userId` is forced to the **owner** (the
  write lands where it's served), while a separate `approverUserId` (the verified
  caller — owner or admin) is what `approvedBy` records for audit. Conflating
  "who owns this row" with "who took this action" is the bug that doesn't show up
  until a different actor writes.

- **A new privileged path should widen the surface by exactly one verb.** The gate
  doesn't become "admins can edit foreign settings." It opens for a *single*
  request type — a cached-suggestion bless/revoke — and every other mutation by a
  non-owner still falls to the read-only return (asserted by a test: an admin's
  `title` write is a no-op on a foreign app). And the bless still runs the same
  produce-before-bless + tuple-match + source-public + app-public checks, so an
  admin can only feature what the **owner already produced from public source on a
  public app**. The blast radius of "introduce an admin" is held to "feature
  already-public owner content," not "write anything anywhere."

Deferred companion: the admin **client UI** (surfacing the control on a foreign
vibe needs `whoAmI` to report admin status) — and the governance call (any-owner
vs. narrower scope) is flagged for human sign-off, since "an admin features your
vibe without asking" is a product decision, not a security one.
