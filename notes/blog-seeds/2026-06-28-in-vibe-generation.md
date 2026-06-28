# The agent moves into the vibe: lifting the codegen engine out of the chat route

Source: #2677 PR-A (in-place generation on `/vibe`), branch `claude/in-vibe-generation-pra`.
Plan: `docs/superpowers/plans/2026-06-28-pr-a-in-vibe-generation.md`. Built subagent-driven,
TDD per task, two-stage review (spec → quality) each.

Goal: when the owner uses the edit affordance on `/vibe`, generate the change **in place** —
stream in the card, hot-swap the running iframe, de-blur the forming app behind it — instead
of hopping to `/chat`. The owner's chips/Other now drive codegen on the same page.

Decisions / findings worth a full post:

- **The engine was already a hook; it just had a route stuck to it.** `useChatSession` owned
  the codegen chat lifecycle, but it was wired by hand to the chat route's `useReducer` +
  `promptToSend` state. Extracting `useInVibeGeneration` — a headless hook that owns its own
  `promptReducer`, composes `useChatSession`, runs the `isCodeEnd → getCode → pushSource`
  hot-swap loop, and derives `phase`/`blurPx`/`counts` — meant the `/vibe` route consumes one
  object (`{ phase, blocks, blurPx, counts, sendPrompt }`) and the chat route can later
  converge onto the same hook. The "extraction" is the feature.

- **One iframe surface, because the runtime never gated hot-swap.** The deployed `/vibe`
  runtime already registers the `set-source` listener and posts `runtime.ready`
  *unconditionally* (`?preview=yes` only skips SSR viewer identity). So the shared sandbox
  singleton's `pushSource` lands in the deployed iframe with no reload — the de-blur ramp and
  hot-swap that lived in `PreviewApp`'s separate preview iframe now run on the one real
  surface. The risky-looking bet (hot-swap a deployed app) was load-bearing code we'd already
  shipped.

- **The blur gate needed a third term the spec didn't have.** `blurPx` is gated to only show
  while generating. The obvious gate — `running || promptToSend !== null` — blinks to 0 for a
  render: `useChatSession` clears `promptToSend` *synchronously* in the same effect that sets
  the optimistic prompt, so there's a window where neither is truthy but generation is live.
  Adding `|| optimisticPrompt !== undefined` closes it. The reviewer verified the race against
  `useChatSession`'s firing effect before we kept the deviation — a good example of "deviation
  allowed, but prove it."

- **Instantiating a hook for everyone forces an `enabled` gate.** Hooks can't be conditional,
  so `useInVibeGeneration` runs for non-owners too — and `useChatSession` opens a codegen chat
  on mount, which a non-owner can't do on the owner's vibe. The fix is an `enabled` flag mapped
  to `inConstruction: enabled === false` (note `=== false`, not `!enabled`, so default-undefined
  stays enabled), passed `enabled: isOwner`. The route gates the *behavior*, the hook gates the
  *connection*.

- **Depend on the stable member, not the churning object.** `useInVibeGeneration` returns a
  fresh object literal each render, so `[..., generation]` in `handleEditPrompt`'s deps churned
  the callback every render. `sendPrompt` is the only member used and is `useCallback`-stable —
  depending on `generation.sendPrompt` instead is both correct and honest about the dependency.

- **Eager-open is a real behavior change → filed, not rushed.** An owner viewing `/vibe` now
  opens a codegen chat before typing. Acceptable for PR-A, but worth a deliberate lazy-open
  follow-up (#2761) rather than a hurried lifecycle change inside this PR. Knowing what to defer
  kept the slice clean.
