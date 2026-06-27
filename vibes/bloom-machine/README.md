# bloom-machine

The music starter for the Instant Starter Stack (#1896), the first curated app
under the **`system`** handle. A 4×4 pad grid: each **row is a pitch**
(C-major pentatonic, top = highest) and each **column is a waveform**
(left → right: sine, triangle, sawtooth, square). Tapping a pad plays the note
via Web Audio and blooms it in that row's colour. No login, no backend — instant.

Live at [https://vibes.diy/vibe/system/bloom-machine](https://vibes.diy/vibe/system/bloom-machine).

Part of the Agent-in-Vibe UX epic ([#2675](https://github.com/VibesDIY/vibes.diy/issues/2675));
curated starters are real, addressable apps owned by the platform `system` handle
(epic §2).

## Deploy

Always pass `--vibe system/bloom-machine` so you don't publish under your default
handle by accident:

```sh
cd vibes/bloom-machine
npx vibes-diy push --vibe system/bloom-machine    # deploy (cli plane; shares prod data)
npx vibes-diy pull system/bloom-machine --dir .   # pull current live source
```

Stage on the default cli plane first, then re-push with
`--api-url https://vibes.diy/api` to ship to prod-v2.

## Notes

- **Keep source flat.** `push` only ships top-level files in this dir — no
  subdirectories. If a future layer (sequencer / sharing) adds helpers, keep them
  at the root.
- **No persistent data yet.** When sharing/sequencer state lands as Fireproof
  docs, add an `access.js` and decide the access posture (public vs constrained)
  before it ships.
