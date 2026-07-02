# Remixing a multi-file app used to hand the model one file and a lie

**Hook:** A user remixed a multi-file DJ-schedule app and the model announced: "Since the original relied on many external files I don't have, I'll ship a complete standalone version." It wasn't hallucinating — we really had only shown it `App.jsx`.

**Source:** PR fixing `fork-app.ts` remix seeding (multi-file remix prompt).

**The gotcha:** The fork path seeded the remix chat with just the source `/App.jsx`, while the `vibes-diy push` path seeded *all* files plus a PromptContexts row linking the chat to the filesystem. That row is what makes `loadVersionTimeline` work — without it the first remix turn had no PREVIOUS slot (the model literally couldn't see the other modules), *and* the SEARCH/REPLACE resolver seeded from an empty map, so every file the model didn't re-emit was silently dropped from the fork's next version. The model's "standalone rewrite" was the rational response to the context we gave it — and coincidentally the only behavior that didn't lose files.

**The trade-off/why:** The fix is parity, not prompt engineering: make fork seeding identical in shape to push seeding (all source files, entry point first, plus the timeline row). This flips the first remix turn from the "initial" three-pass template to the "continuation" SEARCH/REPLACE template — which is what an edit of an existing app should have been all along, and is the same well-trodden path as CLI push → web edit. One subtlety: the stored filesystem includes the server-generated `/~~calculated~~/import-map.json`; the seed must exclude it, since push seeds from client files and never carries derived artifacts.
