# The last @fireproof declaration: owning the dashboard type contract

Source: `jchris/dashboard-types-2935` (closes #2935, meets the #2933 north star)

This is the closing move of the de-fireproof arc: after the protocol-type pins
(#2970) and use-fireproof-to-zero (#2972), exactly one `@fireproof/*` line was
left in the whole workspace — `@fireproof/core-types-protocols-dashboard` in
`@vibes.diy/identity`, its sole real consumer. This PR vendors that type
contract in-repo and drops the line, taking `git grep '"@fireproof/'` across
every `package.json` to **nothing**.

The interesting angle is the **discipline of a strictly-mechanical vendor**. The
owner's hard bar: copy the real upstream `.ts` byte-for-byte — no hand-written
interfaces standing in for a `z.infer<typeof Schema>`, because a hand-translation
silently drifts the shape. So the six dashboard files (plus the minimal cloud +
base zod-schema closure the dashboard types transitively need) were pulled
straight from the `core@v0.24.19` git tag and diff-verified against it: the only
allowed deltas were repointed import specifiers (`zod/v4` → `zod` to match
identity's zod-v4 install; cross-package imports → owned modules). Every file was
proven identical modulo those exact lines before committing.

Two things worth a paragraph each in the post:

- **A one-line dependency drop evicted a 420-line transitive graph.** Removing
  the single dashboard dep cascaded out `core-types-base`, `-blockstore`,
  `-device-id`, `-protocols-cloud`, `-runtime`, and `vendor` from the lockfile —
  because nothing else declared them. Safe *only* because a workspace-wide grep
  first proved zero real `@fireproof` import statements remained. The lesson: the
  "last consumer" removal is where a whole dependency subtree quietly falls off,
  and the guardrail is a grep, not a hope.

- **`.catch()` doesn't change an inferred type.** The owned `ClerkEmailTemplateClaim`
  reuses identity's already-vendored (and deliberately patched-lenient) schema
  rather than re-copying upstream's strict one — because `z.string().catch("")`
  only changes runtime parse *fallbacks*, not the `z.infer` output type. So the
  derived type matches upstream exactly while the runtime leniency (real Clerk
  JWTs omit those fields) is preserved. A nice example of where "verbatim shape"
  and "keep the in-repo patch" don't actually conflict.

Gotcha for the reader: the whole-workspace `tsgo` build is the real parity proof
here — since identity is the sole consumer, a green type-check across the
workspace *is* the evidence that the vendored types are structurally what
compiled before.
