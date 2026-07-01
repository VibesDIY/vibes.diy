# Wait for the "Verifying access…" chip before the screenshot fires

Source: `vibes.diy/api/queue/screen-shotter.ts`

Follow-up to the flat 2s settle delay. The screenshot queue navigates to a vibe
with `waitUntil: "networkidle0"` and then settles before capturing — but the shot
was still landing too early. The vibe route shows a `toast.loading("Verifying
access…")` chip while it resolves the viewer's grant (`getAppByFsId`), and the app
only paints once that clears. `networkidle0` can settle *while the chip is still on
screen*, so a flat delay wasn't enough on slower access resolves: we captured the
loading state, not the app.

The fix ties the wait to the actual signal instead of a guessed constant:

```ts
await page
  .waitForFunction(() => !document.body.innerText.includes("Verifying access"), {
    timeout: 15000,
    polling: 100,
  })
  .catch(() => {
    // stuck/never-shown chip must not hang the job — fall through and shoot
  });
```

Decisions worth a full post:

- **Wait on the real signal, not a bigger constant.** The earlier fix ("+2s after
  networkidle0") treated render-settle as a timing problem. But "access is still
  verifying" is a *state*, and the UI already exposes it as visible text. Polling
  for that text to disappear is strictly better than picking a larger sleep that's
  simultaneously too long (fast case) and too short (slow case).
- **Text-matching a toast is a deliberate coupling.** We match the literal string
  "Verifying access". That's brittle if the copy changes — but it's the honest
  readiness probe for *this* screen, versus the settle delay's deliberately
  app-agnostic blanket. The chip is platform chrome (the vibe route), not arbitrary
  user code, so coupling to its copy is acceptable in a way it wouldn't be for the
  vibe's own DOM.
- **Bounded, best-effort.** The wait is capped at 15s and swallows its timeout: a
  chip that never appears (already resolved) passes instantly; one that never
  clears can't wedge the queue. We keep the 2s render-settle *after* the chip
  clears for post-hydration paint/fonts/layout.

Gotcha: if the "Verifying access…" copy is ever reworded, this wait silently
degrades back to "just the 2s settle." A shared constant for the chip text (imported
by both the route and the shotter) would make that coupling explicit.
