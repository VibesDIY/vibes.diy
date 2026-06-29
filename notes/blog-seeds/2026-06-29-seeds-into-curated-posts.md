# Turning a pile of build-log seeds into a curated set of posts

Source: `claude/blog-posts-from-seeds`

The blog-seed habit (one capture file per PR) had accumulated ~44 seeds. Rather
than mechanically expand each into a post — which would flood the index with
micro-topics — we curated: ~9 highlight posts, each built around one strong
primary seed with related/smaller seeds folded in as raw material (the
de-fireproof series, the Durable-Object collapse, the access-model arc, the
/vibe owner⇄viewer flow, cloud QA, leaner CI, and a "small fixes, real lessons"
roundup). The interesting trade-off is curation vs. coverage: grouping by theme
reads far better than one-post-per-seed, and "raw material, not headline" is the
move that lets a niche seed still contribute without demanding its own page.

Process gotcha worth a post of its own someday: drafting was fanned out one
subagent per post, each told to ground every claim strictly in its seed files
and flag anything it couldn't substantiate — the no-fabrication rule is what
makes LLM-drafted engineering posts trustworthy enough to publish.
