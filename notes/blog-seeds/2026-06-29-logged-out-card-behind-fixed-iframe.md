# The landing card that paints behind the app — `position: static` under a `position: fixed` iframe

Source: `claude/logged-out-vibe-card-685hjp` (touches `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`, `vibes.diy/tests/app/vibe-fast-paint.test.tsx`)

A logged-out visitor on a *world-readable but non-public* vibe (you can preview it, but you must
install your own copy or request access to collaborate) saw the two CTAs — **Fresh Install** /
**Request access** — floating over the running app with no card behind them: low-contrast, hard to
read, exactly the "what am I looking at" the two-CTA landing was meant to kill.

The trap: the landing card *already exists* in the route — the cream Mac-classic card with a blue
title bar, screenshot, helper copy, and the button row. So the instinct ("there's no card, add
one") is wrong. The card is rendered; you just can't see it. The route paints the live app in an
`<iframe>` wrapper that is `position: fixed; inset: 0` (so the iframe `src` ships in the first byte
of SSR HTML and starts fetching before hydration). The landing-card overlay right below it is a
plain in-flow block — `position: static`. CSS stacking order is merciless here: a positioned
element (the fixed iframe) paints in a *later* group than in-flow non-positioned blocks, regardless
of DOM order or `isolation`/`transform`. So for a **world-readable** vibe — the one case where the
iframe is actually visible — the entire card layer paints *behind* the app and vanishes. For a
private vibe the iframe is `visibility: hidden`, so the same static overlay shows fine; the bug only
exists in the readable case, which is why it survived.

What clinched it was a 10-line standalone HTML repro driven through headless Chromium: a `fixed`
dark div + a `static` cream "card" div, screenshot → card gone. Same structure with the overlay
lifted to `fixed; z-index: 30` + a dim `backdrop-filter` scrim → card on top, app softly visible
behind. The fix is gated on `isWorldReadable && (showCard || notFound)` so the common private-vibe
path keeps its byte-identical opaque `gridBackground`, and the *transient* loading sub-state stays
out of the way (no scrim flash over a preview that's still resolving its grant).

Gotcha for next time: when "there's no X" but the code clearly renders X, sample the pixels before
theorizing (a `getpixel` on the screenshot read `(15,0,7)` — the app's own near-black theme, not the
grid's `#2a2a2a` and not the cream card — which proved the live app was on top, not that the card
was missing). Stacking bugs lie about what's absent.
