# How we turned "pitch a blog post after each PR" into an always-on seed list

Source: `claude/pr-blog-post-seeds`

We replaced a per-PR "pitch one blog topic and wait for a human yes" gate with a
zero-friction capture: every PR drops a one-file seed into `notes/blog-seeds/`,
and promotion into a full post stays a separate, deliberate human decision. The
interesting angle is the design trade-off — an approval gate in front of every
idea means most ideas evaporate, whereas a cheap always-on capture preserves
them while the context is fresh. The follow-on refinement (one file per seed
instead of a shared list) is a small but real lesson in designing
contributor-facing conventions to avoid merge-conflict churn.
