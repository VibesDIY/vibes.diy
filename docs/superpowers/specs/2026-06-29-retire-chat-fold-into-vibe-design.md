# Retire `/chat`: fold the editor surface into `/vibe` (design)

> **Status: design-level**, approved by jchris in the #2518 brainstorm
> (2026-06-29). Ready for `writing-plans`. Tracks **#2518** (Track C of the
> DO-split finish); supersedes the open-decision list in
> [`docs/superpowers/plans/2026-06-20-do-split-finish/05-chat-route-deprecation.md`](../plans/2026-06-20-do-split-finish/05-chat-route-deprecation.md),
> which predates the #2714 DO collapse and the #2837 spike.

## Thesis

The agent lives _in_ the vibe. The running app on `/vibe/:owner/:slug` is the
surface and the only shareable URL; the codegen agent and the editor tools float
_on top of it_. `/chat` — a separate route that made the editor the container and
the app a preview pane inside it — goes away. The deleted surface area is the
deliverable.

Most of the backend that made this hard is already done: #2714 collapsed the
three Durable Objects into one shard-keyed class, `chatApi` is already lazy
(`makeLazyChatApi`), and `/vibe` already runs codegen in place
(`useInVibeGeneration`). #2837 shipped the first user-facing step — a brand-new
vibe now builds in place on `/vibe` instead of hopping to `/chat`. What remains is
folding the **editor tools** onto `/vibe` and retiring the `/chat` route.

## Decisions (from the brainstorm)

