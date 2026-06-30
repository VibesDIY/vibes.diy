# When "copy the working package" quietly becomes tech debt — factoring a shared CLI harness

Source: #2926 (`claude/cmd-harness-dedup-2926`)

Standing up `@vibes.diy/deploy-cli` (#2905) by mirroring `@vibes.diy/build-cli`'s
cmd-ts harness was the right call to keep that PR mechanical — but it left two
packages carrying byte-identical copies of the streaming plumbing, and the copies
had *already* drifted (`build-cli`'s `run.js` spawned `tsx` by name; `deploy-cli`'s
used the more robust `node --import tsx`). Each new `run.js` also needed a
hand-added entry in the eslint ignore list.

The fix: a private `@vibes.diy/cmd-harness` that owns the run loop / evento bus /
cli-ctx and re-exports the wire protocol that already lived in
`@vibes.diy/cmd-tools`, so command packages have one import. The angle worth a
post: the *seam* between "mechanical copy to keep a PR small" and "now de-dup it"
— filing the cleanup as an issue the moment you notice it, and the gotchas of
sharing a `run.js` bin bootstrap (kept self-contained, not a cross-package import,
because the deploy runs it under bare `node` with no `node_modules/.bin` on PATH)
and a TransformStream-backpressure test deadlock (the enqueued write only resolves
once a reader pulls).
