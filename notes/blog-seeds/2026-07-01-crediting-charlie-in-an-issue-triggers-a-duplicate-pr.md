# The `@`-mention that quietly forked our backlog

Source: branch `claude/charlie-creates-duplicate-prs-fvzyyd` — `agents/pr-lifecycle.md`
(new section) + `CLAUDE.md` (Writing-issues pointer). Docs-only, prompted by a real
run of duplicate PRs from `charliecreates[bot]`.

The report was "Charlie keeps opening PRs for work we're already doing." The first
theory was a blanket autonomous scan configured in Charlie's external dashboard — the
in-repo daemons (`pr-review-triage`, `pr-mergeability`, `pr-metadata`) are all
PR-scoped and explicitly forbid opening PRs, so it *looked* like the trigger had to
live somewhere we couldn't see.

The trade-off / gotcha worth a post:

- **The trigger was in our own issue bodies the whole time.** Cross-referencing seven of
  Charlie's PRs against their source issues split cleanly: five were triggered by a live
  `@CharlieHelps` mention in the issue **body** (none of them assigned to him), two by an
  actual **assignment** to `CharlieHelps` (no body mention). The `charliecreates` bot
  reads either as "go implement this" and opens a `Fixes #N` PR ~20–30 min later.

- **The mentions were credit, not tasks — and the bot can't tell the difference.** The
  five body-mention issues said things like *"per @CharlieHelps' review of #2903"*,
  *"cc @CharlieHelps — flagged during…"*, *"confirmed by @CharlieHelps."* We were
  attributing a follow-up idea to his earlier PR review, not asking him to build it. A
  token is a token to the bot. Worse, it's self-feeding: Charlie reviews a PR → we file
  an `agent-created` follow-up that credits *"@CharlieHelps' review"* → the credit
  re-triggers Charlie.

- **Same handle, two products, one surprising overlap.** `@CharlieHelps` (the reviewer we
  @-mention on PRs on purpose) and `charliecreates[bot]` (the implementer) share a name,
  so the mechanic that's *correct* on a PR comment — @-mention to request review — is the
  thing that causes duplicate work on an issue. The fix is a scope split, not a ban: keep
  @-mentioning him on PRs; on issues, drop the `@` when crediting (plain-text "Charlie"),
  and treat assignment as the one deliberate hand-off. General lesson: when an automation
  keys off a bare `@mention`, "mentioned you" and "delegated to you" collapse into the
  same signal — the disambiguation has to come from *where* you write it, so the docs
  have to teach the channel, not just the etiquette.
