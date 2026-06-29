---
title: "One iframe surface: the design that deletes the preview pane"
date: 2026-06-28T08:00:00Z
author: "Vibes DIY"
summary: "We moved first-generation onto the deployed app itself — stream into the card, hot-swap the running iframe, de-blur the app forming behind it — and in doing so deleted the separate preview pane entirely. The risk was the simplification."
glyph: "one iframe surface"
---

For a while, building a Vibe meant two surfaces. You'd prompt over on `/chat`, watch a *preview* app assemble in one iframe, and only later land on `/vibe` — a second iframe running the *real*, deployed app. Two iframes, two routes, one app. The preview pane existed because nobody wanted to risk generating code directly into a live deployment.

This is the story of deciding to take that risk, and discovering it paid for itself in deletions.

## The bet: hot-swap the real thing

The open question for in-place first-generation was which iframe forms behind the streaming card. Two options. Swap in `/chat`'s `PreviewApp` preview iframe for the duration — safe, familiar, but it keeps the second surface alive. Or hot-swap the deployed `/vibe` iframe directly — risky, because that iframe runs a *real* app, not a preview shell.

jchris took the risky one, with a rule attached: it's okay to do something risky if it's on the direct line toward core product value. Then he named the prize. If generation can drive the deployed iframe, the preview iframe stops earning its keep. **Retire it. One iframe surface.** The risk *is* the simplification — you don't get the deletion without taking the bet.

## Reading the runtime turned a guess into a fact

The "risky" path looked risky right up until we read the code that would carry it. The deployed runtime's `registerDependencies` registers the hot-swap `set-source` listener and posts `runtime.ready` **unconditionally**. And `?preview=yes` — the flag we assumed gated preview behavior — only skips SSR viewer identity. It never gated hot-swap at all.

So the deployed `/vibe` iframe *already* accepts `pushSource`. The scary part of the plan was load-bearing code we'd shipped long ago; we simply weren't calling it from `/vibe`. The seam that made the bet safe was sitting there the whole time. Reading the runtime before sketching is what turned the guess into a fact.

## The engine was already a hook — it just had a route stuck to it

Same shape of finding, one layer up. The codegen lifecycle lived in `useChatSession`, but it had been wired by hand to the chat route's `useReducer` and `promptToSend` state. The engine wasn't *coupled* to the chat route on purpose; it was just glued there.

So we lifted it out. `useInVibeGeneration` is a headless hook that owns its own `promptReducer`, composes `useChatSession`, runs the `isCodeEnd → getCode → pushSource` hot-swap loop, and derives `phase`, `blurPx`, and `counts`. The `/vibe` route now consumes one object:

```js
{ phase, blocks, blurPx, counts, sendPrompt }
```

The agent, in other words, **moves into the vibe.** When the owner uses the edit affordance on `/vibe`, the change generates in place — stream into the card, hot-swap the running iframe, de-blur the app forming behind it — no hop to `/chat`. And because the engine is now a route-free hook, the chat route can later converge onto the very same one. The extraction is the feature.

## The corners that don't show up in a clean diagram

Lifting an engine out of its route surfaces edges the spec didn't have.

The de-blur gate is one. `blurPx` should only show while generating, and the obvious gate — `running || promptToSend !== null` — blinks to zero for a render, because `useChatSession` clears `promptToSend` synchronously in the same effect that sets the optimistic prompt. Adding `|| optimisticPrompt !== undefined` closes the window. Deviation from the spec was allowed — but only after the reviewer verified the race against the firing effect.

Another: hooks can't be conditional, so `useInVibeGeneration` runs for non-owners too, and `useChatSession` opens a codegen chat on mount — something a non-owner can't do on someone else's vibe. The fix is an `enabled` flag mapped to `inConstruction: enabled === false` (note `=== false`, not `!enabled`, so default-undefined stays enabled). The route gates the *behavior*; the hook gates the *connection*. We also filed the eager-open lifecycle change as a deliberate follow-up rather than rushing it into this slice.

## "Delete the chrome" turned into "delete one component"

The epic earmarked a pile of legacy copy-verb chrome for deletion — a four-button action bar, an EDIT/CLONE/REMIX submenu. A full consumer sweep found most of it had been *planned but never built*. The `ExpandedVibesPill`'s sub-buttons were never even wired by the vibe route. So "clear the deck" collapsed to deleting one now-dead component (`ExpandedVibesPill`, since replaced by `UnifiedVibeCard`). Investigate before you delete; the best diff is sometimes the one that doesn't happen.

## Where the transcript actually lives

One more clarity win, on the CLI side. `vibes-diy chats` was split-brain: LIST read `ApplicationChats` (the in-app runtime chats) while the deep-read read `ChatContexts`/`ChatSections` (the codegen build transcript) — two unrelated systems behind one command. On a real vibe with a full codegen history but zero `ApplicationChats` rows, LIST printed "(no chats found)" while the deep-read happily rebuilt the whole transcript.

We split it into two purpose-named commands, `codegen-log` and `app-chats`, one table-family each — correctness by construction. The subtlety: the `ApplicationChats` row is only the *ownership anchor*. The actual transcript lives in `ChatSections`, keyed by the same `chatId`. Gate on the anchor, read from the sections.

## Fewer surfaces, fewer lies

The through-line across all of it: every "risky" or "big delete" move shrank once we read the real code. One iframe instead of two. One route-free engine instead of an engine fused to a route. One component deleted instead of a whole bar of buttons. One transcript source named honestly. The simplest system is the one where the agent generates straight into the thing you're going to ship.

<div class="post-cta">
  <h3>Watch it build itself.</h3>
  <p>Prompt an app and see it form on one surface — the same iframe that goes live is the one taking shape in front of you.</p>
  <a href="https://links.vibes.diy/homepage" class="btn">Start building →</a>
</div>
