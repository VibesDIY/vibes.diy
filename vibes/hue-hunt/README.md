# hue-hunt

Wordle for **color words**: guess the 5-letter color (AMBER, AZURE, CORAL, TEAL…)
in 6 tries — one puzzle per day, with share-grid and streak stats. Curated
Games-tree copy of the hand-tuned [`jchris/hue-hunt`](https://vibes.diy/vibe/jchris/hue-hunt)
(a mind-games featured app).

Reached from `match-pairs` via the curated chip **"Hunt the color word instead"**.
Its own evolution chip:

- **Let me play unlimited rounds** → [`system/hue-rush`](https://vibes.diy/vibe/system/hue-rush)

Live at [https://vibes.diy/vibe/system/hue-hunt](https://vibes.diy/vibe/system/hue-hunt).
Part of the on-ramp starter stack (#2941).

## Deploy

Always pass `--vibe system/hue-hunt` so you don't publish under your default handle:

```sh
cd vibes/hue-hunt
npx vibes-diy push --vibe system/hue-hunt    # deploy
npx vibes-diy pull system/hue-hunt --dir .   # pull current live source
```