| Topic                | Decision                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Editor surface**   | Absorb the editor tools into `/vibe` as an **in-page expandable state** (overlay / grown card), not a separate route. (Q1)                                    |
| **URL**              | The page URL is **always the running vibe**. Opening the editor changes **no URL**. `/chat/:o/:s` → `/vibe/:o/:s`. (Q2)                                       |
| **img-gen (#2350)**  | Keep the `imgGenAppSessionStopgapHandlers` stopgap on AppSessions; the heavy/light-session split is a **separate follow-up**, not on this critical path. (Q3) |
| **`vibesMsgEvento`** | Leave the monolith evento alone here; its retirement is isolated cleanup in **#2846**. (Q4)                                                                   |

### What "the editor surface" actually is (corrected)

There is **no terminal/console pane**. The `/chat` editor is the `ResultPreview`
view-switcher — `ViewType` = `preview` | `code` | `data` | `chat` | `settings`
(verified, `prompts/pkg/view-state.ts`):

- **Preview** — the live app. This is already what `/vibe` _is_; nothing to move.
- **Code** — the Monaco editor (`CodeEditor.tsx`) to view/edit generated source.
- **Data** — the vibe's documents (`DataView.tsx`).
- **Chat** — the scrollable message log. Build/runtime **errors surface inline in
  the chat**, as they do today — there is no separate error pane to build.
- **Settings** — `AppSettingsPanel` (app settings + sharing), shown when
  `currentView === "settings"` (`ResultPreview.tsx`). **Partly already on `/vibe`**:
  the unified card's Share view (`SharePanelView`, #2680) covers the sharing half.
  Phase 1 must fold the rest of `AppSettingsPanel` into the `/vibe` layer (or map it
  onto the card's settings) and handle `?view=settings` deep-links on the 301.
  **Full control-by-control audit + reachability (Title / Theme / Icon / model
  settings / env vars / sharing, and what stays on `/vibes/mine`): #2850.**

So "absorb the editor surface" = surface **Code**, **Data**, **full chat history**,
and **Settings** (reusing `/vibe`'s existing Share affordance where it overlaps) as
an in-page expandable layer over the running app, with errors inline in chat.

## Components

### 1. In-page expandable editor surface on `/vibe` (the build)

An affordance on the running vibe (from the unified card / overlay layer) expands
to a layer showing the **Code** and **Data** views, the **full chat history**, and
**Settings** (§"editor surface") over the running app. No URL change (Q2). Reuses
the existing `ResultPreview` pieces — `CodeEditor`, `DataView`, the chat-history
rendering (`ChatInterface` / `PromptAndBlockMsgs`), and the settings tabs — rather
than re-implementing them.

- **Full code edit-and-save (decided, jchris).** The Code view keeps Monaco's full
  **edit-and-save**, not view-only — port `CodeEditor`'s save path (`onCode` /
  `agent-autosave`) so an owner edits source directly in the layer, and the
  save → rebuild → hot-swap loop updates the running app behind it. Prefer reusing
  `useInVibeGeneration`'s `srvVibeSandbox.pushSource` hot-swap over a split-pane
  reload, so the app under the layer updates in place.
- **Always mobile (decided, jchris).** The layer must be usable at **390px** — Code
  and Data are **not** gated to a larger viewport. Mobile is the primary target, not
  a fallback; design Monaco/`DataView` to work in a phone-sized overlay.
- **Keep Monaco lazy.** `ResultPreview.tsx` already loads the editor via
  `const CodeEditor = lazy(() => import("./CodeEditor.js"))`, which code-splits
  Monaco + shiki out of the initial bundle. The `/vibe` surface **must preserve
  this**: import `CodeEditor` only through `lazy(() => import())` and mount it
  **only when the Code view is opened**, so a normal `/vibe` page view never
  parses Monaco. (Monaco is the single heaviest dependency on this surface; a
  static import would regress `/vibe`'s first paint for every viewer.)
- `chatApi` opens lazily on demand (already true) when the history/stream is shown.

### 2. Redirect + route teardown

- **`/chat/:ownerHandle/:appSlug/:fsId?` → `/vibe/:ownerHandle/:appSlug/:fsId?`**,
  a **301** (permanent — the running vibe is the canonical URL forever, per Q2).
  Preserve the `fsId` segment (versioned views) and carry through any query
  params. Confirm PostHog/GTM pageview + key events fire on the `/vibe`
  destination after the redirect (a 301 lands a real `/vibe` navigation, so SPA
  analytics fire there — verify nothing keyed on the `/chat` path).
- **Retire `routes/chat/chat.$ownerHandle.$appSlug.tsx`.** Its editor behavior is
  re-expressed by component 1; the route becomes a redirect.
- **`/chat/prompt`** already redirects into `/vibe` (shipped #2837), but it still
  **imports and renders `<Chat>`** from the doomed file as its auth/openChat loading
  screen (`prompt.tsx:6,90`). Phase 2 must rewrite that loading UI to a lightweight
  placeholder (no `Chat` dependency) before `chat.$ownerHandle.$appSlug.tsx` can be
  deleted — see prerequisite 3b.

### 3. Prerequisites before deleting the chat route component (gotchas)

Two things still depend on `routes/chat/chat.$ownerHandle.$appSlug.tsx` and must be
severed before it can be deleted:

- **3a — Type extraction.** `CodeEditor.tsx` (and other `ResultPreview` files)
  import shared types (`PromptState`, `PromptBlock`, `HydratedCodeViewFile`) **from
  that file**. Move them to a neutral module (e.g. alongside
  `routes/chat/prompt-state.ts` or a dedicated `types/` file) and repoint importers.
  Mechanical; its own commit.
- **3b — `prompt.tsx` renders `<Chat>`.** `routes/chat/prompt.tsx` imports the named
  `Chat` export (`:6`) and renders `<Chat inConstruction …>` as its loading screen
  while auth/openChat resolve (`:90`). Rewrite that to a lightweight placeholder with
  no `Chat` dependency — otherwise the supposedly-deleted `Chat` has to stay alive
  just for `prompt.tsx`.

### 4. Untouched (deferred to follow-ups)

- **img-gen** keeps riding AppSessions via the stopgap (#2350).
- **`vibesMsgEvento`** monolith stays (#2846).

## Phasing (each its own mergeable PR under #2518)

- **Phase 0 — shipped (#2837).** New-vibe entry → first build in place on `/vibe`.
- **Phase 1 — in-page editor surface on `/vibe`.** Surface Code + Data + full chat
  history + Settings (`AppSettingsPanel`, reusing the card's Share where it overlaps)
  as the expandable layer (Monaco stays lazy; extract the shared types, 3a).
  _Biggest piece. Must land before Phase 2 so the editor tools are never missing._
- **Phase 2 — redirect + teardown.** 301 `/chat/:o/:s` → `/vibe` (incl.
  `?view=settings` deep-links), rewrite `prompt.tsx`'s loading UI off `<Chat>` (3b),
  retire `chat.$ownerHandle.$appSlug.tsx`, verify analytics. **This is the "deleted
  surface = deliverable" moment** and closes #2518.
- **Follow-ups (separate issues).** img-gen heavy/light split (#2350);
  `vibesMsgEvento` retirement (#2846).

**Sequencing constraint:** Phase 1 before Phase 2 — redirecting `/chat` away
before the editor tools exist on `/vibe` would briefly strip Code/Data/history
from power users. Phase 1 first keeps the retirement loss-free.

**Decided (jchris):** the Code view keeps **full edit-and-save** (not view-only),
and the layer is **always mobile** (usable at 390px, not gated to a larger
viewport). Both folded into component 1.

Still open (resolve in `writing-plans` / Phase 1):

1. **Trigger affordance.** What control on the unified card / overlay opens the
   editor layer, and how does it relate to the existing `💬` chat-history toggle
   (#2677) — same control with tabs (Code / Data / Chat / Settings), or separate
   entry points? (UI detail; Storybook + screenshot loop applies.)
2. **Settings fold (#2850).** Which Settings controls move into the `/vibe` layer
   vs a "manage in `/vibes/mine`" link — lean: fold env vars + title/theme/icon,
   link out model settings, sharing-manage stays #2680.
3. **Analytics parity check.** Enumerate the PostHog/GTM events currently fired on
   `/chat/:o/:s` and confirm each has a `/vibe` equivalent post-redirect.

## References

- Issue: #2518 (Track C). Epic: #2675. Predecessors: #2714 (DO collapse), #2517
  (lazy ChatSessions), #2837 (Phase 0 spike, merged).
- Follow-ups: #2350 (img-gen heavy/light), #2846 (`vibesMsgEvento`).
- Code: `routes/vibe.$ownerHandle.$appSlug.tsx`, `routes/chat/chat.$ownerHandle.$appSlug.tsx`,
  `components/ResultPreview/` (`ResultPreview.tsx`, `CodeEditor.tsx`, `DataView.tsx`, `ViewControls.tsx`),
  `hooks/useInVibeGeneration.ts`.
- Supersedes: `docs/superpowers/plans/2026-06-20-do-split-finish/05-chat-route-deprecation.md`.
