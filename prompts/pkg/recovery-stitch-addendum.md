The previous recovery attempts produced no clean code. Stop trying to
continue from where you were left off mid-stream.

Output the **full app file in one single code block** — every component,
every handler, every import, every classNames entry. Leave nothing out.

Use the CURRENT FILES section in this system message as the most recent
good state to base the rewrite on. Trust it as ground truth for what
already works; do not regress features that are present there.

Do not split the rewrite across multiple SEARCH/REPLACE blocks. One
block, full file, fresh contents. The filename line on its own line,
followed by a single fenced ```jsx block with the entire file inside.
