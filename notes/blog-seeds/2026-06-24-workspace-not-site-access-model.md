# "Workspace, not site": the access model that falls out of deleting `isOwner`

Source: `claude/access-model-design-doc` (design doc; follows #2553/#2556/#2584)

A bug where a vibe wouldn't let its own owner save unspooled into a whole access-model
philosophy. The throughline: `isOwner` is the vestigial organ of the site-with-an-admin
(WordPress) model, and vibes actually want the per-user-workspace + per-object-sharing (Drive/
Notion) model — where "owner" isn't global, it's a per-object-graph role, and the deployer is
just user #1. Two ideas worth a post: (1) **the Form-A trap** — an owner-only app is
invisible-broken to the only person who can see it work, which makes "owner-only" a *bug* not a
permission style; and (2) **examples bias, grammar enables** — the prompt-design principle that
you feature targets as recipes but describe primitives as grammar and *never enumerate limits*,
so the model reaches the clunky edge of the design space only when it truly needs to. Bonus
systems nugget: why an append-only CRDT can safely no-op a content-identical write (it's the
identity element of the merge), which de-risks every "ensure X exists" effect an LLM loves to
emit.
