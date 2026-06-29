# The share toggle shouldn't pick a winner before the backend speaks

Source: `vibes.diy/base/components/SharePanelView.tsx`, `vibes.diy/tests/app/SharePanelView.test.tsx`

Opening the share panel in the vibe route flashed one of the two "Who can open
it" buttons — "Anyone with the link" / "People you approve" — as *selected*
before the authoritative sharing setting had loaded. Then a beat later the real
value arrived and the selection could jump to the other button. The fix is one
line, but the why is the interesting part.

Decisions worth a full post:

- **The "selected" state was reading a placeholder as if it were the answer.**
  The owner toggle computed `active = opt.value === access`, and `access` is
  derived from the SSR loader's `isWorldReadable` fallback until the real
  `publicAccess` value resolves over the network. So `access` is *always* either
  `"public"` or `"request"` — never "unknown" — which means one button always
  satisfied the equality and rendered checked. There was no neutral state to
  render, even though there's a perfectly good signal for "we don't know yet."
- **That signal already existed and was already wired — for a different job.**
  `accessPending` (`!settingsLoaded || isTogglingPublicAccess`) was passed in to
  *disable* the buttons during the load/write window so a click in that gap
  couldn't be dropped or clobbered by the late read. The disabled-ness was
  honored; the selected-ness was not. The flash was the gap between those two:
  inert but visibly opinionated. Gating the same flag onto `active`
  (`!accessPending && opt.value === access`) makes both buttons read unchecked
  until the truth lands — visual state and interactive state now agree.

- **The viewer's read-only sentence had the same lie, quieter.** Non-authors see
  a sentence instead of the toggle — "Anyone with the link can open this vibe" /
  "Only approved members can access this vibe" — and it keyed off the same
  fallback `access`, so during the pending window a viewer could be told *anyone*
  can open a vibe that's actually grant-required. A misleading sentence is worse
  than a misleading button here, because there's no disabled-state cue telling
  the reader "wait." So the same `accessPending` gate swaps in neutral copy —
  "Checking who can open this vibe…" — until the truth lands. The honest move
  when you don't know yet is to *say* you don't know, not to guess and correct.

Test gotcha: `SharePanelView` tests run under vitest's Playwright browser
provider, so asserting "neither radio is checked" is a real `aria-checked`
read in a real DOM — the test rerenders across `access="public"`,
`access="request"` (both must stay unchecked while pending) and then drops
`accessPending` to prove the matching button *does* select once resolved.
