# Improve a Vibes App via Screenshot

> **Batch work?** Use [`agents/parallel-upgrade-loop.md`](parallel-upgrade-loop.md) instead — it dispatches one agent per category and processes all apps simultaneously. This file covers the single-app loop only.

Iterative visual polish loop: read screenshot → identify issues → edit locally → push → verify new release → repeat.

## How push works (grounding)

- `push` reads all files flat from `<dir>` (`.jsx .js .ts .tsx .css .html .json .md .txt .svg`; no recursion; no dotfiles).
- Each file gets a content-hash CID via `storage.ensure()`. The server then computes `fsId = SHA256(sorted{filename|mimetype|cid}... + env)`.
- **If fsId already exists for that slug+user → push is a no-op.** Zero bytes uploaded, no new release.
- **Any byte change → new fsId → new release.** No `--force` flag exists or is needed.
- `generate` is just LLM → write files locally → call push automatically. After that, all iteration is edit + push manually.

## Step 1 — read the current screenshot

```sh
curl -sfL "https://<slug>--<author>.prod-v2.vibesdiy.net/screenshot.jpg" -o /tmp/<slug>.jpg \
  && echo "ok" || echo "404/error — no screenshot yet"
```

The `-f` flag makes curl fail with a non-zero exit code on 4xx/5xx and saves nothing, so the output file stays absent rather than being silently overwritten with a JSON error body. Always check that the file exists and is a real JPEG before calling Read:

```sh
wc -c /tmp/<slug>.jpg && file /tmp/<slug>.jpg
# Good: >5KB, "JPEG image data"
# Bad: file absent, or JSON data
```

Use the Read tool on `/tmp/<slug>.jpg` to see it. Or use the Chrome MCP `navigate_page` + `take_screenshot` on `https://vibes.diy/vibe/<author>/<slug>` (always the wrapper URL — never the subdomain directly). Note specific issues: layout problems, contrast, missing content, broken spacing.

## Step 2 — find the local App.jsx

Generated apps land at `vibes/<cluster>/<slug>/App.jsx` relative to the repo root (the `generate` command writes to `<cwd>/<appSlug>/`). Hand-built apps may live at a custom path — check the relevant `_run.sh` or README.

## Step 3 — edit

Edit `App.jsx` directly. The file is plain React with no bundler. Changes take effect on next push — no local dev server needed for vibes apps (though you can run one if the app supports it).

Keep changes focused: one visual issue per iteration avoids compounding.

## Step 4 — push

```sh
TSX="/Users/jchris/code/fp/vibes.diy/vibes-diy/node_modules/.bin/tsx"
MAIN="/Users/jchris/code/fp/vibes.diy/vibes-diy/cli/main.ts"

cd vibes/<cluster>/<slug>
"$TSX" "$MAIN" push --user-slug <author>
```

**Must run from inside the app directory** — `push` reads the current directory's files. Running from the wrong directory pushes the wrong (or empty) file set.

## Step 5 — read new screenshot and repeat

Trust the CLI tool response — if `push` reports "Deployed", it landed. Wait ~5 seconds for the screenshot to regenerate (server-side async), then re-read it via `curl` + Read or Chrome MCP on `https://vibes.diy/vibe/<author>/<slug>`. If the screenshot looks unchanged, wait a moment and retry.

If push was a no-op (identical content → no new release), make a real change to the file and re-push.

## Common pitfalls

| Symptom                                       | Cause                                                  | Fix                                        |
| --------------------------------------------- | ------------------------------------------------------ | ------------------------------------------ |
| Push reports success but screenshot unchanged | Ran push from wrong cwd — wrong file set               | `cd` into the app dir first                |
| Screenshot unchanged after push               | File diff was whitespace-only, or edit wasn't saved    | Verify the file on disk; add a real change |
| Push no-op (identical content)                | Content-hash dedup — push correctly detected no change | Make a real change to the file             |
| Stuck slug (push succeeds but app is wrong)   | Slug state stuck in the CLI                            | Try a fresh SEO slug, redeploy             |
| Screenshot regenerates slowly                 | Server-side async render                               | Wait ~10s, hard-refresh                    |
