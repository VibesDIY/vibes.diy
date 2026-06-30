---
title: "The edit button that was secretly a save loop"
date: 2026-06-29T09:00:00Z
author: "Vibes DIY"
summary: "We made the code editor live inside the running app — no hop to a separate chat route. 'Make the Code tab editable' sounded like a UI task. It was a distributed save loop in disguise, and the whole thing hinged on one decision: re-pin, don't navigate."
thumb: "/images/blog/editing-moved-into-the-app/card.jpg"
---

Once first-generation moved onto the deployed app itself, the next surface to fold in was the editor. Building and tweaking a Vibe used to mean a separate `/chat` route: a chat pane, a Monaco code view, a data browser, settings — a whole second place you went to *work on* the app, distinct from `/vibe`, the place the app actually *ran*. This is the story of collapsing that second place into the first, in two phases — and of the moment "make the Code tab editable" turned out to be a much bigger ask than it read.

<figure>
    <img src="/images/blog/editing-moved-into-the-app/card.jpg" alt="Illustration card: “re-pin ≠ navigate” set over a laptop on a desk, in the Vibes DIY teal-and-goldenrod style." loading="lazy">
    <figcaption>Folding the editor into the running app hinged on one call: re-pin the iframe, don't navigate.</figcaption>
</figure>

## Phase 1: the editor surface was mostly composition

The first phase gave `/vibe` an in-page editor surface — Code, Data, Chat, and Settings tabs, opened right from the card over the running app. The surprise was how little of it was new code.

The Data tab already existed (`DataView`). The Chat tab already existed (`ChatInterface`). Settings already existed — we just needed a *subset* of it in-vibe, so `SettingsTab` grew an optional `hide` set and the same component renders both the full My-Apps settings and the folded in-vibe one. The Code tab was the only genuinely new view, and we kept it deliberately light: a **read-only** syntax-highlighted viewer using shiki, loaded through a lazy `import("shiki")` so the highlighter never lands in the `/vibe` first-paint bundle.

The lesson of Phase 1 was an old one worth re-learning: before you build the surface, check how much of it you already own. Most of a "new editor" was four existing components and one `hide` prop.

## Phase 2: "make it editable" was a trapdoor

Phase 2 was one sentence — make the read-only Code tab editable, swap shiki for Monaco, let an owner hand-edit and save. That reads like a widget swap. It is not. The editor widget is the visible 10%. The other 90% is the loop behind a save: *edit → persist → new version → rebuild the running app → re-point at it.* That loop is where all the coupling lives, and porting it from `/chat` was the actual work.

So we traced the existing `/chat` save before writing a line. The loop: a Monaco edit becomes an `EditorState`, a save calls `chat.promptFS({ update: [code-block] })`, that returns a `promptId`, and **the new file-system id arrives later, asynchronously, on the save stream's `block.end`** — at which point `/chat` *navigates* to it.

That last step is the entire crux.

## Re-pin, don't navigate

`/vibe`'s URL is the shareable address of the running app. It must never change out from under you. So the port could not end the way `/chat`'s does. Instead of navigating to the new fsId, a save **re-pins** the running iframe to it — `setDraftFsId(newFsId)`, reusing the owner-draft mechanism the route already had. The app reloads to the version you just saved; the URL stays put.

Finding that one load-bearing decision and putting it at the very top of the plan — marked *do not start until this is signed off* — was the cheapest move in the whole phase. Everything else is a function of it. Building against a guess and reworking would have cost days; getting the one call right first cost a paragraph.

And the fiddly part — "the id you need arrives later" — turned out to be already solved. The hook was *already* surfacing the canonical post-persist `block.end` as a value called `persistedFsRef`. We didn't need to build stream-tracking; we needed to watch a value that was already flowing past us. Worth a habit: before you build the mechanism, check whether the thing you need is already in the room.

## Two events that look identical until you trace them

A clean diagram hides the parts that bite. Two of them only showed up because we traced the real sequence.

**`activate()` doesn't open the chat synchronously.** Bringing up the lazy codegen connection only flips a piece of React state; the actual handle opens an effect *later*. A naive `activate(); chat.promptFS(...)` drops the very first save against a null handle. So a save doesn't fire immediately — it *queues*, and a flush effect submits it once the handle exists. "Queued" is a real state the user can see, not a fiction.

**A manual save streams its file back, too.** The running iframe hot-swaps whenever new code streams in — great for live generation. But a hand-edited full-file save also produces a code stream, so without care you'd get *both* a hot-swap *and* a reload for one save. The rule we settled on: a manual save reloads via the re-pin, full stop; the hot-swap is suppressed while a save is in flight. One event, one update.

## Make the state machine match the test you have to write

The first cut of the save state was `idle | saving | saved | error`. The acceptance criteria asked us to assert the sequence `queued → saving → rebuilt`. Those don't line up — there was no state for "submitted, waiting on `block.end`." Renaming wasn't cosmetic:

<div class="table-scroll">
<table>
<thead><tr><th>State</th><th>Means</th></tr></thead>
<tbody>
<tr><td><code>queued</code></td><td>save recorded; waiting for the lazy chat handle, or holding while a generation finishes</td></tr>
<tr><td><code>saving</code></td><td><code>promptFS</code> accepted; awaiting the canonical <code>block.end</code></td></tr>
<tr><td><code>rebuilt</code></td><td>the persisted id landed; the app re-pinned to the saved version</td></tr>
<tr><td><code>error</code></td><td>failed; the edited buffer is kept for Retry — no silent loss</td></tr>
</tbody>
</table>
</div>

When the test you're required to write can't be expressed against your types, the types are wrong. Fix them before the code.

## The 90% was in the review

The widget went in fast. The save loop is where the bugs lived, and an adversarial review pass surfaced a three-deep chain of them in the failure paths — each real, none visible in a happy-path demo:

- A save fired in the gap *after* a generation looks done but *before* its persisted `block.end` could adopt the wrong turn's id and re-pin to the wrong version. Fix: hold the save until the prior turn fully settles.
- If a save's connection terminally fails, it could wedge on "Saving…" forever. Fix: treat a terminal failure as a save error, buffer preserved.
- And the retry of *that* could re-wedge in "queued" on a stale stream id. Fix: let the retry flush once the connection has terminally given up.

None of those are the editor. All of them are the loop. That's the whole point: estimate the persistence loop, not the textarea.

## One surface, again

The through-line is the same as when we deleted the preview pane: the simplest system is the one where you work on the app *in the place the app runs*. The agent generates into it; now you hand-edit into it too — same URL, same iframe, no second route to hold in your head. The editor didn't get a new home. It moved into the one that was already live.

<div class="post-cta">
  <h3>Open the code. Change a line. Watch it reload.</h3>
  <p>Every Vibe is editable in place — the source, the data, the settings, right on the running app.</p>
  <a href="https://links.vibes.diy/homepage" class="btn">Start building →</a>
</div>
