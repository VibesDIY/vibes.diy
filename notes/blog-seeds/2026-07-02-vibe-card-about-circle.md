# A question-mark circle for "wait, what is this thing?"

**Hook:** Someone lands on a shared vibe, taps the mysterious VIBES/DIY switch, and
gets a card full of Home / Edit / Editor / Share circles — with no way to answer the
actual first question: *what platform am I even on?* Now there's a `?` circle for
that.

**Source:** `vibes.diy/base/components/UnifiedVibeCard.tsx` +
`vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`

**The trade-off / why / gotcha:** The card is a pure presentational component — every
nav circle fires a host-wired callback, and the new About one follows suit
(`onAbout`) rather than hardcoding a URL in `base/`. The wiring reuses
`resolveBuilderOriginFrom(window.location.origin)`, the same helper Home uses, so a
PR-preview session opens the *preview's* `/about` instead of jumping to prod and
masking the environment you're actually testing. Small gotcha dodged: an unwired
`onAbout` leaves the circle inert instead of broken, which is exactly how the other
NavIcons already degrade in stories and tests.
