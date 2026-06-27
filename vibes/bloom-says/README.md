# bloom-says

A **Simon-says memory game** on the Bloom grid — a fork of
[`system/bloom-machine`](https://vibes.diy/vibe/system/bloom-machine) that keeps the
same 4×4 tone/colour pads but, instead of an instrument/looper, plays a growing
sequence you have to copy. Get it right and the sequence grows by one; miss it and
it buzzes and starts over. Pure Web Audio + local state — no login, no backend, no DB.

Each **row is a pitch** (C-major pentatonic, top = highest) and each **column is a
waveform** (sine, triangle, sawtooth, square). A pad beeps and flashes in its row's
colour both on playback and when you tap it.

Live at [https://vibes.diy/vibe/system/bloom-says](https://vibes.diy/vibe/system/bloom-says).
Part of the Instant Starter Stack (the music chip's curated tree, #1896) under the
Agent-in-Vibe UX epic ([#2675](https://github.com/VibesDIY/vibes.diy/issues/2675)).

## Deploy

Always pass `--vibe system/bloom-says` so you don't publish under your default handle:

```sh
cd vibes/bloom-says
npx vibes-diy push --vibe system/bloom-says    # deploy
npx vibes-diy pull system/bloom-says --dir .   # pull current live source
```

## Notes

- **iOS Safari audio unlock** runs synchronously inside the first gesture (Start
  button / pad tap) — see `prompts/pkg/llms/web-audio.md`.
- Keep source flat — `push` only ships top-level files.
