# tone-pairs

The **sonic evolution** of [`system/match-pairs`](https://vibes.diy/vibe/system/match-pairs):
every shape owns a note on a C-major pentatonic ladder (C4 → C7, one note per
shape, stable across games), and flipping a tile **plays it** — so your ears help
your memory. A match replays the pair's note with its octave; a miss gives a low
thud; finishing walks the board's notes low → high. Match by sight, sound, or both.

Reached from `match-pairs` via the curated chip **"Make the pairs play tones"**.

Live at [https://vibes.diy/vibe/system/tone-pairs](https://vibes.diy/vibe/system/tone-pairs).
Part of the on-ramp starter stack (#2941).

## Deploy

Always pass `--vibe system/tone-pairs` so you don't publish under your default handle:

```sh
cd vibes/tone-pairs
npx vibes-diy push --vibe system/tone-pairs    # deploy
npx vibes-diy pull system/tone-pairs --dir .   # pull current live source
```

## Notes

- **iOS Safari audio unlock** runs synchronously inside the tap gesture (the
  `ensureCtx()` call in `flipTile`) — see `prompts/pkg/llms/web-audio.md`.
