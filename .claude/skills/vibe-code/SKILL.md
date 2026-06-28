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

> **Validating a just-merged CLI feature?** `npx vibes-diy@latest` is the **published** package and publishing is tag-driven, so it can lag `main` — a subcommand that exists in repo source (`vibes-diy/cli/cmds/`, registered in `main.ts`) may not be in the published binary until the next CLI release. If a just-merged subcommand errors with "Not a valid subcommand name" under `@latest`, run the **repo-local** CLI instead (`node vibes-diy/cli/run.js <cmd>` — needs deps installed + `tsx`); don't conclude the feature regressed.

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

## Inspect the chat: why did the app turn out this way?

When an app shipped wrong — a file is missing, two files got merged, the wrong code landed — read **what the model actually replied with**, not just the user prompt. `pull` gives you the current bytes; `codegen-log` gives you the generation that produced them. (For the deployed app's own _runtime_ chat data — a chat-bot vibe's messages — use `app-chats` instead.)

```bash
npx vibes-diy codegen-log garden-gnome/alignment-chart                       # list build turns (chatId + time)
npx vibes-diy codegen-log garden-gnome/alignment-chart <chatId>              # the user prompt(s) for that turn
npx vibes-diy codegen-log garden-gnome/alignment-chart <chatId> --response   # the MODEL's reply
```

`--response` reconstructs the model's reply from the stored block events and **annotates each code fence with the path the parser bound it to** — so you can see directly which file each block became. Modifiers (each implies `--response`, so they also work on their own):

- `--turn <promptId>` — pick a turn in a multi-turn chat (default: newest; the command prints the total turn count and the selected turn's `promptId`).
- `--files` — the resolved `path → content` map: **what actually got written**. Cross-check it against the filename labels in `--response`: if the model named a file (e.g. an `access.js` label line) that has no matching key in `--files`, that block was misrouted.
- `--jsonl` — the raw block events, one JSON object per line (for `jq` / fixtures).
- `--raw` — byte-faithful model text captured upstream of the parser (preserves consumed filename labels and blank lines). **New generations only** — older chats have no raw capture and the command says so; fall back to the default `--response` or `--jsonl`.
- `--user` — also print the prompt(s) so the transcript reads top-down.

The tell for a path mis-bind: `--response` annotates each fence with the path the parser **bound** it to (e.g. ` ```js App.jsx `), not the name the model typed. A filename the model emitted but the parser did **not** consume is left as a **bare prose line just above the fence**. So a clobber reads as a prose line `access.js` directly above a fence annotated ` ```js App.jsx ` — the orphaned label and the bound path disagree — and `--files` confirms it: only `App.jsx`, holding that content, no `access.js` key. (A label the parser _did_ consume is suppressed from prose and the fence already shows the right path, so the thing to grep for is an orphaned filename line whose name is missing from `--files`.) Use `--raw` if you need the model's exact original framing inline.

## Environment: prod vs cli vs dev (the key gotcha)

The default `--api-url` is `https://vibes.diy/api?.stable-entry.=cli` — the **cli** plane, _not_ prod. cli shares the prod data plane, so for most work it's equivalent, but they are different worker deploys.

- **Target prod explicitly:** `--api-url https://vibes.diy/api` (no `.stable-entry.=cli` marker → resolves to `prod-v2`). `--mode production` alone does **not** do this — the plane is the `--api-url`, not the mode.
- **Be consistent:** pull and push from the _same_ `--api-url`, or you'll edit cli's source and diff against prod's (or vice versa).
- **Safer rollout:** stage on the cli plane first (default `--api-url`), confirm, then repeat the push with `--api-url https://vibes.diy/api` for the final prod ship.

See `agents/environments.md` for the full dev/prod/cli/preview architecture.

## Quick reference

| Goal                   | Command                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| Log in                 | `npx vibes-diy login`                                                                    |
| Pull source            | `npx vibes-diy pull <handle>/<app> --dir <dir>`                                          |
| Stage on cli first     | `cd <dir> && npx vibes-diy push --vibe <handle>/<app>` (default `--api-url` = cli)       |
| Push to prod           | `cd <dir> && npx vibes-diy push --vibe <handle>/<app> --api-url https://vibes.diy/api`   |
| AI follow-up edit      | `npx vibes-diy edit --help`                                                              |
| Generate a new vibe    | `npx vibes-diy generate --help`                                                          |
| List build turns       | `npx vibes-diy codegen-log <handle>/<app>`                                               |
| Inspect model reply    | `npx vibes-diy codegen-log <handle>/<app> <chatId> --response [--files\|--jsonl\|--raw]` |
| Read app runtime chats | `npx vibes-diy app-chats <handle>/<app> [<chatId>]`                                      |
| Coding rules           | `npx vibes-diy system`                                                                   |

## Common mistakes

- **Pushing the wrong directory** — `push` is always `cwd`; `cd` into the pulled folder first.
- **Wrong env** — default is cli, not prod. Add `--api-url https://vibes.diy/api` for prod, and keep pull/push on the same plane.
- **`--mode dev` is not the dev environment** — it's the app's deploy mode and does not change routing. Environment is the `--api-url` plane.
- **Nested files don't push** — `push` reads top-level files only; subdirectories are silently skipped. Keep source flat at the vibe root.
- **`unknown document type`** — `access.js` doesn't return for a type the app writes (e.g. ImgGen's docs). Add a branch returning `{ channels, grant }` for it.
- **No editor grant** — pushing under another handle needs write access on that vibe.
- **Confusing code with data** — schema/UI/access-rules = this skill; documents/queries = `vibe-data`.
- **Guessing why an app shipped wrong** — don't reverse-engineer from the deployed bytes alone; read the generation with `chats <vibe> <chatId> --response` (and `--files`) to see what the model emitted and which file each block bound to.
