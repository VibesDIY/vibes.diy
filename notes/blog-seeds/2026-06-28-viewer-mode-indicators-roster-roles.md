# Shipping the settled parts: viewer-mode indicators + roster roles, leaving the undesigned bits for the design pass

Source: #2679 (viewer-mode indicators / #2178), #2680 (share manage flow), the agent-in-vibe epic

The ask was "do #2680 and the easy parts of #2679, then we design the rest."
The interesting work was figuring out which parts were *actually* easy — and the
codebase, not the issue text, drew that line.

Decisions worth a full post:

- **"Easy" = the design is already settled, not "small diff."** The epic's §2
  grant→surface table already decided the viewer-mode indicators (author → shield,
  read-only member → lock, visitor → nothing) and the roster shows roles read-only.
  Implementing a settled spec is execution, not design — so those qualify as the
  "easy parts" even though they touch real UI. The *undecided* layouts (legacy-chrome
  deletion, the request-access screen, the per-member manage menu's visual) are the
  "design afterwards" bucket. The split is about decidedness, not size.
- **The per-member manage menu looked like the headline of #2680 — and the API said
  no.** `listMembers` returns only `{ displayName, role }` by design (no userId, no
  grant id; it explicitly defers management data to the owner-only invite/request
  endpoints). So a "tap a member → change role / remove" menu can't be wired from the
  roster without a new by-handle backend endpoint or fragile roster↔grant
  reconciliation. That moved it from "easy now" to "design + backend later" — a
  reminder to check the data layer before scoping UI from an issue title.
- **What's left of #2680 after this is genuinely backend/design.** The shippable
  half is *showing* roles (read-only, mirroring the legacy `MembersSection`'s
  "editor"/"reader" convention via `ViewerTagView`'s `trailing` slot); the
  *managing* half needs the design pass. Naming the read/manage split kept the PR
  honest and mergeable.
- **Indicators ride the role data the route already had.** No new state: the route
  already computed `shareViewer` + `myGrant`, so the card's `viewerMode` /
  `memberReadOnly` are a pure mapping. A11y: the glyphs are `role="img"` with
  `aria-label` ("Owner" / "Read-only") so the mode is announced, not just colored.
- **Single-source-of-truth held.** The indicators + roster roles render from the
  real `@vibes.diy/base` components in the Storybook sketches (screenshots refreshed),
  so the sketch can't drift from production.

Gotcha for the next person: this branch's predecessor PR was *rebase*-merged, so its
commits landed in `main` under new SHAs. Stacking the next branch on the old tip would
have re-introduced them in the diff — branch the follow-up off `origin/main`, not the
merged branch.
