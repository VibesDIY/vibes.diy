# bloom-root

The **root music starter** for the Instant Starter Stack (the music chip, #1896):
just a 4×4 grid of tones you can play. Each **row is a pitch** (C-major pentatonic,
top = highest) and each **column is a waveform** (sine, triangle, sawtooth, square).
Hold a pad to sound its note (sustained until release) and light it in that note's
colour. Pure Web Audio + local state — no login, no backend, no DB.

This is the **evolutionary root** the curated tree grows from. Suggested chips:

- **Add a pattern sequencer** → [`system/bloom-machine`](https://vibes.diy/vibe/system/bloom-machine)
- **Make it a memory game** → [`system/bloom-says`](https://vibes.diy/vibe/system/bloom-says)

Credit: inspired by [Bloom](https://generativemusic.com/bloom.html) by Brian Eno and
Peter Chilvers (linked in-app).

Live at [https://vibes.diy/vibe/system/bloom-root](https://vibes.diy/vibe/system/bloom-root).
Part of the Agent-in-Vibe UX epic ([#2675](https://github.com/VibesDIY/vibes.diy/issues/2675)).

## Deploy

Always pass `--vibe system/bloom-root` so you don't publish under your default handle:

```sh
cd vibes/bloom-root
npx vibes-diy push --vibe system/bloom-root    # deploy
npx vibes-diy pull system/bloom-root --dir .   # pull current live source
```

## Notes

- **iOS Safari audio unlock** runs synchronously inside the first pad gesture —
  see `prompts/pkg/llms/web-audio.md`.
- Keep source flat — `push` only ships top-level files.
