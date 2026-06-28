# First-generation state on `/vibe`: stream → live preview, de-blur, history toggle

**Date:** 2026-06-28
**Status:** design — approved in brainstorm (jchris, 2026-06-28); implementation not started.
**Issue:** #2677 (child of the agent-in-vibe UX epic #2675). Subsumes #1745 (inline edit +
hot-swap on `/vibe`); coupled to #1896 (Instant Starter Stack two-lane model).
**Epic doc (source of truth):** [`notes/2026-06-26-agent-in-vibe-ux-epic.md`](../../../notes/2026-06-26-agent-in-vibe-ux-epic.md)
(§1a edit affordance + cached/write lanes, §1b first-generation, §1d build seams, §2 ownership
decides at the write, §3 login on first write, §8 Q4 perf contract, §20 cached = system forks).

---

## 0. What #2677 is

Today the unified card's chips / "Other" **hop to `/chat`** for codegen: `handleEditPrompt`
(`routes/vibe.$ownerHandle.$appSlug.tsx:196`) base64-encodes the typed change and navigates —
owner → `/chat/$o/$a?prompt64`, non-owner → `/remix/...` — both pre-filling the chat composer.
**#2677 removes that hop.** A non-cached change generates **in place** on `/vibe`: the
`PromptAndBlockMsgs` stream shows inside the inset card, the first completed code block swaps the
card body to the live app, the forming app **de-blurs** behind the card, and subsequent builds
hot-swap in place. A history affordance reopens the stream/past chat at any time.

Tightly coupled and designed here: the **cached-read chip lane** (§1a/§20). A cached chip is a
**read** — navigate to an already-generated vibe, no codegen, no login. Only "Other"/uncached is
a **write** (login + codegen). The two-lane split is what makes the onramp feel instant where it
can and honest about latency where it can't.

---

## 1. Decisions locked (brainstorm, jchris, 2026-06-28)

| # | Decision | Choice |
| --- | --- | --- |
| Gen iframe | Which iframe forms + de-blurs behind the card during a real generation | **Hot-swap the existing `/vibe` iframe in place** (no reload, no second iframe). Risk accepted: it's on the direct line to the core product value. |
| Single surface | Consequence of the above | **Retire the preview iframe — one iframe surface.** The deployed runtime iframe hot-swaps for both first-gen and edits; `PreviewApp`'s separate `preview=yes` shell becomes deletable. |
| Cached lane | How to slice the cached-read lane vs. real generation | **Frontend-first, but only if it hits the REAL contract** (real stored `chatSections`, real read path). No fake handlers. If the honest version needs backend before it's useful, defer the whole lane to its own issue rather than stub it. |
| Fork point | Where the non-owner make-it-yours happens in-place | **Fork inline, then `replaceState` the URL seamlessly** to `/vibe/$yourHandle/$slug`; card stays mounted, iframe de-blurs into the copy. Never routes a non-owner into the owner's chat. |
| Chat toggle | How the stream/history reopens after the app runs | **Lives inside the Edit view + a history-summary affordance** (no new nav item; nav stays Home / Edit / Share, consistent with §1e retiring the Chat glyph). Carries a **line/block-count summary** so history size is sensible at a glance. |

---

## 2. Why "hot-swap in place" gives us one iframe surface

There are two iframe surfaces today:

- **`/chat` `PreviewApp`** — loads a `preview=yes` "pending shell", registers the hot-swap
  bridge, `srvVibeSandbox.pushSource()` installs streamed code into the live DOM, and runs the
  **de-blur ramp** (`blurPx` starts 25px, ×⅔ per `hotSwapCount`, `backdropFilter`;
  `PreviewApp.tsx:133-191`).
- **`/vibe` deployed runtime** — `calcEntryPointUrl`, fsId-pinned, **no hot-swap wired** from the
  route, ships in the first byte of HTML (`vibe.$ownerHandle.$appSlug.tsx:58-87`).

**The decisive seam:** the runtime's `registerDependencies` (`vibe/runtime/register-dependencies.ts:419-443`)
calls `registerHotSwapHandler()` and `sendRuntimeReadyWithRetry()` **unconditionally**. The
`set-source` listener is registered for *every* runtime, and `preview=yes` only **skips SSR
viewer identity** (`api/svc/intern/render-vibe.ts:169-179`) — it does **not** gate hot-swap. The
host-side bridge (`vibe/srv-sandbox/srv-sandbox.ts`) is a **shared singleton** that posts
`set-source` to whichever iframe last announced `runtime.ready` and caches the latest source in
`pendingSource` for replay.

