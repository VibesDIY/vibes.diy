# word-jumble

The **Games starter** for the Instant Starter Stack: six scrambled letter tiles,
one hidden word — tap the tiles to spell it. The simplest possible
letters-into-words loop; streaks persist per device in localStorage. Pure local
state (Bloom rule), so an anonymous `/start` visitor plays instantly.

Its evolution chip pulls on the same thread, several sizes up:

- **Grow it into a spelling hive** → [`jchris/spelling-hive`](https://vibes.diy/vibe/jchris/spelling-hive)
  — 7 letters in a comb, real ENABLE-dictionary word lists, ranks, and a public
  top-50 leaderboard with a backend daily prune.

Live at [https://vibes.diy/vibe/system/word-jumble](https://vibes.diy/vibe/system/word-jumble).
Part of the on-ramp starter stack (#2941).

## Deploy

Always pass `--vibe system/word-jumble` so you don't publish under your default handle:

```sh
cd vibes/word-jumble
npx vibes-diy push --vibe system/word-jumble    # deploy
npx vibes-diy pull system/word-jumble --dir .   # pull current live source
```
