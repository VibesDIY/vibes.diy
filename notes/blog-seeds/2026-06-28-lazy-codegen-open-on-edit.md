# Lazy-open the codegen chat: don't connect until the owner actually edits

Source: #2761 (lazy-open the in-vibe codegen chat), branch `claude/fix-2761-8ujksq`.
Follows up the deferred item from #2677 PR-A (`2026-06-28-in-vibe-generation.md` §"Eager-open
is a real behavior change → filed, not rushed").

Goal: an owner *viewing* their vibe at `/vibe/$owner/$app` should no longer open a codegen chat
on mount. PR-A instantiated `useInVibeGeneration` with `enabled: isOwner`, and `useChatSession`
opens the chat in a mount effect — so every owner page-view eagerly established a (possibly
long-lived WebSocket) codegen connection before the owner typed anything. Open it lazily instead.

Decisions / findings worth a full post:

- **"Lazy, but not that lazy."** The issue first proposed opening on the first `sendPrompt`. The
  owner's clarification flipped the trigger earlier: open on *first open of the edit UI*, don't
  wait for submit. So the connection warms while the owner is composing, and the optimistic-prompt
  + de-blur timing on submit is unchanged — but a passive browse never connects.

- **An `active` latch beside the existing `enabled` gate.** `enabled` (= `isOwner`) hard-gates
  non-owners off; the new `active` state gates owners *temporally*. `inConstruction` becomes
  `enabled === false || !active`. `activate()` flips it on, the host calls it when the
  `UnifiedVibeCard` opens (`onOpenChange`), and `sendPrompt` also activates — covering the fork
  auto-fire path where the card never opens but a prompt fires programmatically.

- **The gotcha: the open effect's dep array didn't react to `inConstruction`.** `useChatSession`
  early-returns while `inConstruction` is true, but `inConstruction` wasn't in the effect's deps
  (a comment even bragged it was "preserved verbatim"). So flipping it false→true on first edit
  wouldn't re-run the open path unless something *else* in the deps changed. `sendPrompt` smuggles
  a `promptToSend` change in, so the submit path worked by accident — but activate-on-card-open had
  no such change. Adding `inConstruction` to the deps makes the lazy flip actually open the chat.
  Safe for `/chat`: there `inConstruction` is constant per mount, so it adds zero extra runs.

- **Re-arm on cross-vibe nav.** The route component is reused across client-side `/vibe→/vibe`
  navigation, so `active` is reset in the same slug-keyed effect that clears the reducer. Otherwise
  an active vibe would carry its open connection straight into the next vibe's passive view —
  re-introducing the eager-open the fix removes.

- **Env aside (cloud session):** the pinned Playwright (1.61 → browser build 1228) couldn't be
  downloaded behind the proxy, while the box had build 1194 pre-provisioned. Symlinking the 1194
  `headless_shell` into the 1228 registry path let the browser-mode vitest suite run locally
  unchanged. Worth a proper note if this recurs.
