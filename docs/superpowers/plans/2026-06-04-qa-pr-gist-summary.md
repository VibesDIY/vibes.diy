# qa-pr Gist-Backed Triage + Sticky PR Comment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `qa-pr` skill publish its full P0/P1/P2 triage (with inline-embedded evidence screenshots) to a public GitHub gist and reduce the PR comment to a concise verdict+counts+link that is edited in place across reruns.

**Architecture:** This is a **skill-prose change**, not application code. The skill is a markdown SOP (`SKILL.md`) plus a markdown triage template (`assets/triage-template.md`) that a Claude Code agent follows step by step. "Implementing" means editing those two files so the agent's Step 7 publishes a gist (two-pass, so screenshot raw URLs can be embedded), composes a short comment, and edits an existing marked comment instead of always posting a new one. There is no unit-test harness; verification is **structural** (grep the edited prose for required/forbidden strings) plus one **live `gh` smoke test** of the riskiest mechanic — deriving the gist owner/id and raw-URL from `gh gist create` output — run against a throwaway gist that is deleted immediately.

**Tech Stack:** Markdown (skill SOP + template), `gh` CLI (`gh gist create/edit/delete`, `gh pr comment`, `gh api`), GitHub gist raw URLs.

**Spec:** [docs/superpowers/specs/2026-06-04-qa-pr-gist-summary-design.md](../specs/2026-06-04-qa-pr-gist-summary-design.md)

**Branch:** `popmechanic/qa-pr-gist-summary` (already created off `origin-https/main`, which holds the merged skill — local `main` is stale). All tasks commit to this branch.

**Files touched (whole plan):**
- Modify: `.claude/skills/qa-pr/SKILL.md` — frontmatter description, intro line, Authorization, Step 2 run-log line, Step 6 note, Step 7 rewrite, Failure modes.
- Modify: `.claude/skills/qa-pr/assets/triage-template.md` — Evidence column on the P0/P1/P2 tables, footer line.

**Conventions used below:**
- `<N>` = PR number; `{run_id}` = `pr-{N}-{YYYYMMDD-HHmm}`.
- The dedup marker string, used verbatim everywhere, is exactly: `<!-- qa-pr-triage-comment -->`.

---

## Task 1: Frontmatter description + intro line

**Files:**
- Modify: `.claude/skills/qa-pr/SKILL.md` (frontmatter `description:`, line ~3; intro paragraph, line ~8)

- [ ] **Step 1: Update the frontmatter `description` tail**

In the `description:` value, find this exact sentence:

```
Writes a P0/P1/P2 triage with cross-cutting patterns and posts it as a PR comment.
```

Replace it with:

```
Writes a P0/P1/P2 triage with cross-cutting patterns, publishes it (with inline screenshots) as a public GitHub gist, and posts or updates a single concise summary comment on the PR.
```

- [ ] **Step 2: Update the intro paragraph**

Find this exact sentence in the intro paragraph (under `# /qa-pr — agent-driven QA pass against a PR preview URL`):

```
It captures friction the way a first-time user would, writes a [P0/P1/P2 triage](assets/triage-template.md), and posts it as a comment on the PR.
```

Replace it with:

```
It captures friction the way a first-time user would, writes a [P0/P1/P2 triage](assets/triage-template.md), publishes that triage as a public gist with evidence screenshots embedded inline, and posts a concise summary comment that links to the gist (editing its own prior comment in place on reruns).
```

- [ ] **Step 3: Verify the edits landed and the old phrasing is gone**

Run:
```bash
cd /Users/marcusestes/Websites/vibes.diy
grep -c "posts it as a PR comment\|posts it as a comment on the PR" .claude/skills/qa-pr/SKILL.md
grep -c "publishes it (with inline screenshots) as a public GitHub gist" .claude/skills/qa-pr/SKILL.md
grep -c "publishes that triage as a public gist" .claude/skills/qa-pr/SKILL.md
```
Expected: first line prints `0`; second and third lines each print `1`.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/qa-pr/SKILL.md
git commit -m "docs(qa-pr): describe gist + concise-comment output in frontmatter/intro"
```

---

## Task 2: Rewrite the Authorization section

**Files:**
- Modify: `.claude/skills/qa-pr/SKILL.md` (`## Authorization`, lines ~30-34)

