# Spec-first as a PR: getting focused review on a design that keeps moving

Source: `claude/curated-cached-starter-vibe-9ro0vn` (#2801 follow-up)

The cached-suggestion read lane's data model got reshaped four times in review
(system-fork → non-owner-gated → identity-free → staged-version-under-source →
AppSettings-map). Each reshape was cheap because it landed in a spec doc and pure
primitives, not in a big code PR. So for the *enablement* step — which touches the
central access-grant decision (serving an unpublished version to anonymous
viewers) — we wrote the implementation plan as its own reviewable PR and asked for
focused design feedback *before* writing the code, then layer the implementation
onto the same PR once the approach is blessed.

The lesson worth a post: when a design is still moving and the next step touches
something security-sensitive, a "plan-only PR" is a real artifact, not bureaucracy
— it's the cheapest place to be wrong. The reviewer critiques the approach (where
the index lives, how an unpublished version becomes anonymously readable) on one
screen of prose instead of across a thousand-line diff, and the expensive code is
written once, against an approved shape.
