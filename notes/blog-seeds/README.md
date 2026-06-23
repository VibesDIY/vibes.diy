# Blog post seeds

Lightweight, one-line blog post ideas captured as work ships — **one file per seed**.

Every PR drops **one** seed here on its branch: a new markdown file drawn from the
code that PR touched (see
[`agents/pr-lifecycle.md` § Every PR: drop a blog post seed](../../agents/pr-lifecycle.md#every-pr-drop-a-blog-post-seed)).
Seeds are captures, not commitments: nobody has to write the post. The team
mines this directory periodically and promotes the good ones into full posts
under `notes/blog-<slug>.md`.

One file per seed means no shared list to edit and no merge conflicts between
PRs — you only ever add your own file, never touch anyone else's.

## How to add a seed

- Create a new file `notes/blog-seeds/<YYYY-MM-DD>-<slug>.md` (date keeps the
  directory roughly chronological; `<slug>` is a few words from the hook).
- Don't edit this README or anyone else's seed file — just add yours.
- Lead with a **concrete hook**, not a topic label: "How vibes-diy does
  browserless device auth with a Fireproof keybag" beats "a post about auth."
- Point at the source PR (its number, or the branch name if the PR isn't open
  yet) and name the trade-off / "why" / gotcha worth expanding on.

Each seed file is short — a hook plus a sentence or two:

```markdown
# <one-line hook>

Source: #<PR> (or `<branch>` if not open yet)

<The angle / why it's interesting — the trade-off, the "why", or the gotcha
worth expanding into a full post.>
```
