# spelling-hive

The word-games evolution target of the `/start` **Games** lane: NYT-Spelling-Bee
style — 7 letters in a comb, the center letter required, 4+ letter words,
pangrams use all seven.

Reworked from the original `jchris/spelling-hive`:

- **Real word lists.** Puzzles live in the `puzzles` database (curated 7-letter
  sets validated against the public-domain ENABLE dictionary, slur-filtered),
  populated via the CLI — no more callAI-hallucinated word lists. Today's puzzle
  picks itself by date-hash; Prev/Next roams the set.
- **Your game is yours.** Found words + running score live in local state +
  localStorage, per device and puzzle. Anonymous visitors play fully (no
  spectator lock, no failed writes).
- **Only the board is public.** A signed-in player's best single-puzzle score
  (score + handle, never the word list) upserts into the `scores` database.
- **Daily prune.** `backend.js` ticks hourly (platform interval caps at 1h) and
  once a day prunes `scores` to the top 50 via `ctx.db.query` → `delete` —
  the backend read lane added for exactly this.

Deploys to **jchris/spelling-hive** (the original app, improved in place):

```sh
cd vibes/spelling-hive
npx vibes-diy push --vibe jchris/spelling-hive
```

Populate/refresh the puzzles (generator: scratchpad `gen-puzzles.py`, ENABLE
list + curated pangram seeds):

```sh
jq -c '.[]' puzzles.json | while read -r doc; do
  npx vibes-diy db put --vibe jchris/spelling-hive --db puzzles - <<<"$doc"
done
```

Reached from `system/word-jumble` via the curated chip **"Grow it into a
spelling hive"**. Part of the on-ramp starter stack (#2941).
