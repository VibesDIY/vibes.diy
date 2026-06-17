---
name: vibe-code
description: Pull, edit, and push the SOURCE CODE of a deployed vibe (App.jsx, access.js, components) using the vibes-diy CLI. Use this skill when the user wants to change how a vibe behaves or looks, inspect or fix a vibe's code or access-control rules, ship an edit to a live app, deploy to prod vs cli/dev, or roll a fix into an already-deployed vibe. Trigger on phrases like "pull the source of vibe X", "edit this vibe's App.jsx", "change the access rules", "push the app", "deploy this change", "fix the vibe and redeploy", "ship it to production". For DATA in a vibe (documents, queries) use vibe-data instead.
---

# /vibe-code -- pull, edit, and push vibe source via the CLI

This skill covers the **code** side of a vibe — `App.jsx`, components, and the `access.js` access-control function — using the `vibes-diy` CLI. For **data** (documents, queries, CRUD) use the `vibe-data` skill instead. The two are siblings: `vibe-code` changes how the app behaves; `vibe-data` changes what's stored in it.

## Prerequisites

Log in once per device; all later commands authenticate automatically:

```bash
npx vibes-diy login
```

Pushing under someone else's handle requires an **editor grant** on that vibe — without it, `pull` returns "Access denied" and `push` fails server-side.

## The loop: pull → edit → push → verify

### 1. Pull the source to disk

```bash
npx vibes-diy pull garden-gnome/story-crossroads --dir /tmp/story-crossroads
```

- The positional arg takes `handle/app-slug` (or use `--vibe garden-gnome/story-crossroads`). Omit the handle to use your own.
- `--dir` is optional; without it files land in `./<app-slug>/`.
- Writes the vibe's **top-level** source files: `App.jsx`, the access-control file **`access.js`**, and any other root files (`.jsx/.js/.ts/.tsx/.css/.html/.json/.md/.txt/.svg`). Built/transformed assets are not pulled. Vibe source is **flat** — `push` only round-trips top-level files (see step 3), so keep all editable code at the root, not in subdirectories.

### 2. Edit

Edit `App.jsx` and friends like any React source. Follow the in-repo vibe authoring rules — run `npx vibes-diy system` for the current coding rules, and see `notes/vibes-app-jsx.md` in this repo.

`access.js` exports the server-run access function `(doc, oldDoc, user, ctx)` that assigns each written doc to channels. It must return `{ channels: [...], grant: {...} }` for every doc type the app writes, or throw `{ forbidden: "..." }` to reject. **A doc type the function neither returns for nor explicitly handles will fail the write** (`Failed to put document: unknown document type`). `user` is `{ userHandle, isOwner }` (or `null` when anonymous). Common shape:

```js
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.type === "note") {
    // author-only write, public read
    const author = oldDoc ? oldDoc.authorHandle : doc.authorHandle;
    if (author !== user.userHandle) throw { forbidden: "not your doc" };
    return { channels: ["notes"], grant: { public: ["notes"] } };
  }
  throw { forbidden: "unknown document type" };
}
```

### 3. Push (deploy)

`push` uploads from the **current working directory** (there is no "push this path" flag) and defaults `--app-slug` to the directory name. `cd` in first:

```bash
cd /tmp/story-crossroads
npx vibes-diy push --vibe garden-gnome/story-crossroads --mode production
```

- `push` reads **top-level files only** — `readProjectFiles` does not recurse, so files in subdirectories are silently skipped. Keep all editable source at the vibe root.
- `--mode` (`production`|`dev`) sets the app's **deploy mode**, NOT the environment. It's passed to `ensureAppSlug` and does not change routing — `--mode dev` still talks to whatever `--api-url` you give (default: the cli plane). To target a specific _environment_, set `--api-url` (next section); don't reach for `--mode dev` expecting the dev worker.
- Pushing under another handle: pass `--vibe handle/app-slug` (or `--app-slug` + `--handle`) explicitly.
- Public access + auto-accept-editor are **on by default**. `--instant-join`/`--public` are deprecated no-ops; use `--private` to opt OUT.
- Large pushes can hit the ~30s idle timeout — bump `--idle-timeout <ms>`.

### 4. Verify it deployed

Don't trust "Deployed:" alone — re-pull into a scratch dir and confirm your change is present:

```bash
npx vibes-diy pull garden-gnome/story-crossroads --dir /tmp/verify-sc
grep -n "<a marker from your edit>" /tmp/verify-sc/App.jsx
grep -n "<rule you changed>" /tmp/verify-sc/access.js
```

End-to-end behavior (does the running app work?) still needs a human or `qa-pr` browser pass — re-pull only proves the bytes shipped.

## Environment: prod vs cli vs dev (the key gotcha)

The default `--api-url` is `https://vibes.diy/api?.stable-entry.=cli` — the **cli** plane, _not_ prod. cli shares the prod data plane, so for most work it's equivalent, but they are different worker deploys.

- **Target prod explicitly:** `--api-url https://vibes.diy/api` (no `.stable-entry.=cli` marker → resolves to `prod-v2`). `--mode production` alone does **not** do this — the plane is the `--api-url`, not the mode.
- **Be consistent:** pull and push from the _same_ `--api-url`, or you'll edit cli's source and diff against prod's (or vice versa).
- **Safer rollout:** stage on the cli plane first (default `--api-url`), confirm, then repeat the push with `--api-url https://vibes.diy/api` for the final prod ship.

See `agents/environments.md` for the full dev/prod/cli/preview architecture.

## Quick reference

| Goal                | Command                                                                                |
| ------------------- | -------------------------------------------------------------------------------------- |
| Log in              | `npx vibes-diy login`                                                                  |
| Pull source         | `npx vibes-diy pull <handle>/<app> --dir <dir>`                                        |
| Stage on cli first  | `cd <dir> && npx vibes-diy push --vibe <handle>/<app>` (default `--api-url` = cli)     |
| Push to prod        | `cd <dir> && npx vibes-diy push --vibe <handle>/<app> --api-url https://vibes.diy/api` |
| AI follow-up edit   | `npx vibes-diy edit --help`                                                            |
| Generate a new vibe | `npx vibes-diy generate --help`                                                        |
| Coding rules        | `npx vibes-diy system`                                                                 |

## Common mistakes

- **Pushing the wrong directory** — `push` is always `cwd`; `cd` into the pulled folder first.
- **Wrong env** — default is cli, not prod. Add `--api-url https://vibes.diy/api` for prod, and keep pull/push on the same plane.
- **`--mode dev` is not the dev environment** — it's the app's deploy mode and does not change routing. Environment is the `--api-url` plane.
- **Nested files don't push** — `push` reads top-level files only; subdirectories are silently skipped. Keep source flat at the vibe root.
- **`unknown document type`** — `access.js` doesn't return for a type the app writes (e.g. ImgGen's docs). Add a branch returning `{ channels, grant }` for it.
- **No editor grant** — pushing under another handle needs write access on that vibe.
- **Confusing code with data** — schema/UI/access-rules = this skill; documents/queries = `vibe-data`.
