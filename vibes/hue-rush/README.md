# hue-rush

The **endless evolution** of [`system/hue-hunt`](https://vibes.diy/vibe/system/hue-hunt):
same color-word guessing, but no daily limit — finish a round and deal the next
color immediately ("Next Color →"). Win streaks are the score (rounds / won /
current streak / best streak persist per device in localStorage). Round words are
drawn at random, never the same twice in a row. Pure local state so an anonymous
`/start` visitor can play.

Reached from `hue-hunt` via the curated chip **"Let me play unlimited rounds"**.
A leaf of the Games tree.

Live at [https://vibes.diy/vibe/system/hue-rush](https://vibes.diy/vibe/system/hue-rush).
Part of the on-ramp starter stack (#2941).

## Deploy

Always pass `--vibe system/hue-rush` so you don't publish under your default handle:

```sh
cd vibes/hue-rush
npx vibes-diy push --vibe system/hue-rush    # deploy
npx vibes-diy pull system/hue-rush --dir .   # pull current live source
```
