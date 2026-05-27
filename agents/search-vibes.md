# search-vibes one-off script

`vibes-diy/cli/search-vibes.ts` — iterates all vibes via the list + load APIs and prints those whose `App.jsx` contains a given token.

**Not intended for production use.** Unbounded iteration is a DOS risk. Use once, locally, then discard results.

## Prerequisites

- Active vibes-diy CLI login (`vibes-diy login`).
- Run from the `vibes-diy/` package directory (needs local `node_modules`).

## Usage

```bash
cd /path/to/vibes.diy/vibes-diy
node_modules/.bin/tsx cli/search-vibes.ts [token] [--concurrency N]
```

Defaults: token = `ImgVibes`, concurrency = `20`.

Progress is written to stderr; matches (`userSlug/appSlug`) go to stdout — pipe stdout to a file:

```bash
node_modules/.bin/tsx cli/search-vibes.ts ImgVibes 2>progress.log | tee matches.txt
```

## How it works

1. Calls `listRecentVibes` (100/page) to enumerate all vibes with cursor pagination.
2. For each vibe, GETs `https://{appSlug}--{userSlug}.prod-v2.vibesdiy.net/App.jsx`.
3. Prints `userSlug/appSlug` for any that contain the token string.

## Changing the search token

Pass the token as the first positional argument:

```bash
node_modules/.bin/tsx cli/search-vibes.ts "useImgVibes"
```

## Concurrency

Default is 20 parallel fetches. Lower if you want to be gentler on the origin:

```bash
node_modules/.bin/tsx cli/search-vibes.ts ImgVibes --concurrency 5
```