- [ ] **Step 1: Replace the entire Authorization section body**

Find this exact block (the two paragraphs under `## Authorization`):

```
This skill is explicitly authorized to perform exactly **one** GitHub write operation: `gh pr comment <PR-number> --body-file <triage>` against the PR passed as the argument. No confirmation prompt is required for that single command.

The skill is **not** authorized to: open issues, edit PR titles or descriptions, request review, merge, push commits, comment on other PRs, or perform any other GitHub write. If any of those would help, surface the suggestion in the triage body — do not act on it.
```

Replace it with:

```
This skill is explicitly authorized to perform the following GitHub write operations against **the PR passed as the argument**, with no confirmation prompt required:

1. **Publish the triage gist** — `gh gist create --public …` to create the gist, and `gh gist edit …` to push the screenshot-rewritten triage back into that same gist. (One logical publish; see Step 7.)
2. **Post or update the summary comment** — either `gh pr comment <PR-number> --body-file <comment>` to create the comment, or `gh api repos/VibesDIY/vibes.diy/issues/comments/<id> -X PATCH -F body=@<comment>` to edit the skill's **own** prior marked comment on this PR in place. (One logical post; see Step 7's sticky-comment flow.)

The skill is **not** authorized to: open issues, edit PR titles or descriptions, request review, merge, push commits, comment on or edit comments on **other** PRs, edit comments it did not author, or perform any other GitHub write. The comment-edit operation may only ever target a comment that (a) is on the PR under test, (b) was authored by the current `gh` user, and (c) contains the marker `<!-- qa-pr-triage-comment -->`. If any other write would help, surface the suggestion in the triage body — do not act on it.
```

- [ ] **Step 2: Verify**

Run:
```bash
cd /Users/marcusestes/Websites/vibes.diy
grep -c "exactly \*\*one\*\* GitHub write operation" .claude/skills/qa-pr/SKILL.md
grep -c "Publish the triage gist" .claude/skills/qa-pr/SKILL.md
grep -c "Post or update the summary comment" .claude/skills/qa-pr/SKILL.md
```
Expected: first line prints `0` (old "exactly one" wording removed); second and third each print `1`.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/qa-pr/SKILL.md
git commit -m "docs(qa-pr): authorize gist publish + sticky comment edit"
```

---

## Task 3: Add Evidence column + footer note to the triage template

**Files:**
- Modify: `.claude/skills/qa-pr/assets/triage-template.md`

- [ ] **Step 1: Add an Evidence column to the P0 table**

Find:

```
## Critical (P0)

| # | Issue | Viewport | Why it matters |
|---|---|---|---|
{P0_ROWS}
```

Replace with:

```
## Critical (P0)

| # | Issue | Viewport | Evidence | Why it matters |
|---|---|---|---|---|
{P0_ROWS}
```

- [ ] **Step 2: Add an Evidence column to the P1 table**

Find:

```
## High-impact (P1)

| # | Issue | Viewport | Why it matters |
|---|---|---|---|
{P1_ROWS}
```

Replace with:

```
## High-impact (P1)

| # | Issue | Viewport | Evidence | Why it matters |
|---|---|---|---|---|
{P1_ROWS}
```

- [ ] **Step 3: Add an Evidence column to the P2 table**

Find:

```
## Polish (P2)

| # | Issue | Viewport |
|---|---|---|
{P2_ROWS}
```

Replace with:

```
## Polish (P2)

