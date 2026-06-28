# A 2s settle delay before the screenshot fires

Source: `vibes.diy/api/queue/screen-shotter.ts`

The screenshot queue navigates to a vibe with `waitUntil: "networkidle0"` and then
immediately calls `page.screenshot(...)`. In practice that fired too early: network
idle means "no requests in flight," not "the page has finished painting." Vibes
hydrate client-side, pull fonts, and do a late layout pass — all of which can land
*after* the last network request settles. The result was screenshots of a
half-rendered app.

The fix is a flat 2-second pause between navigation and capture:

```ts
await new Promise((resolve) => setTimeout(resolve, 2000));
```

Decisions worth a full post:

- **`networkidle0` is a network signal, not a render signal.** The two are
  correlated but not the same. There's no general DOM event for "the app looks
  done" — the honest options are a fixed delay or app-specific readiness probes.
  For a screenshot-of-anything pipeline, a fixed delay is the robust choice: it
  doesn't assume anything about the vibe's framework or markup.
- **Why a constant, not a smarter wait.** A `waitForSelector` would need to know
  what each vibe renders; these apps are arbitrary user code, so there's no
  selector we can count on. The trade-off we accept is +2s of latency per
  screenshot in exchange for not capturing mid-render.

Gotcha: this adds 2s to every screenshot job, on top of the up-to-30s `goto`
timeout. If screenshots ever move onto a latency-sensitive path, this is the
first knob to revisit — and the place to consider a real readiness probe instead
of a blanket sleep.
