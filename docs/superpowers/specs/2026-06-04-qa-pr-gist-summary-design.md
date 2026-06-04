# qa-pr: gist-backed triage with a concise sticky PR comment

**Date:** 2026-06-04
**Branch:** `popmechanic/qa-pr-gist-summary` (off `origin-https/main`, which holds the merged skill)
**Skill:** [`.claude/skills/qa-pr/SKILL.md`](../../../.claude/skills/qa-pr/SKILL.md)

## Problem

The `qa-pr` skill posts the **entire** P0/P1/P2 triage — summary, every finding with
repro steps, cross-cutting patterns, the full output schema — directly into the PR
thread as a single `gh pr comment --body-file triage.md`. When a reviewer reads a PR
into a working context, that whole report comes with it.

> "it would be cool if the bot posted like a 2 line response plus a link. it could put
> the rest of the info in a github gist and link to it. the long responses are token
> pollution when I'm building a surgical context." — @jchris

Three changes follow from that feedback:

1. The full triage moves to a **public GitHub gist**; the PR comment becomes a concise
   summary + link.
2. Evidence **screenshots render inline in the gist** (they render nowhere today —
   findings reference local file paths only).
3. Reruns **stop piling up comments**: one sticky qa-pr comment per PR, edited in place.

## Design decisions (locked)

| Decision | Choice |
|---|---|
| PR comment body | Concise narrative title of the PR + verdict + P0/P1/P2 counts + gist link. Slightly over two lines is fine; no findings inline. |
| Gist visibility | **Public** (`gh gist create --public`). |
| Gist-create failure | **Fall back to full inline comment** (current behavior) + a one-line "gist upload failed" note. The report is never lost. |
| Screenshots | **Inline-embedded via two-pass publish.** Only the screenshots that findings reference (evidence); per-step working captures stay local. |
| Screenshot transport | `gh gist create` refuses binaries, so PNGs are pushed into the gist's **git repo** (`gh gist clone` + `git push`), which renders them inline via raw URLs. |
| Pass-2 (git push) failure | Do **not** fall back to inline comment — the gist already holds the triage text (screenshot tokens left as literal placeholders, no images). Post the comment with the gist link anyway. |
| Comment dedup | **Sticky edit-in-place** via a hidden HTML marker. One qa-pr comment per PR, always current. |

## What changes, section by section

### Step 7 — Render and post (the core rewrite)

Today Step 7 finalizes `triage.md`, greps for leftover placeholders, then runs one
`gh pr comment`. The new flow:

1. **Finalize** `qa-reports/{run_id}/triage.md` — unchanged placeholder-grep gate.
2. **Publish the gist (two-pass).** See *Screenshots* below. Result: a public gist URL.
   - If **pass 1** (`gh gist create`) fails → **gist-failure fallback**: post the full
     `triage.md` inline exactly as the skill does today, body prefixed with
     `> ⚠️ Gist upload failed; full triage inline below.`, carrying the dedup marker.
     Skip the remaining steps.
   - If **pass 2** (`gh gist clone` + `git push`) fails → continue with the gist URL from
     pass 1; the gist shows the triage text with screenshot placeholders (no images). Note
     nothing extra in the comment.
3. **Compose the concise comment** into `qa-reports/{run_id}/comment.md`, derived from
   fields already in the triage, and carrying the hidden dedup marker:

   ```markdown
   <!-- qa-pr-triage-comment -->
   ## QA: <PR title> — <verdict>

   <one-sentence narrative: how the PR's change held up across desktop + mobile>

   **<x> P0 · <y> P1 · <z> P2** across desktop + mobile · [Full triage ↗](<gist-url>)
   ```

4. **Post or update (sticky).** See *Comment dedup* below.
5. **Print** the comment URL and the gist URL to the session.
6. **Sign-out cleanup** — unchanged.

### Screenshots — two-pass inline embed

**Scope:** the evidence set = the union of `findings[].screenshots`. Per-step working
captures (`1-signin-desktop.png`, etc.) that no finding references stay local, as today.

**Mechanism (two-pass — create text-only, then git-push the images):** `gh gist create`
**refuses binary files** ("binary file not supported"), so PNGs cannot ride along on the
CLI create call. They go in via the gist's underlying **git repo**, which does accept
binaries — verified empirically: a PNG pushed into a gist serves `image/png` at HTTP 200
from its raw URL and renders inline.

1. **Pass 1 — create (text-only):**
   ```bash
   gh gist create --public --desc "<desc>" qa-reports/{run_id}/triage.md
   ```
   Only `triage.md` (no PNG args). Parse stdout for the gist URL → derive `<owner>` and
   `<gist_id>` (last path segment) and `<raw_base> =
   https://gist.githubusercontent.com/<owner>/<gist_id>/raw/`.
   `<desc>` = `qa-pr triage — PR #<N> — <verdict> (<run_id>)`.
2. **Rewrite `triage.md`:** replace each `{{EVIDENCE:<basename>.png}}` token with a sized,
   click-through thumbnail at the raw gist URL:
   ```html
   <a href="<raw_base><basename>.png"><img src="<raw_base><basename>.png" width="240"></a>
   ```
   The thumbnail lands in the finding's **Evidence** slot (template change below).
