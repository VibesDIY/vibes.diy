# De-link before you tear down

Source: `claude/delink-chat-2876` — removing the product UI's links to `/chat`
ahead of the eventual route teardown (#2876, part of retiring `/chat` #2518).

Retiring a route has two very different halves, and doing the cheap reversible one
first de-risks the expensive irreversible one. **De-linking** (stop the UI from
pointing at `/chat`) is reversible, ships today, and makes `/vibe` the only path
you can *click* to. **Teardown** (301 + delete the route) is the irreversible part,
and it can wait. Splitting them means the scary PR lands against a UI that already
stopped depending on the old route.

The trap: "repoint 7 links" reads as find-and-replace, and 5 of them were. The
other 2 weren't, and only reading each call site caught it:

- A "Continue chat" button navigated to `/chat/:o/:s/app` — a trailing `app`
  segment the chat route tolerated as a view hint but `/vibe` would read as an
  **fsId** ("app") and fail to resolve. A blind `/chat → /vibe` swap would have
  shipped a broken link.
- The remix flow carried `?view=code` to deep-link the editor. `/vibe` doesn't
  consume the chat `view` param at all (its editor opens from the card), so the
  param is silently dropped and you land on the running app instead. Not broken,
  but a real behavior change hiding behind a "mechanical" repoint.

Worth a note:

- **Keep the old entry as a redirect, not a link.** The homepage now points at a
  `/vibe/prompt` alias of the same slug-minting component, while `/chat/prompt`
  stays registered as a working legacy redirect (cross-origin `createVibe()`
  hand-offs and cached clients still resolve). De-link the UI; don't delete the
  door.
- **A find-and-replace task with two exceptions is not a find-and-replace task.**
  The exceptions are the whole review. Read every call site even when the diff
  looks trivial — the one that isn't is the one that bites.
- **Distinct-by-design beats merged.** The matching analytics decision: keep
  `/chat` and `/vibe` as separate rows, no path normalizer — the migration
  (chat dropping, vibe rising) is the signal you want to watch, not a
  discontinuity to paper over.
