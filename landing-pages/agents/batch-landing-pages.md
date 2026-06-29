# Batch Landing Pages — URL List → Featured-Apps Page

End-to-end runbook for turning a raw bucket of deployed vibe URLs into a themed featured-apps page. This workflow was developed to handle the 102-line `notes/generated-apps.txt` output from batch generation runs.

## Input format

`notes/generated-apps.txt` uses this line format (tab or space-separated):

```
https://vibes.diy/vibe/<author>/<slug>  Short description — detail; detail; detail.
```

Each line is one deployed app. The description is the original generation prompt, usually a short phrase followed by semicolon-separated feature bullets.

## Step 1 — group by theme

There's no fixed page size. Existing pages range from 7 variants (`garden-and-plants.hbs`, `house-rules.hbs`) to 90+ (`hero-at-work.hbs`, `classroom-tools.hbs`). Large pages use `appsSections` to break the content into labelled sections; smaller pages use a flat `groups` list.

Pick natural clusters — same verb, same social context, same mood. Apps that don't fit any cluster can go into a misc bucket; ship themed pages first.

When apps share a near-identical description (two takes on the same concept), **collapse them into one `groups` entry with multiple `variants`** — the featured-apps README covers how this renders.

## Step 2 — pick a template

| Template | Use when | Examples |
|---|---|---|
| `standard` | Utility tools, clean UI | `household-logistics.hbs`, `garden-and-plants.hbs` |
| `editorial` | Loud, opinionated, zeitgeisty | `fitness-and-sports.hbs`, `hero-at-work.hbs` |
| `webring` | Community, nostalgic, intimate | `kitchen-and-cooking.hbs`, `pets.hbs` |

Full template + frontmatter schema: `src/pages/featured-apps/README.md`.

## Step 3 — write the .hbs page

Create `src/pages/featured-apps/<slug>.hbs`. For each app from the URL list, derive a `groups` entry:

```json
{
  "title": "Short Product Title",
  "description": "First sentence of the original description.",
  "variants": [{ "author": "<author>", "slug": "<slug>" }]
}
```

- `title`: 3–5 words, title case, invented from the description.
- `description`: the first sentence only — drives the card body and the "Start fresh from this prompt" link (via `{{prompt64}}`).
- Multiple takes on the same concept → one `groups` entry, multiple `variants` objects.

For large clusters (15+ apps), use `appsSections` to group by sub-theme. See `hero-at-work.hbs` for a live example.

## Step 4 — verify deploys are real

Before shipping a page, confirm each app isn't a stub:

```sh
curl -sL https://<slug>--<author>.prod-v2.vibesdiy.net/ | grep -E "fsId|mountVibe"
# Good: registerDependencies({…,"fsId":"z<CID>"}) … mountVibe([V1], …)
# Bad:  registerDependencies({…,"fsId":"pending"}) … mountVibe([], …)
```

Stubs come from failed or stuck deploys. Workaround: pick a fresh SEO slug, redeploy, update the entry. Don't keep retrying the same slug — stuck state sometimes pins to the slug itself.

## Step 5 — build and check

```sh
pnpm check
open _site/featured-apps/<slug>.html
```

## Step 6 — wire into the index

`src/pages/featured-apps/index.hbs` has a `<a class="cat-card coming-soon">` placeholder per page. Remove `coming-soon` when the page is live. The `.cat-card.coming-soon` CSS rule keeps un-flipped cards 55% opacity with `pointer-events: none`.

## Writing a batch _run.sh (for new apps, not already-deployed ones)

When apps need to be generated fresh, create `vibes/<cluster>/_run.sh`. Pattern from `vibes/games-classic-platformer/_run.sh`:

```bash
#!/usr/bin/env bash
set -u
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"
HERE="/Users/jchris/code/landing-pages/vibes/<cluster>"
cd "$HERE"
USER_SLUG="og"

gen() {
  local slug="$1"; shift
  local prompt="$*"
  ( "$TSX" "$MAIN" generate --user-slug "$USER_SLUG" --app-slug "$slug" "$prompt" \
    >"$HERE/$slug.log" 2>&1; echo "DONE $slug exit=$?" >> "$HERE/_status.log" ) &
}

: > "$HERE/_status.log"

gen <seo-slug> "<prompt under 50 words, no style dictation>"

wait
echo "ALL DONE" >> "$HERE/_status.log"
```

Run: `bash vibes/<cluster>/_run.sh`. Watch: `tail -F vibes/<cluster>/_status.log`.

**Always pin `--user-slug=og` explicitly.** Without it, the CLI uses whatever account was last logged in; apps land at `<wrong-user>/<slug>` while the page hard-codes `og`, and every embed white-screens. This has burned us before.

## Link conventions (applies to all pages, including custom arcade/webring HTML)

| Purpose | URL shape |
|---|---|
| Play / visit an app | `https://vibes.diy/vibe/{author}/{slug}` |
| Clone | `https://vibes.diy/clone/{author}/{slug}` |
| Remix | `https://vibes.diy/remix/{author}/{slug}` |
| Start fresh from prompt | `https://vibes.diy/chat/prompt?prompt64={{prompt64 desc}}` |
| Screenshot `src=` | `https://{slug}--{author}.prod-v2.vibesdiy.net/screenshot.jpg` |

**Never use the deploy host (`{slug}--{author}.prod-v2.vibesdiy.net`) as a Play `href`.** That URL is only for screenshot images. This burned us when arcade pages sourced from games-landing/index.html used raw deploy URLs for their links — they worked accidentally but were fragile and non-canonical.

When ingesting external HTML that has `href="https://{slug}--{author}.prod-v2.vibesdiy.net"`, rewrite those hrefs on import:

```sh
perl -pi -e 's|href="https://([\w-]+)--{author}\.prod-v2\.vibesdiy\.net"|href="https://vibes.diy/vibe/{author}/$1"|g' src/pages/<...>.hbs
```

Screenshot `src=` attributes stay on the deploy host — images are served there.

## Commit checklist

1. `pnpm check` — must pass clean.
2. `.hbs` files are in `.prettierignore` — do NOT run prettier on them. Run `npx prettier --write` only on any non-hbs files you changed.
3. Don't push to remote unless the user asks.