| # | Issue | Viewport | Evidence |
|---|---|---|---|
{P2_ROWS}
```

- [ ] **Step 4: Update the footer artifacts note**

Find:

```
*Raw run artifacts (screenshots, network logs, console messages) live in `qa-reports/{RUN_ID}/` on the developer's machine and are not attached to this comment.*
```

Replace with:

```
*Evidence screenshots referenced by findings are embedded inline in the Evidence column above, served from this gist. Other raw run artifacts (per-step screenshots, network logs, console messages) live in `qa-reports/{RUN_ID}/` on the developer's machine and are not attached.*
```

- [ ] **Step 5: Verify the three tables and footer**

Run:
```bash
cd /Users/marcusestes/Websites/vibes.diy
grep -c "| # | Issue | Viewport | Evidence | Why it matters |" .claude/skills/qa-pr/assets/triage-template.md
grep -c "| # | Issue | Viewport | Evidence |" .claude/skills/qa-pr/assets/triage-template.md
grep -c "embedded inline in the Evidence column above" .claude/skills/qa-pr/assets/triage-template.md
```
Expected: first line prints `2` (P0 + P1), second line prints `3` (matches P0, P1, and the P2 header as a substring), third line prints `1`.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/qa-pr/assets/triage-template.md
git commit -m "docs(qa-pr): add Evidence column for inline gist screenshots"
```

---

## Task 4: Note inline-embedding in the Step 6 output schema

**Files:**
- Modify: `.claude/skills/qa-pr/SKILL.md` (`## Step 6 — Output schema`, the `findings[].screenshots` comment in the `QAResult` type block)

- [ ] **Step 1: Annotate the `screenshots` field**

Find this exact line inside the `type QAResult` code block:

```
    screenshots: string[]   // file paths inside qa-reports/{run_id}/ (desktop shots end -desktop.png, mobile shots -mobile.png)
```

Replace with:

```
    screenshots: string[]   // file paths inside qa-reports/{run_id}/ (desktop shots end -desktop.png, mobile shots -mobile.png). These evidence shots are uploaded to the gist and embedded inline in the finding's Evidence cell at Step 7 (two-pass publish).
```

- [ ] **Step 2: Verify**

Run:
```bash
cd /Users/marcusestes/Websites/vibes.diy
grep -c "embedded inline in the finding's Evidence cell at Step 7" .claude/skills/qa-pr/SKILL.md
```
Expected: `1`.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/qa-pr/SKILL.md
git commit -m "docs(qa-pr): note evidence screenshots embed inline in gist (Step 6)"
```

---

## Task 5: Add `gist_url`/`comment_id` to the run-log record (Step 2)

**Files:**
- Modify: `.claude/skills/qa-pr/SKILL.md` (`## Step 2 — Run setup`, the `runs.jsonl` bullet)

- [ ] **Step 1: Clarify the Step 2 run-log bullet**

Find:

```
- Append a line to `qa-reports/runs.jsonl` (create if needed) of the form `{"run_id":"...","operator_email":"...","pr":N,"started_at":"..."}`.
```

Replace with:

```
- Append a line to `qa-reports/runs.jsonl` (create if needed) of the form `{"run_id":"...","operator_email":"...","pr":N,"started_at":"..."}`. Step 7 appends a second completion record for this `run_id` carrying `gist_url` and `comment_id`, so run history (including every gist URL) is preserved even though the sticky PR comment shows only the latest run.
```

- [ ] **Step 2: Verify**

Run:
```bash
cd /Users/marcusestes/Websites/vibes.diy
grep -c "Step 7 appends a second completion record for this \`run_id\`" .claude/skills/qa-pr/SKILL.md
```
Expected: `1`.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/qa-pr/SKILL.md
git commit -m "docs(qa-pr): record gist_url + comment_id in runs.jsonl (Step 2)"
```

---

## Task 6: Rewrite Step 7 — gist publish, concise comment, sticky dedup

This is the core task. It replaces the body of `## Step 7 — Render and post` (everything from the line `When both phases are complete` down to — but **not** including — the next heading `## Failure modes`).

**Files:**
- Modify: `.claude/skills/qa-pr/SKILL.md` (`## Step 7 — Render and post`)

- [ ] **Step 1: Replace the Step 7 body**

Find this exact block:

