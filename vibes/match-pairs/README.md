# match-pairs

The **Games starter** for the Instant Starter Stack: a classic flip-two memory
board. Tap to flip, find the pairs, race your own best (moves + time, personal
bests persist per device in localStorage). Touch-first, zero instructions needed.
Adapted from the hand-tuned [`jchris/memory-pairs`](https://vibes.diy/vibe/jchris/memory-pairs)
(a mind-games featured app) — reworked from its shared-Fireproof board to **pure
local state** (Bloom-style) so an anonymous `/start` visitor can _play_, not
spectate.

This is the **evolutionary root** the Games tree grows from. Suggested chips:

- **Make the pairs play tones** → [`system/tone-pairs`](https://vibes.diy/vibe/system/tone-pairs)
- **Hunt the color word instead** → [`system/hue-hunt`](https://vibes.diy/vibe/system/hue-hunt)

Live at [https://vibes.diy/vibe/system/match-pairs](https://vibes.diy/vibe/system/match-pairs).
Part of the on-ramp starter stack (#2941).

## Deploy

Always pass `--vibe system/match-pairs` so you don't publish under your default handle:

```sh
cd vibes/match-pairs
npx vibes-diy push --vibe system/match-pairs    # deploy
npx vibes-diy pull system/match-pairs --dir .   # pull current live source
```
