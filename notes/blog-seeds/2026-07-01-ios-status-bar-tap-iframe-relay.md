# The iOS status-bar tap can't reach an iframe — so catch it with 1px of fake scroll

Source: `vibes.diy/pkg/app/hooks/useStatusBarScrollToTop.ts`,
`vibes.diy/vibe/runtime/register-dependencies.ts`

Bug report: "Tapping the top of the screen should scroll the page to top. The
iframe is not receiving that tap." It never will — the iOS scroll-to-top
gesture is a WebKit-native behavior that only scrolls the **main frame's**
scroller. It isn't exposed as a JS event and it is never forwarded into a
cross-origin subframe. Every vibe runs in exactly that: a `position: fixed`,
viewport-filling, cross-origin iframe, so the parent has nothing to scroll and
the app's real scroller is unreachable by the gesture.

The trick: **make the parent scrollable by 1px and park it at `scrollTop = 1`.**

- A hidden sentinel (`visibility:hidden; pointer-events:none`, height
  `100lvh + 2px`) gives the document exactly a sliver of overflow.
- The fixed iframe swallows every touch, so the user can never scroll the
  parent themselves. The *only* thing that can drive the parent's scroll to 0
  is the native status-bar tap.
- A scroll listener catches the 1→0 transition, posts
  `vibe.evt.scroll-to-top` over the existing srv-sandbox postMessage bridge,
  and re-parks at 1 (with a flag so the programmatic re-park isn't mistaken
  for another tap).
- Inside the iframe, the runtime scrolls the document *and* any scrolled
  container ≥60% of the viewport height — covering both body-scrolling vibes
  and the common `h-screen` + inner `overflow-auto` layout — while leaving
  small scrolled widgets (inner lists, code blocks) alone.

Decisions worth a full post:

- **Invisible by construction.** `position: fixed` children don't move with
  parent scroll, so parking at 1px never paints a single pixel of movement.
- **Gate on iOS user agents.** On desktop browsers with permanent scrollbars,
  1px of body overflow grows a scrollbar gutter — a visible regression for a
  gesture that doesn't exist there. (iPadOS detection is its own gotcha:
  `platform === "MacIntel" && maxTouchPoints > 1`.)
- **Degrade to inert, never to broken.** Pre-15.4 WebKit lacks `lvh`; the
  fallback `100vh + 2px` line means older devices just keep the sliver of
  overflow, and if even that fails the parent simply never scrolls — the
  feature silently doesn't fire rather than misfiring.
- **The embed route doesn't get this.** An embedded vibe's host page owns the
  main frame; our /embed document is itself a subframe, so the sentinel would
  be as unreachable as the app. Only the full-screen viewer route wires it.