```
When both phases are complete (or aborted under a documented failure mode):

1. Finalize all placeholders in `qa-reports/{run_id}/triage.md`. Verify by running `grep -oE '\{[A-Z0-9_]+\}' qa-reports/{run_id}/triage.md` — the output must be empty.
2. Post the comment:

```bash
gh pr comment <PR-NUMBER> --body-file qa-reports/{run_id}/triage.md
```

This is the single authorized GitHub write operation for the skill. Run it directly, without a confirmation prompt — the authorization is documented in this skill's *Authorization* section above.

3. Print the comment URL (`gh` prints it on success) and a one-line summary of the verdict to the session.
4. **Sign out of Vibes** to leave the chrome-devtools profile in a "Google signed in, Vibes signed out" state for the next run. Navigate to the account / settings area in the Vibes UI and click Sign out — or if a `/sign-out` route exists, navigate to it directly. Verify via `evaluate_script` that the `__session` cookie is gone (or set to expired). Skipping this leaves Vibes session state in the profile and the next run's preflight will abort on a dirty profile.
```

Replace it with:

````
When both phases are complete (or aborted under a documented failure mode), publish the full triage to a public gist, post a concise summary comment that links to it, then sign out. The full triage never goes in the PR comment — long comments pollute a reviewer's working context; the gist holds the detail and the comment is a scannable pointer.

**7.1 — Finalize the triage.** Fill every placeholder in `qa-reports/{run_id}/triage.md`, including each finding's **Evidence** cell. For a finding that has no screenshot, put a literal `—` in its Evidence cell. For a finding **with** screenshot(s), leave a placeholder token `{{EVIDENCE:<basename>.png}}` in the Evidence cell for each shot (e.g. `{{EVIDENCE:remix-live-mobile.png}}`) — Step 7.3 rewrites these into inline image tags once the gist exists. Then verify no schema placeholders remain:

```bash
grep -oE '\{[A-Z0-9_]+\}' qa-reports/{run_id}/triage.md
```

