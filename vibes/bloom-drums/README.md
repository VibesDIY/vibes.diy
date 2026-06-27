# bloom-drums

The **pattern sequencer with drums** — a fork of
[`system/bloom-machine`](https://vibes.diy/vibe/system/bloom-machine) that keeps the
whole sequencer (16-step playhead, hold-to-record with quantize + duration,
colour-pie dots, BPM stepper, saturation + one-beat delay FX, save/load to
Fireproof) but swaps the pitched tones for **noise-based drum voices**.

Each **row is a drum** (hi-hat / clap / snare / kick) — looping white noise through
a band filter — and each **column is a brighter/duller variant** of that drum. Hold
a pad to sound it (sustained until release); the hit records into the active pattern.

Live at [https://vibes.diy/vibe/system/bloom-drums](https://vibes.diy/vibe/system/bloom-drums).
Part of the music chip's curated tree (#1896) under the Agent-in-Vibe UX epic
([#2675](https://github.com/VibesDIY/vibes.diy/issues/2675)) — a sibling of
`bloom-machine` off the `bloom-root` start.

## Deploy

Always pass `--vibe system/bloom-drums` so you don't publish under your default handle:

```sh
cd vibes/bloom-drums
npx vibes-diy push --vibe system/bloom-drums    # deploy
npx vibes-diy pull system/bloom-drums --dir .   # pull current live source
```

## Notes

- **iOS Safari audio unlock** runs synchronously inside the first gesture —
  see `prompts/pkg/llms/web-audio.md`.
- Keep source flat — `push` only ships top-level files.