So the deployed `/vibe` iframe **already accepts `pushSource`**. We can stream codegen into the
app the route already mounted, with no reload and no preview iframe. `PreviewApp`'s separate
preview surface becomes deletable — a deletion win for the subtraction ledger (§7 of the epic) and
the end of "preview vs deployed drift" bugs.

> **Sequencing caveat:** `/chat` still mounts `PreviewApp` and coexists until #2518 (`/chat`
> retirement, gated on Track B #2517). So the *full* deletion of the preview iframe lands when
> `/chat` retires. #2677 **builds and owns the single-surface hot-swap path on `/vibe`**; `/chat`
> converges onto it later (not the reverse).

---

## 3. Architecture: lift the generation engine into a shared headless hook

The generation machinery is currently coupled to the chat route's reducer:

- `useChatSession` (`pkg/app/hooks/useChatSession.ts`) owns the codegen chat handle —
  `openChat({mode:"codegen"})`, `attachSectionStream` → dispatches `PromptAndBlockMsgs` blocks
  into the chat route's `PromptState`, fires queued prompts, reconnect/watchdog loops.
- `PreviewApp` consumes `promptState.blocks`, detects the **first** `isCodeEnd` per block
  (`call-ai/v2/block-stream.ts`), resolves code via `getCode(promptState)`, calls
  `srvVibeSandbox.pushSource()`, and tracks `hotSwapCount` for the blur ramp.

