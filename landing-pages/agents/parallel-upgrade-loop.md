# Parallel App Upgrade Loop

Batch screenshot → fix → push loop across all apps in a mind-games (or similar) cluster, using 8 parallel sub-agents — one per category.

## Prerequisites

1. **Pull App.jsx files locally** if they don't exist yet:
   - `vibes/<cluster>/_pull.sh` — fetches `App.jsx` from `https://<slug>--jchris.prod-v2.vibesdiy.net/App.jsx` for every slug.
   - Run: `bash vibes/<cluster>/_pull.sh`

2. **Permissions** — sub-agents need these in `.claude/settings.local.json`:
   ```json
   "Bash(curl *)",
   "Bash(wc *)",
   "Bash(file *)",
   "Bash(sleep *)",
   "Bash(/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx *)"
   ```

## Step 1 — map slugs to categories

```sh
for f in src/pages/<cluster>/*.hbs; do
  page=$(basename "$f" .hbs)
  [[ "$page" == "index" ]] && continue
  echo "=== $page ==="
  grep -oE '[a-z0-9-]+--jchris\.prod-v2\.vibesdiy\.net' "$f" | sed 's/--jchris.prod-v2.vibesdiy.net//'
done
```

## Step 2 — dispatch parallel agents

One agent per category (4 apps each). Each agent prompt must include:
- Category name and gameplay description
- Slugs → local App.jsx paths
- CLI vars (`TSX` / `MAIN`)
- The loop steps (see below)

**Per-app loop inside each agent:**
1. `curl -sfL "https://<slug>--jchris.prod-v2.vibesdiy.net/screenshot.jpg" -o /tmp/<slug>.jpg && wc -c /tmp/<slug>.jpg && file /tmp/<slug>.jpg`
2. Read `/tmp/<slug>.jpg` with the Read tool to see it visually.
3. Read the local App.jsx.
4. Identify real issues: broken layout, unplayable game, bad contrast, missing elements.
5. Edit App.jsx — improve don't rewrite; one clear issue per iteration.
6. Push: `cd vibes/<cluster>/<slug> && "$TSX" "$MAIN" push --user-slug jchris`
7. Sleep 8s, re-curl screenshot, Read to verify improvement.

**CLI vars:**
```sh
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
```

## Fetching App.jsx from prod

If no `_pull.sh` exists for the cluster, create one:
```sh
# Template for _pull.sh
AUTHOR=jchris
BASE="https://%s--${AUTHOR}.prod-v2.vibesdiy.net/App.jsx"
DIR="$(cd "$(dirname "$0")" && pwd)"
SLUGS=(slug-one slug-two ...)
for slug in "${SLUGS[@]}"; do
  mkdir -p "$DIR/$slug"
  curl -sfL "$(printf "$BASE" "$slug")" -o "$DIR/$slug/App.jsx" && echo "ok $slug" || echo "ERR $slug"
done
```

The endpoint `https://<slug>--<author>.prod-v2.vibesdiy.net/App.jsx` returns 200 with `text/javascript` for all live deploys.

## Notes

- Push is a no-op if file content is identical (content-hash dedup). Make a real change.
- Screenshot regenerates asynchronously — wait ~8s after push before re-reading.
- Stuck-slug symptom: screenshot looks identical even after a confirmed push. Fix: pick a new SEO slug and redeploy.
- Sub-agents blocked on Bash = missing permissions in `settings.local.json`. Add the five rules above and re-dispatch.