3. **Pass 2 — git-push the PNGs + rewritten triage:**
   ```bash
   gh gist clone <gist_id> "$dir"
   cp qa-reports/{run_id}/<evidence>.png "$dir"/
   cp qa-reports/{run_id}/triage.md "$dir"/triage.md
   git -C "$dir" add -A && git -C "$dir" commit -m "qa-pr: evidence for {run_id}" && git -C "$dir" push
   ```
   One commit carries both the evidence images and the rewritten markdown; the raw URLs
   then serve the images and `triage.md` renders them inline. (No `gh gist edit` — the git
   push replaces it.)

**Edge cases:**
- **Zero evidence screenshots** (clean pass, or capture failed) → no images to embed,
  the flow collapses to a single text-only `gh gist create`, no rewrite, no git push.
- **Pass-2 failure** (clone/commit/push) → degrade as described in Step 7: the gist exists
  with the triage text (screenshot tokens left as literal placeholders, no images); post
  the comment with the gist link anyway.

**Why two passes:** the gist id (hence `<raw_base>`) isn't known until the gist exists, and
binaries can't go through `gh gist create` at all — so create text-only to learn the id,
then push images + the URL-rewritten triage into the gist repo with git.

### Comment dedup — sticky via hidden marker

Every comment the skill writes (the concise summary **and** the inline-fallback) carries
`<!-- qa-pr-triage-comment -->`. Posting is find-or-create:

1. **Find prior:**
   ```bash
   gh api repos/VibesDIY/vibes.diy/issues/<N>/comments --paginate \
     --jq '.[] | select(.body | contains("<!-- qa-pr-triage-comment -->")) | {id, user: .user.login}'
   ```
   Keep only the entry authored by the current `gh` user (`gh api user --jq .login`) — so
   the skill never edits someone else's comment. If multiple match, take the latest.
2. **Found → edit:**
   ```bash
   gh api repos/VibesDIY/vibes.diy/issues/comments/<id> -X PATCH -F body=@qa-reports/{run_id}/comment.md
   ```
3. **None → create:**
   ```bash
   gh pr comment <N> --body-file qa-reports/{run_id}/comment.md
   ```

One qa-pr comment per PR, always current. Each run still creates a fresh gist; history is
preserved off-thread in `runs.jsonl` (below).

### Authorization section rewrite

Today: authorizes **exactly one** GitHub write (`gh pr comment`). New: authorizes three
write *operations*, all no-confirmation:

1. **Gist publish** — `gh gist create --public …`, then (when there are evidence images)
   `gh gist clone <id>` + a `git commit`/`git push` into that gist's own repo to add the
   PNGs and the rewritten triage (one logical publish).
2. **Comment post** — `gh pr comment <N> …` **or** the comment-edit
   `gh api …/issues/comments/<id> -X PATCH …`. Editing only ever targets the skill's own
   prior marked comment on the PR under test.

Still forbidden, unchanged: opening issues, editing PR titles/descriptions, requesting
review, merging, pushing commits **to the project repo or any non-gist remote**,
commenting on other PRs, any other GitHub write. The git push in (1) targets only the
operator's own throwaway triage gist — not the project repo. The "exactly one write"
wording is replaced; the forbidden list is otherwise preserved.

### Frontmatter + intro copy

- `description:` ending changes from "…and posts it as a PR comment." to
  "…publishes the full triage with inline screenshots as a public gist and posts or
  updates a single concise summary comment on the PR."
- The intro paragraph's "posts it as a comment on the PR" gets the matching touch-up.

### Output schema (Step 6) + triage template

- `findings[].screenshots` already exists; the spec now says these get embedded inline in
  the gist as sized thumbnails.
- **Triage template** (`assets/triage-template.md`): the P0/P1 finding tables (and P2 if
  it carries evidence) gain an **Evidence** column (or a per-finding image beneath the
  table) where the two-pass rewrite injects the thumbnail `<img>`. The footer line
  "*Raw run artifacts … are not attached to this comment.*" updates to note that evidence
  screenshots now live in the gist; non-evidence artifacts remain local.

### Run log (`runs.jsonl`)

The appended record gains `gist_url` and `comment_id` fields so run history (including
every gist URL) is preserved even though the sticky comment shows only the latest run.

### Failure modes

All existing partial-triage branches (OAuth sign-in fails, generation never completes,
`resize_page` fails, etc.) already "post the partial triage" — they now route through the
**same Step 7 path** and inherit gist publish + sticky comment for free. The two new
failure surfaces:

- **Gist create (pass 1) fails** → full inline comment fallback (still deduped via marker).
- **Git push of evidence (pass 2) fails** → post comment with gist link; the gist shows the
  triage text with screenshot placeholders (no images embedded).

## Out of scope

- Uploading the per-step working screenshots (only finding-evidence images go to the gist).
- Migrating prior runs' already-posted full-triage comments (the first sticky run simply
  creates a new marked comment; old unmarked comments are left as-is).
- Gist cleanup / lifecycle (old gists accumulate on the operator's account; same posture
  as the existing "Vibes projects not auto-deleted" note).

## Files touched

- `.claude/skills/qa-pr/SKILL.md` — frontmatter description, intro, Authorization,
  Step 6 note, Step 7 rewrite, failure modes.
- `.claude/skills/qa-pr/assets/triage-template.md` — Evidence column/slot, footer line.
