# Git archaeology as a writing method: the agent-docs history post was researched entirely from `git log`

Source: `claude/agents-docs-evolution-post-62dgbf`

The post about our agent docs' evolution was written by unshallowing the clone
(cloud sessions start with `--depth`-limited history — `git rev-list --count`
said 50 commits until `git fetch --unshallow` revealed 5,589) and then reading
the story out of `git log --reverse -- CLAUDE.md` and `--diff-filter=A -- agents/*.md`:
first-added dates, line counts at milestone commits, and commit subjects as
era markers. Worth a meta-post: repo history as a primary source — what you
can reconstruct from diffs alone, and the shallow-clone gotcha that hides it.