**Plan: extract a headless `useInVibeGeneration` hook** that owns all of the above against a
**local reducer** (not the chat route's), so it runs on `/vibe`:

```
useInVibeGeneration({ ownerHandle, appSlug, fsId, chatApi, sharedApi, srvVibeSandbox })
  → {
      phase: 'idle' | 'streaming' | 'live',   // 'streaming' until first isCodeEnd, then 'live'
      blocks: PromptAndBlockMsgs[],            // the live stream, for the card body + history
      blurPx: number,                          // de-blur ramp level for the overlay
      counts: { messages: number; lines: number },  // history summary (real; see §6)
      sendPrompt(text): void,                  // fires codegen on the existing /vibe iframe
    }
```

The `UnifiedVibeCard` and the **blur overlay** are pure consumers. `/chat` later swaps its bespoke
wiring for this same hook (the convergence in §2). This keeps each unit testable: the hook is the
only thing that touches the chat handle + sandbox; the card just renders `phase`/`blocks`/`counts`.

The blur overlay is a `backdropFilter` element layered over the existing `/vibe` iframe, below the
card, decaying per `hotSwapCount` — the same effect `PreviewApp` runs, now on `/vibe`.

---

## 4. The three PR slices (independently mergeable)

### PR-A — in-place real generation (frontend-only, no backend)
Replace `handleEditPrompt`'s **owner branch** with in-card generation via `useInVibeGeneration`:
stream `PromptAndBlockMsgs` in the Edit-view body, detect first `isCodeEnd`, swap body → chips,
de-blur the live app behind. The codegen auth-gate already exists and is correct (§3) — **zero
server changes.** This is the bulk of #2677 / #1745.

### PR-B — seamless non-owner fork (the hard constraint)
A non-owner **cannot** write the owner's chat — the server rejects on `userId` mismatch
(`api/svc/public/prompt-chat-section.ts`). So on a non-owner's first write, **fire make-it-yours
*before* opening codegen** (the one server action, §2 of the epic — code-only copy → your handle,
prompt rides along), `replaceState` → `/vibe/$yourHandle/$slug`, then `sendPrompt` runs in *their*
copy. The card stays mounted; the iframe de-blurs into the fork; the #1856 "it's yours now"
message is the only surfacing. **The fork is the explicit point the non-owner path diverges** — it
never opens a codegen chat against the owner's session.

### PR-C — cached-read lane (the two-lane split)
A cached chip is a **read**: navigate to a real pre-built public app (real stored `chatSections`),
no codegen, no login. **The fakeness line (jchris's constraint):** the lane is honest only if
cached targets are *real navigable apps with real stored chat read through `getChatDetails`* — not
hardcoded frontend history. So PR-C ships the real navigation + real read behavior. What's
genuinely backend-coordinated and **deferred to a follow-up**: a **system/cache handle** that owns
the curated forks (a real curator handle works in the interim), a **content-address dedupe key**
`(sourceFsId, transform)`, and the formal **auth-skip** optimization for serving cached results.
**If the honest version turns out to need that backend before it's useful, we fall back to
deferring the whole lane to its own issue — no stubs either way.**

---

## 5. Backend answer (what ships frontend-first vs. needs coordination)

**Frontend-only (no server work):**
- All of PR-A — real generation reuses the existing codegen chat + the existing auth-gate
  unchanged (§3 confirms the gate is correct and stays; the pending prompt already survives the
  sign-in redirect via the `?intent=`/prompt routing).
- The single-iframe hot-swap path (the runtime already registers the bridge — §2).
- The cached-lane *navigation + real-read* behavior in PR-C, **provided** cached targets are real
  apps with real stored chat.

**Backend-coordinated (PR-C's "real" lane, a follow-up — not blocking A/B):**
1. A **system/cache handle** that owns curated + precached forks (so the slug-vs-fsId rule stays
   uniform — system is just another owner, §20).
2. A **content-address dedupe key** `(sourceFsId, transform)` so repeated cached clicks resolve to
   one fork (no GC needed — §20).
3. **Serving cached results as page-views that skip the codegen auth-gate** (reads, no login).

None of (1)-(3) blocks PR-A or PR-B.

---

## 6. The history affordance + where the summaries come from

No new nav item (nav stays **Home / Edit / Share**). During generation the Edit body shows the
live stream; after first-code it shows chips with a **history-summary row** above them. Tapping it
reopens the past stream. **The summary carries a line/block count** (jchris: "so you can sense if
it grows").

**Data source — verified, split into real vs. not:**

- **The counts (`N messages · ~L lines`) — real and free.** *messages* = `promptState.blocks.length`;
  *lines* = the length of the resolved code array `getCode(promptState).code` — the **exact** value
  `PreviewApp` already computes to hot-swap. For a vibe you *land on*, the same two numbers come
  from the stored `chatSections` via the real `getChatDetails` read (`api/svc/public/get-chat-details.ts`
  selects `chatSections.blocks`).
- **The narration text — real prose, freeform shape.** `block.toplevel.line` carries
  `line: "string"` — the model's actual narration, already rendered by `MessageList.tsx`. The
  history body **reuses `MessageList`** to show real prompts + real narration + per-turn code line
  count. It is **not** invented.
- **Out of scope (honesty flag):** tidy retrospective one-liners like "built a 4×4 grid of pad
  buttons." The model's toplevel prose is freeform and not guaranteed to be neat past-tense
  bullets; the sketch uses such bullets only as *illustrative stand-ins*. Generating clean
  summaries would be a **separate model step** — filed as **#2753** — #2677 shows the model's
  real narration verbatim and never hardcodes summaries.

---

## 7. Perf contract (§8 Q4) — the two lanes look categorically different

| | Cached / READ lane | Real-generation / WRITE lane |
| --- | --- | --- |
| Trigger | a cached (curated/precached) chip | "Other" / an uncached chip / first generation |
| Budget | **click-as-page-view, < 500ms** | latency-bearing, seconds |
| Visible | instant content swap; **no stream, no blur, no spinner** | **stream in card + de-blur behind**; reads as "generating for real" |
| Identity | anonymous **read** | **login on the write** |
| Commits | nothing (navigate to existing content) | owner → same slug, new fsId; non-owner → new slug (fork) |

The contract is that the visible treatment makes the lane obvious *before* the user waits — the
real lane's stream + de-blur is the "this is generating for real" signal #1896 asked for, so
latency never reads as "the app suddenly got slow."

---

## 8. Build-seam map (reuse, don't rewrite)

| Need | Reuse / extend | Where |
| --- | --- | --- |
| Codegen chat handle + section stream | `useChatSession` → extract `useInVibeGeneration` (local reducer) | `pkg/app/hooks/useChatSession.ts` |
| First-code-block detection | `isCodeEnd` per block | `call-ai/v2/block-stream.ts` |
| Hot-swap into the live iframe | `srvVibeSandbox.pushSource()` (already registered by the deployed runtime) | `vibe/srv-sandbox/srv-sandbox.ts`, `vibe/runtime/register-dependencies.ts` |
| De-blur ramp | `blurPx` 25 ×⅔/`hotSwapCount` via `backdropFilter` | `pkg/app/components/ResultPreview/PreviewApp.tsx:133-276` |
| Resolved code + line count | `getCode(promptState).code` | `pkg/app/components/ResultPreview/get-code.ts` |
| The chips | `OptionButtons` (already in `@vibes.diy/base`, the card's body) | `base/components/OptionButtons.tsx` |
| The card shell | `UnifiedVibeCard` `body` slot (already supports view-swapping) | `base/components/UnifiedVibeCard.tsx` |
| History rendering | `MessageList` (real prompts + narration) | `pkg/app/components/MessageList.tsx` |
| Stored-chat read (land-on history) | `getChatDetails` / `getChatResponse` | `api/svc/public/get-chat-details.ts` |
| The hop being replaced | `handleEditPrompt` + `/remix` + `setPromptIfEmpty` | `routes/vibe.…tsx:196`, `routes/remix.…tsx`, `routes/chat/chat.…tsx` |

---

## 9. Sketches (real components, Storybook `Sketches/Agent-in-Vibe`)

Built on the **real `UnifiedVibeCard`** (its `body` slot) so the sketches stay
single-source-of-truth. Story IDs `sketches-agent-in-vibe--*`; PNGs in
`notes/sketches/agent-in-vibe/`.

**Real-gen · streaming (pre first code block) — app de-blurs behind:**

![first-gen streaming](https://raw.githubusercontent.com/VibesDIY/vibes.diy/884a77a1fc58186c6d27b569aaf7ca4cd34f41f2/notes/sketches/agent-in-vibe/13-first-gen-streaming.png)

**Real-gen · live (after first code block) — app sharp, chips + history-summary row:**

![first-gen live](https://raw.githubusercontent.com/VibesDIY/vibes.diy/884a77a1fc58186c6d27b569aaf7ca4cd34f41f2/notes/sketches/agent-in-vibe/14-first-gen-live.png)

**History reopened — past stream via the real `getChatDetails` path (narration is the model's
real prose; counts are real):**

![history reopened](https://raw.githubusercontent.com/VibesDIY/vibes.diy/884a77a1fc58186c6d27b569aaf7ca4cd34f41f2/notes/sketches/agent-in-vibe/15-history-reopened.png)

**Non-owner seamless fork — make-it-yours (#1856) + de-blur into your copy, URL flipped to your
handle:**

![non-owner fork](https://raw.githubusercontent.com/VibesDIY/vibes.diy/884a77a1fc58186c6d27b569aaf7ca4cd34f41f2/notes/sketches/agent-in-vibe/16-non-owner-fork.png)

**Perf contract — cached READ vs real WRITE, side by side (the categorical visible difference):**

![perf contract](https://raw.githubusercontent.com/VibesDIY/vibes.diy/884a77a1fc58186c6d27b569aaf7ca4cd34f41f2/notes/sketches/agent-in-vibe/17-perf-contract.png)

---

## 10. Risks & open items

- **Hot-swap into a deployed, fsId-pinned app (accepted risk).** `pushSource` replaces `App.jsx`
  in the live DOM, resetting component state to the new module — exactly as the preview path does
  today, but now on a "real" deployed app. Validate: (a) the deployed runtime's `runtime.ready` is
  captured by the singleton sandbox on `/vibe` (the host listener is mounted in the provider, not
  only on `/chat`); (b) end-of-stream settles to the canonical bundle without a jarring reload.
- **End-of-stream fsId settle.** On `/chat`, `PreviewApp` repoints `pinnedFsId` at end-of-stream
  for the URL-had-fsId case. On `/vibe` the iframe is already fsId-pinned; decide whether to
  re-point to the new fsId (canonical bundle) or keep the hot-swapped DOM. Lean: re-point quietly
  once the autosave fsId is known, matching `/chat`.
- **Cached-lane fakeness gate (PR-C).** Before building, confirm at least one real curated app
  with real stored chat exists to navigate to. If not, PR-C waits on the system-handle backend or
  defers — no stub.
- **Auto-summaries are explicitly deferred** (§6) — tidy per-turn summaries are a separate model
  step, filed as **#2753**.

---

## 11. Subtraction-ledger additions (epic §7)

| Deleted | Learning |
| --- | --- |
| The preview iframe (`PreviewApp`'s `preview=yes` shell) — once `/chat` retires (#2518) | The deployed runtime already registered the hot-swap bridge unconditionally; "preview" was only an SSR-identity skip. One iframe surface kills the preview-vs-deployed drift class of bugs. |
| `handleEditPrompt`'s `/chat` and `/remix` hops (owner + non-owner) | The hop existed only because `/vibe` couldn't generate in place. Once it can, the destination is the same surface — no navigation. |
