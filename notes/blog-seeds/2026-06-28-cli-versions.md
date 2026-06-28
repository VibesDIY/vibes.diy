# Reach any version from the terminal: `versions` + draft-aware `pull`

Source: #2772 PR-D3 (CLI draft/published + versions), branch `claude/vibe-cli-versions`.
Spec: `docs/superpowers/specs/2026-06-28-vibe-draft-publish-design.md` §3d. The CLI half of the
draft/publish model — D1 made the draft legible in the browser, D2 made it publishable, D3
makes the whole version stack reachable from the terminal.

Goal: the owner's round-trip (`pull` → edit → `push`) should operate on the source they actually
see live (their latest draft), `--published` should opt back to the public version, and a new
`versions` command should list every release so you can `pull --fsId <id>` any of them.

Findings worth a full post:

- **The default flips to "what you see is what you pull."** `pull` now defaults to
  `selectMode: "ownerLatest"` — the owner gets their latest in-place draft, the same thing the
  `/vibe` page re-pins them to (D1). `--published` forces production; `--fsId` pins an exact
  version. The three map cleanly onto one `getAppByFsId` call: `fsId` wins, else `--published`
  omits selectMode, else `ownerLatest`. Non-owners need no special-casing in the CLI — the server
  downgrades `ownerLatest` to published for anyone who doesn't own the app (D1's owner check), so
  the same default is safe for everyone.

- **`versions` reuses the source-fetch trick, so it needs no new serving path.** Pulling a draft
  by fsId works because an fsId-pinned URL serves that exact row's source to anyone with the link
  (the same property D1 leaned on for the browser re-pin). So `pull --fsId` is just the existing
  per-file `…/~fsId~/file?source=true` fetch with a different fsId — no auth-gated draft download
  endpoint to build.

- **`listVersions` mirrors the read-gating it already had.** The new backend read returns ALL rows
  (dev + production) to the owner and ONLY production rows to everyone else — the exact owner gate
  `getAppByFsId` uses. The `published` marker is computed server-side as "the row whose releaseSeq
  is the max production seq," so the CLI's `●`/`○` rendering never has to re-derive which version is
  live; it just trusts the flag. Same single-source-of-truth discipline as the badge clearing
  itself after publish in D2.

- **`codegen-log` needed nothing.** The spec flagged aligning its "current" pointer to the draft,
  but the command lists chat turns (which already carry their dev fsIds) and never resolves a
  published-vs-draft pointer through `getAppByFsId` — so there was no pointer to realign. Worth
  noting the non-change so the next person doesn't go looking for it.