The output must be empty. (The `{{EVIDENCE:…}}` tokens use doubled braces and lowercase, so they do **not** match this single-brace uppercase pattern — that's intentional; they are resolved in 7.3.)

**7.2 — Publish the gist (pass 1: create, text-only).** Collect the **evidence set**: the de-duplicated list of every basename appearing in any finding's `screenshots` (i.e. every file named in a `{{EVIDENCE:…}}` token). These are the only screenshots that go to the gist; per-step working captures stay local. Create the gist with **only the triage markdown** — `gh gist create` refuses binary files, so the PNGs are added later by git push in 7.3:

```bash
gh gist create --public \
  --desc "qa-pr triage — PR #<N> — <verdict> (<run_id>)" \
  qa-reports/{run_id}/triage.md
```

`gh gist create` prints the gist's web URL on its last line, of the form `https://gist.github.com/<owner>/<gist_id>`. Capture it. Derive:
- `<gist_url>` = that full web URL (goes in the comment).
- `<owner>` = the second-to-last path segment.
- `<gist_id>` = the last path segment.
- `<raw_base>` = `https://gist.githubusercontent.com/<owner>/<gist_id>/raw/` (no commit SHA, so it always serves the latest revision).

If the evidence set is **empty**, this text-only gist is the whole publish — skip 7.3 entirely, there is nothing to embed.

**If `gh gist create` fails** (non-zero exit, or no `gist.github.com` URL in output): take the **gist-failure fallback** — do not lose the report. Prepend a marker + warning line to a fresh copy of the full triage and post it inline exactly as the old skill did:

```bash
{ printf '<!-- qa-pr-triage-comment -->\n> ⚠️ Gist upload failed; full triage inline below.\n\n'; cat qa-reports/{run_id}/triage.md; } > qa-reports/{run_id}/comment.md
```

Then jump straight to **7.5** (sticky post) with this `comment.md`, and skip 7.3–7.4. (`comment.md` carries the marker, so dedup still works.)

**7.3 — Embed evidence + git-push the images (pass 2).** `gh gist create` cannot carry binaries, but a gist is a git repo that accepts them — so the PNGs and the URL-rewritten triage go in together via one git push. First, for every `{{EVIDENCE:<basename>.png}}` token in `qa-reports/{run_id}/triage.md`, replace it with a sized, click-through thumbnail pointing at the raw gist URL:

```html
<a href="<raw_base><basename>.png"><img src="<raw_base><basename>.png" width="240"></a>
```

(If a finding has multiple shots, emit one `<a><img></a>` per token, space-separated, in the same Evidence cell.) Then clone the gist's git repo, drop in the evidence PNGs and the rewritten triage, and push:

```bash
gist_dir="$(mktemp -d)/gist"
gh gist clone <gist_id> "$gist_dir"
cp qa-reports/{run_id}/<evidence-1>.png qa-reports/{run_id}/<evidence-2>.png … "$gist_dir"/
cp qa-reports/{run_id}/triage.md "$gist_dir"/triage.md
git -C "$gist_dir" add -A
git -C "$gist_dir" commit -m "qa-pr: add evidence screenshots for <run_id>"
git -C "$gist_dir" push
```

One commit carries both the evidence images and the rewritten markdown; the raw URLs then serve the images (`image/png`, HTTP 200 — verified) and the gist's `triage.md` renders them inline.

**If the clone/commit/push fails** here: do **not** fall back to an inline comment — the gist already exists from 7.2 with the triage text (the `{{EVIDENCE:…}}` tokens remain as literal placeholders, no images). Log a one-line warning to the session ("gist push failed; evidence not embedded") and continue to 7.4 with the `<gist_url>` from 7.2.

**7.4 — Compose the concise comment.** Write `qa-reports/{run_id}/comment.md` with the hidden marker on the first line, derived entirely from fields already in the triage:

```markdown
<!-- qa-pr-triage-comment -->
## QA: <PR title> — <verdict>

<one-sentence narrative: how the PR's change held up across desktop + mobile>

**<x> P0 · <y> P1 · <z> P2** across desktop + mobile · [Full triage ↗](<gist_url>)
```

- `<PR title>` comes from `gh pr view <N> --json title --jq .title`.
- `<verdict>` is the triage's `pr_verdict` (`pass` / `fail` / `pass-with-caveats`).
- `<x>/<y>/<z>` are the counts of P0/P1/P2 findings.
- If Phase B was skipped, write `desktop only` instead of `across desktop + mobile` in both lines.

**7.5 — Post or update the comment (sticky).** Find a prior comment by the skill on this PR — same marker, authored by the current `gh` user — and edit it in place; otherwise create a new one.

```bash
me="$(gh api user --jq .login)"
prior="$(gh api repos/VibesDIY/vibes.diy/issues/<N>/comments --paginate \
  --jq ".[] | select(.user.login == \"$me\") | select(.body | contains(\"<!-- qa-pr-triage-comment -->\")) | .id" \
  | tail -n1)"
if [ -n "$prior" ]; then
  gh api repos/VibesDIY/vibes.diy/issues/comments/"$prior" -X PATCH -F body=@qa-reports/{run_id}/comment.md
else
  gh pr comment <N> --body-file qa-reports/{run_id}/comment.md
fi
```

Both branches are authorized writes (see *Authorization*); run without a confirmation prompt. The edit branch only ever targets the skill's own marked comment on this PR.

**7.6 — Record + report.** Append a completion record to the run log and print the URLs:

```bash
printf '{"run_id":"%s","gist_url":"%s","comment_id":"%s","finished_at":"%s"}\n' \
  "<run_id>" "<gist_url>" "<comment_id_or_empty>" "<UTC ISO8601>" >> qa-reports/runs.jsonl
```

(`<comment_id>` is `$prior` when editing, or parsed from the `gh pr comment` output URL when creating; empty string in the gist-failure fallback if no gist exists.) Print the comment URL, the `<gist_url>`, and a one-line verdict summary to the session.

**7.7 — Sign out of Vibes** to leave the chrome-devtools profile in a "Google signed in, Vibes signed out" state for the next run. Navigate to the account / settings area in the Vibes UI and click Sign out — or if a `/sign-out` route exists, navigate to it directly. Verify via `evaluate_script` that the `__session` cookie is gone (or set to expired). Skipping this leaves Vibes session state in the profile and the next run's preflight will abort on a dirty profile.
````

- [ ] **Step 1b: Correct the Authorization gist wording (committed in Task 2)**

Task 2 described the gist publish as `gh gist edit`, but the transport is actually `gh gist clone` + `git push` (binaries can't go through `gh gist create`/`gh gist edit`). In `.claude/skills/qa-pr/SKILL.md`, find:

```
1. **Publish the triage gist** — `gh gist create --public …` to create the gist, and `gh gist edit …` to push the screenshot-rewritten triage back into that same gist. (One logical publish; see Step 7.)
```

Replace with:

```
1. **Publish the triage gist** — `gh gist create --public …` to create the gist (text-only; `gh gist create` refuses binaries), then `gh gist clone …` + a `git commit`/`git push` into that gist's own repo to add the evidence PNGs and the screenshot-rewritten triage. (One logical publish; see Step 7.)
```

Also find the forbidden-list sentence:

```
The skill is **not** authorized to: open issues, edit PR titles or descriptions, request review, merge, push commits, comment on or edit comments on **other** PRs, edit comments it did not author, or perform any other GitHub write.
```

Replace with:

```
The skill is **not** authorized to: open issues, edit PR titles or descriptions, request review, merge, push commits to the project repo or any non-gist remote, comment on or edit comments on **other** PRs, edit comments it did not author, or perform any other GitHub write. (The `git push` in operation 1 targets only the operator's own triage gist, not the project repo.)
```

- [ ] **Step 2: Verify the new Step 7 structure (structural grep)**

Run:
```bash
cd /Users/marcusestes/Websites/vibes.diy
# old single-write language is gone:
grep -c "single authorized GitHub write operation for the skill" .claude/skills/qa-pr/SKILL.md
# new sub-steps present:
for s in "7.1 — Finalize the triage" "7.2 — Publish the gist (pass 1: create" \
         "7.3 — Embed evidence" "7.4 — Compose the concise comment" \
         "7.5 — Post or update the comment (sticky)" "7.6 — Record" "7.7 — Sign out of Vibes"; do
  printf '%s => ' "$s"; grep -c "$s" .claude/skills/qa-pr/SKILL.md
done
# key commands present exactly once:
grep -c "gh gist create --public" .claude/skills/qa-pr/SKILL.md
grep -c "gh gist clone <gist_id>" .claude/skills/qa-pr/SKILL.md
grep -c 'git -C "\$gist_dir" push' .claude/skills/qa-pr/SKILL.md
grep -c "gist.githubusercontent.com/<owner>/<gist_id>/raw/" .claude/skills/qa-pr/SKILL.md
grep -c "issues/comments/" .claude/skills/qa-pr/SKILL.md
```
Expected: the first `grep -c` prints `0`; each of the seven sub-step lines prints `=> 1`; `gh gist create --public` prints `1`; `gh gist clone <gist_id>` prints `1`; the `git … push` line prints `1`; the raw-base line prints `1` (the `<raw_base>` definition — the `<a><img>` template references `<raw_base>` by name, not the literal host); `issues/comments/` prints ≥`2` (Authorization mention + Step 7 PATCH).

- [ ] **Step 3: Live smoke-test the gist owner/id/raw-URL derivation**

This validates the riskiest mechanic the prose instructs — that a PNG **git-pushed into a gist** serves a working image from its `<raw_base><basename>` URL — without touching any PR. It creates a throwaway text-only gist (7.2), git-pushes a tiny PNG into it (7.3), confirms the raw URL serves `image/png` at HTTP 200, then deletes the gist. (`gh gist create` cannot accept the PNG directly — that is exactly why 7.3 uses git push.)

Run:
```bash
cd /Users/marcusestes/Websites/vibes.diy
tmp="$(mktemp -d)"
printf '# smoke\n' > "$tmp/triage.md"
# 1x1 PNG:
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' | base64 --decode > "$tmp/shot.png"
# 7.2 — text-only create:
url="$(gh gist create --public --desc "qa-pr smoke (delete me)" "$tmp/triage.md" | tail -n1)"
echo "gist url: $url"
owner="$(echo "$url" | awk -F/ '{print $(NF-1)}')"
gid="$(echo "$url" | awk -F/ '{print $NF}')"
# 7.3 — git-push the PNG into the gist repo:
gh gist clone "$gid" "$tmp/gist"
cp "$tmp/shot.png" "$tmp/gist"/
git -C "$tmp/gist" add -A
git -C "$tmp/gist" commit -q -m "smoke: add evidence png"
git -C "$tmp/gist" push -q
raw="https://gist.githubusercontent.com/$owner/$gid/raw/shot.png"
echo "raw url:  $raw"
sleep 2
echo "raw http status: $(curl -s -o /dev/null -w '%{http_code}' -L "$raw")  content-type: $(curl -s -o /dev/null -w '%{content_type}' -L "$raw")"
gh gist delete "$gid" --yes 2>/dev/null || gh gist delete "$gid"
rm -rf "$tmp"
```
Expected: `gist url:` is a `https://gist.github.com/<owner>/<id>` line; `raw http status: 200` and `content-type: image/png`; the gist is deleted at the end (no error). If the raw status is not `200` or the content-type is not `image/png`, the transport mechanic is wrong — STOP and report before committing. (If `gh gist delete` errors because deletion needs the `gist` scope, run `gh auth refresh -s gist` once, then delete the leftover gist manually from <https://gist.github.com>.)

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/qa-pr/SKILL.md
git commit -m "docs(qa-pr): gist-backed triage + concise sticky comment (Step 7)"
```

---

## Task 7: Update the Failure modes section

**Files:**
- Modify: `.claude/skills/qa-pr/SKILL.md` (`## Failure modes`)

- [ ] **Step 1: Point the partial-triage branches at Step 7 and add the two gist failure surfaces**

The partial-triage failure branches currently say "post it" / "post the partial triage" with the old single-comment assumption. Add a lead-in sentence at the top of the `## Failure modes` section and two new bullets for the gist surfaces.

Find the section header and its first bullet:

```
## Failure modes

- **Preview URL never ready.** Polled `gh pr view` for 10 minutes without finding a `vibes.diy` URL in `statusCheckRollup`. Abort. Do not post anything. Tell the operator the deploy workflow may have failed; point them at `gh run list --branch <ref>`.
```

Replace with:

```
## Failure modes

Every branch below that says "post" routes through **Step 7** — i.e. publish the (possibly partial) triage to a gist and post/update the concise sticky comment, with the gist-failure fallback below as the safety net. A partial triage is still a triage.

- **Preview URL never ready.** Polled `gh pr view` for 10 minutes without finding a `vibes.diy` URL in `statusCheckRollup`. Abort. Do not post anything. Tell the operator the deploy workflow may have failed; point them at `gh run list --branch <ref>`.
- **Gist creation fails (Step 7.2 pass 1).** `gh gist create` exits non-zero or prints no gist URL. Do not lose the report: take the gist-failure fallback in Step 7.2 — post the full triage inline as the comment (carrying the `<!-- qa-pr-triage-comment -->` marker so the sticky-edit dedup still applies), prefixed with a one-line "Gist upload failed" warning. This is the only path that still puts the full triage in the PR thread; it is a degradation, not the norm.
- **Git push of evidence fails (Step 7.3 pass 2).** The gist already exists from pass 1 with the triage text (the `{{EVIDENCE:…}}` tokens remain as literal placeholders, no images). Do **not** fall back to an inline comment. Continue with the `<gist_url>` from pass 1; the evidence is simply not embedded. Note the degradation in one line to the session.
```

> **Note (transport correction):** `gh gist create` refuses binary files, so evidence PNGs are git-pushed into the gist repo in Step 7.3 (`gh gist clone` + `git push`), not attached via `gh gist edit`. The Authorization section committed in Task 2 still references `gh gist edit`; Task 6 / Step 1b below corrects it.

- [ ] **Step 2: Verify**

Run:
```bash
cd /Users/marcusestes/Websites/vibes.diy
grep -c "Every branch below that says \"post\" routes through \*\*Step 7\*\*" .claude/skills/qa-pr/SKILL.md
grep -c "Gist creation fails (Step 7.2 pass 1)" .claude/skills/qa-pr/SKILL.md
grep -c "Git push of evidence fails (Step 7.3 pass 2)" .claude/skills/qa-pr/SKILL.md
```
Expected: each prints `1`.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/qa-pr/SKILL.md
git commit -m "docs(qa-pr): route failure modes through Step 7 + gist failure surfaces"
```

---

## Task 8: Whole-skill consistency sweep

**Files:**
- Read-only verification across `.claude/skills/qa-pr/SKILL.md` and `.claude/skills/qa-pr/assets/triage-template.md`

- [ ] **Step 1: Confirm no stale single-comment / single-write language survives anywhere**

Run:
```bash
cd /Users/marcusestes/Websites/vibes.diy
grep -rn "exactly \*\*one\*\* GitHub write\|single authorized GitHub write\|posts it as a PR comment\|posts it as a comment on the PR" .claude/skills/qa-pr/
```
Expected: **no output** (exit status may be 1; that's fine). Any hit is a leftover — fix it before finishing.

- [ ] **Step 2: Confirm the dedup marker string is identical at every use site**

Run:
```bash
cd /Users/marcusestes/Websites/vibes.diy
grep -rho "<!-- qa-pr-triage-comment -->" .claude/skills/qa-pr/ | sort -u
```
Expected: exactly one unique line — `<!-- qa-pr-triage-comment -->`. More than one distinct string means a typo'd marker (Authorization, Step 7.2 fallback, Step 7.4, Step 7.5, and Failure modes must all match byte-for-byte, or sticky edit silently breaks).

- [ ] **Step 3: Confirm the marker appears at all five expected sites**

Run:
```bash
cd /Users/marcusestes/Websites/vibes.diy
grep -c "qa-pr-triage-comment" .claude/skills/qa-pr/SKILL.md
```
Expected: ≥`5` (Authorization, Step 7.2 fallback printf, Step 7.4 comment template, Step 7.5 find-prior jq, Failure modes). If lower, a use site is missing the marker.

- [ ] **Step 4: Final review of the rendered Step 7 with fresh eyes**

Read `.claude/skills/qa-pr/SKILL.md` from `## Step 7` to `## Cleanup notes`. Confirm: the seven sub-steps read in order; the gist-failure fallback jumps to 7.5; pass-2 failure continues rather than falling back; the concise comment template has the marker on line 1; the sticky `if/else` edits-or-creates. Fix any prose seam inline (no separate commit needed if Step 4 finds nothing).

- [ ] **Step 5: Commit any sweep fixes (only if Steps 1–4 changed anything)**

```bash
git add .claude/skills/qa-pr/
git commit -m "docs(qa-pr): consistency sweep for gist + sticky-comment flow"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Concise comment (title + verdict + counts + link) → Task 6 / Step 7.4. ✓
- Public gist → Task 6 / Step 7.2 (`--public`). ✓
- Gist-create failure → full inline fallback → Task 6 / Step 7.2 fallback + Task 7. ✓
- Inline evidence screenshots, two-pass → Task 3 (template column) + Task 4 (schema note) + Task 6 / Steps 7.1–7.3. ✓
- Evidence scope = finding-referenced only → Task 6 / Step 7.2 ("evidence set"). ✓
- Pass-2 failure → images as panes, no inline-comment fallback → Task 6 / Step 7.3 + Task 7. ✓
- Sticky edit-in-place via marker → Task 6 / Step 7.5 + Task 2 (authorization) + Task 8 (marker consistency). ✓
- Authorization rewrite (three write ops, forbid editing others' comments) → Task 2. ✓
- Frontmatter/intro description update → Task 1. ✓
- `runs.jsonl` gains `gist_url`/`comment_id` → Task 5 (Step 2 note) + Task 6 / Step 7.6. ✓
- Failure modes route through Step 7 → Task 7. ✓

**Placeholder scan:** No `TBD`/`TODO`/"handle edge cases" — every step has exact find/replace text or a runnable command. The `{{EVIDENCE:…}}` and `<…>` tokens are deliberate template placeholders the skill resolves at runtime, defined where introduced.

**Type/string consistency:** The marker `<!-- qa-pr-triage-comment -->` is byte-identical across Tasks 2, 6, 7 and asserted by Task 8/Step 2. The repo path `VibesDIY/vibes.diy` matches the existing skill. `<gist_id>`/`<owner>`/`<raw_base>` are defined once in Step 7.2 and reused in 7.3.
