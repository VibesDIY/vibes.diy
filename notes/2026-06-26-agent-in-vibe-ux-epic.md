# UX Epic: The agent lives *in* the vibe

> **One-line thesis.** Today the editor is the container and the running app is a
> preview pane inside it. We invert that: **the vibe is the container, and the codegen
> agent is an affordance inside it.** One route (`/vibe`), one display primitive,
> parameterized by *who you are* × *what the creator intended* × *whether an app exists
> yet*. The `/chat` route, and a large amount of chrome and copy, **go away** — that
> deleted surface area is the deliverable, not a side effect.

Status: planning. Owner: jchris. Drafted 2026-06-26. This is a living plan — update it
as the sketches resolve.

## Why this is one decision, not thirty

The 30 issues in the backlog are mostly *symptoms* of four unmade decisions, not
independent bugs. Make the decisions once and most symptoms resolve as consequences —
many as pure deletion.

| Knot | The unmade decision | Symptom issues |
| --- | --- | --- |
| **A. Verbs/identity** | One vocabulary for two outcomes: *use the shared thing* vs *make your own* | #1857 #1855 #1854 #1856 #1709 #2162 #2262 #2037 #2353 #1747 #1973 |
| **B. Share panel** | Link-first; collaboration behind "Manage access" | #2238 #2232 #2233 #2234 #2235 #2236 #1768 |
| **C. In-app chrome** | The pill/action-bar inconsistency only exists to ferry between app and editor | #1708 #1709 #2262 #2275 #2178 #1836 #1742 #2162 |
| **D. The inversion** | Agent-in-vibe on one `/vibe` route; retire `/chat` | #2518 #1745 — and this **dissolves most of C** |

**The compression claim:** D makes C largely moot (you don't fix the EDIT/CLONE/REMIX
submenu — you delete it). A collapses ~11 issues into one naming spec + relabels. B is
the one cluster that stays a distinct surface. The success metric for the whole epic is
**less code and less UI than we started with.** What we remove becomes "learnings"
(captured in §7), not lost work.

## 1. North star: one edit affordance, one `/vibe` surface

There are **two places**, and they share **one primitive**.

1. **The homepage** is where the *first* prompt happens — fed by the curated starter
   content (today's `/start` / Instant Starter Stack #1896). You pick a starter or type a
   prompt; submitting **creates a vibe and routes you to `/vibe`.** Prompt *entry* lives
   here, before the vibe exists.
2. **`/vibe/$user/$app`** is where the app lives and is changed: it arrives in a
   **first-generation** state (code being built), settles into **live + edit**, and stays
   there forever. This is the bookmarkable / shareable URL.

The primitive that unifies them is **the edit affordance: curated chips + a textarea.**
The same component appears on the homepage, on a curated starter, and on *any* vibe you
land on and want to change. Crucially:

> **There is no separate "iterate flow." Editing a vibe is the starter stack pointed at an
> existing app.** Sometimes there are a few curated "Make it ___" chips, sometimes one or
> two, sometimes none and it's just the textarea. Because the gesture is identical whether
> you're creating from a starter or transforming a stranger's vibe, **the starter stack
> *trains* the universal edit gesture** — first use teaches every future use. That's the
> simplification: one affordance to design, learn, and maintain, not a starter UI plus a
> separate edit UI.

```
 HOMEPAGE  (prompt entry)              /vibe/$user/$app   (bookmarkable; app lives here)
 ─────────────────────────            ────────────────────────────────────────────────
  the EDIT AFFORDANCE:                ┌─ FIRST-GENERATION ─┐  arrived from a prompt;
  curated chips + textarea            │ code streams in,   │  code is being built;
   ▸ Make a song player               │ app blooms in the  │  NOT today's chat UI.
   ▸ Make a list w/ pals              │ canvas in place    │
   ▸ Make a game        submit        └─────────┬──────────┘
   ✎ describe…  ──── create vibe ──▶            ▼
                                      ┌─ LIVE + EDIT ──────────────────────┐
   (same component reappears  ───────▶│ app runs full-bleed; the SAME edit │
    on every vibe as "change   on a   │ affordance (chips + textarea) is   │
    this app")                 vibe   │ how you change it. param by        │
                                      │ who-you-are × creator intent (§2). │
                                      │ non-owner's first edit → forks to  │
                                      │ their copy, inline msg (#1856).    │
                                      └────────────────────────────────────┘
```

- **The app's URL is always `/vibe`.** The homepage is the front door for the *first*
  prompt only; everything after lives on `/vibe`. Slug allocated on submit so the URL is
  shareable from second zero (lifecycle in Q3).
- **Mobile-first.** The canvas is the app, full-bleed; the edit affordance is a bottom
  sheet, never a side-by-side desktop editor. **Decided: sketch/design mobile only for now**
  — defer the desktop treatment until the mobile flows feel right (don't assume
  mobile-with-breathing-room yet).
- **The codegen agent lives *in* the vibe.** First-generation streaming and every later
  edit happen on `/vibe` through the one affordance. No `/chat`, no second URL, no context
  switch.
- **Everything floats *above* the app.** Because the agent is in the app (not the app in
  the agent), the chips, the generation stream, and the chat all render as a **floating
  overlay layer on top of the running app** — exactly like the VibesSwitch and comments
  float over the iframe today (the existing `ExpandedVibesPill` overlay on the vibe route,
  `vibe.$ownerHandle.$appSlug.tsx`). Nothing pushes the app aside or swaps it for a code
  pane; the app is always *the surface*, the agent is always *on top of it*. (This makes
  #1836's "open below / push content down" request moot — floating-over is now intentional.
  **Decided: no per-vibe first-run onboarding** — the homepage/start flow already opens the
  switch, so we don't add a per-vibe coach; #1836's onboarding idea is dropped.)
- **The inversion, made literal: the rounded inset card moves from the app to the overlay.**
  On the old chat route the *app preview* was the inset rounded card (`margin:12px;
  borderRadius:12px`, `ResultPreview.tsx:108`) sitting inside the chat. Now the **overlay**
  (open chat / chips / stream) takes that exact treatment on mobile — inset with rounded
  corners and edge spacing — so the **vibe always shows around its edges** and you never
  forget the app is right there underneath. And during a generation the **app behind the
  overlay reuses the existing progressive de-blur** (`PreviewApp.tsx`: `blurPx` starts 25px
  and decays ×⅔ per `hotSwapCount` via `backdropFilter`, falling back to moving-stripes) —
  the same blur→sharp ramp the old route ran on its preview, now on the forming app under
  the floating agent. Roles swapped; effects reused.

### 1a. The edit affordance — the one reusable primitive (design this first)

```
 ┌─────────────────────────┐   Two chips (up to THREE on occasion) + "Other" (free text).
 │   ▸ Make it a drum kit   │   - Curated chips are CACHED ("cached" == "curated" here)
 │   ▸ Add a high score     │     → instant, served as a page view: NO login, NO codegen.
 │   ▸ Other…  (free text)  │   - "Other", or any click whose result isn't cached → a
 ├─────────────────────────┤     REAL codegen request → login at that moment (§3). The
 │  ✎ describe a change…  ▸ │     login wall sits on codegen, not on the page.
 └─────────────────────────┘   - Future: we may pre-cache predicted next-clicks even on
                                  user-generated vibes — then "cached" extends past curated.
        Same component, different seed:
        - Homepage / starter: CREATE a new app ("Make a ___").
        - Any vibe: TRANSFORM this app ("Make it ___"); a non-owner's first
          transform forks to their own copy (#1856), inline & non-blocking.
```

Two (sometimes three) chips keep it a trained, low-choice gesture; "Other" is the open
road. **Reuse the existing chat suggestion-chip component for visual unity** —
`OptionButtons` (`vibes.diy/pkg/app/components/OptionButtons.tsx`), which is already a
decoupled, Tailwind-styled list fed by `▸`-prefixed option lines parsed out of the last AI
message (`parseOptionLines`, `utils/option-lines.ts`). That's the seam (see §1d): the chips
*are* the chat's suggestion chips, so the edit affordance and the chat are the same data,
rendered in two places. Same component, different seed — this absorbs the Instant Starter
Stack (#1896), the inline edit/hot-swap (#1745), and the old distinct "iterate" UI into
**one** thing.

### 1b. First-generation (and every non-cached change) state on `/vibe`

A non-cached click (Other, or any uncached chip) starts a **generation phase** that takes
time. Because it takes time, **show the chat stream while it generates** — then **hide it
the moment the first code block completes** and show the live preview instead. The chat is
never the destination; it's a transient progress view that yields to the running app.

```
  DURING generation (pre first code block)      AFTER first code block completes
  ┌─────────────────────────┐                   ┌─────────────────────────┐
  │ building your app…      │  show the stream  │                         │
  │ ▸ adding a grid…        │  (real AI         │     (live preview —     │
  │ ▸ wiring up sound…      │   narration       │      app running)       │
  │ ▸ ```jsx                │   streaming)      │                         │
  │   function App() {      │                   ├─────────────────────────┤
  │ ...                     │   ── 1st code ──▶ │  💬 chat   ⌂  ◐ handle ▾ │ ← toggle
  └─────────────────────────┘   block done      └─────────────────────────┘   reopens chat
```

- **Decided: the stream lives in the inset rounded card** — the same card it keeps after the
  app appears. The card's shape never changes; only its *contents* swap (stream → live app)
  while the **forming app de-blurs behind it**. Least motion, most consistent.
- **Detecting "first code block completes":** the stream is `PromptAndBlockMsgs`; watch for
  the first `block.code.end` (`isCodeEnd`, `call-ai/v2/block-stream.ts`). On that event, swap
  the card's contents stream → live preview and hot-swap subsequent builds in place.
- **Chat is a toggle, always available.** A `💬` control opens the chat whether it's *still
  streaming* or *complete* — so a curious user can watch the build, and anyone can reread
  how an app was made. The chat is hidden by default once the app runs, not deleted.
- **Curated (cached) items have no real generation, so their chat is "faked."** Because the
  chips are cached/hand-built, there's no live stream — but the toggle must still open *some*
  plausible history. So curated starters ship with **pre-authored chat** stored in the **same
  data structures** as real chat (`ChatSections` / `PromptAndBlockMsgs`), including the
  trailing `▸` option lines that render as the next chips. One data model, real or faked.
- It must **not** look like today's chat editor — the stream is a transient overlay, not a
  side-by-side code pane.

### 1c. Live + edit — app running, the switch closed

```
  closed (switch is the pill)            open (switch reveals the affordance)
  ┌─────────────────────────┐            ┌─────────────────────────┐
  │                         │            │     (running app)       │
  │     (running app)       │   tap the  ├─────────────────────────┤
  │                         │   switch   │   ▸ Make it a drum kit   │ ← OptionButtons
  │                         │  ───────▶  │   ▸ Add a high score     │   (the chips)
  ├─────────────────────────┤            │   ▸ Other…              │
  │ ⌂   ◐ handle ▾   [VIBES]│            │  ✎ describe a change… ▸ │
  └─────────────────────────┘            └─────────────────────────┘
```

- **Opening the switch reveals the chips (the edit affordance).** This is the core move:
  the VibesSwitch's open state *is* §1a. Closed, it's the identity/share pill (one model,
  not four look-alike buttons with three behaviors, #1708). On start/homepage flows it
  starts **already open** (chips showing); on a live vibe it starts closed.
- **Editing IS the affordance:** owner/writer → chips + textarea change the app in place;
  **non-owner → the same chips/Other silently fork to their own copy** (#1856) — there is no
  "Remix" button, it's just what editing a vibe you don't own does (§2). Plus, for a visitor,
  the switch surfaces the one explicit CTA (Join *or* View). No "Edit" destination, no
  separate iterate flow — you just change the app.

### 1d. Implementation grounding — the build seam (existing code this reuses)

The design lands on code that already exists; the work is mostly *re-wiring*, not new
systems. Charlie/Codex and the explorers confirmed these seams:

| Need | Reuse / extend | Where |
| --- | --- | --- |
| The chips | **`OptionButtons`** — decoupled, Tailwind, already the chat suggestion chips | `pkg/app/components/OptionButtons.tsx` |
| Chip source | `▸`-prefixed lines parsed from the last AI message (`parseOptionLines`) | `pkg/app/utils/option-lines.ts` |
| The switch that opens to reveal them | **`ExpandedVibesPill`** owns the open/close phase machine (`idle→bubble→…→open`); **`VibesSwitch`** is the SVG toggle. Redefine "open" to render `OptionButtons`. | `base/components/ExpandedVibesPill.tsx`, `VibesSwitch.tsx` |
| The chat stream during generation | `PromptAndBlockMsgs` stream; first-code-block via `isCodeEnd` | `pkg/app/hooks/useChatSession.ts`, `call-ai/v2/block-stream.ts` |
| Real **and faked** chat in one model | `ChatSections` rows of `PromptAndBlockMsgs[]` (`block.toplevel.line` / `block.code.*`); pre-author curated history the same way | `api/sql/...schema-sqlite.ts`, `prompt-assembly.ts` |
| Today's homepage onramp (to replace) | carousel of full suggestions → `/chat/prompt?prompt64=` | `pkg/app/components/HomePage.tsx`, `data/quick-suggestions-data.ts` |

> **There is an earlier prototype of "switch-opens-to-chips" but it's unsatisfying** — treat
> it as a learning, not a base. The unification target is: chips = `OptionButtons` fed by
> `▸` lines, so the affordance and the chat are literally the same data in two surfaces.

### 1e. The switch menu & the visitor landing (structure decided, layout deferred)

The switch is a **top-level menu**, and the landing/access actions are a **peer of chat
inside it — not nested in the chat.** Decided structure (jchris):

- **The menu's top-level nav is invariant across owner vs visitor.** Same items, same
  places, whoever you are; only the *contents* of a given view differ by role (e.g. the
  "access" view shows Request-access / make-it-yours for a request-gated visitor, sharing
  controls for an owner). One nav to learn; it never rearranges under you.
- **The access view lives in this menu** (reachable by navigating the switch top-level),
  styled as part of the switch's look-and-feel — not as a separate landing card. The edit
  affordance (chips/Other) is another peer.
- **Active handle is a top-level item in the switch nav (#2275).** You join shared vibes
  **per handle**, so you must always be able to *see which handle you're browsing/acting as*
  and *switch it* — surfaced top-level, not buried. (Backend active-handle resolution already
  landed per #2275; this is the UI.)
- **Detailed layout of the menu and the access view is explicitly deferred** — "hard to
  specify without seeing the other parts first; design it later." Sketch the other states
  first, then design this against them.

Two visitor-landing visuals **are** decided now:

- **Restricted vibe, no access → blurred preview behind the gate.** Show the OG screenshot
  blurred behind the access view (reuse the `PreviewApp` de-blur), as a tease that sharpens
  if access is granted. (See §1d / `PreviewApp.tsx`.)
- **Public visitor entry → switch closed, with a subtle pulse.** Land in the working app
  (consume before identity); the switch stays closed but draws the eye with a gentle
  twinkle/pulse — the existing `isTwinkling` prop on `VibesSwitch` is exactly this seam. No
  auto-open, no covering the app.

## 2. Consistency spec (the verb + state model)

Align to the house voice (`notes/how-to-talk-about-vibes.md`): remix-first, "seeing
should imply changing," plain outcomes over engine talk. The current system has **4+
verbs for 2 outcomes**; collapse them.

> **"Remix" the culture stays; "Remix" the button goes.** The house voice is right that the
> medium *is* remixing — "start with someone else's vibe → change it → share it." That stays
> in marketing/copy. What we delete is the **in-product button** labeled Remix/Clone/Edit:
> in the product, you just *change the app*, and if it isn't yours that change forks. The act
> is still remixing; it simply has no button, because the affordance is the act.

### The verb model: one surviving access word

Almost everything is automatic. **View is automatic** (readable vibes just load). **Join is
automatic** (auto-join) *except* when the vibe is request-gated — there, the lone explicit
access CTA is **"Request access."** And **"make it yours"** has no verb: it's just what the
edit affordance does on a vibe you don't own.

> **Words (decided, jchris): "remix" = the act; "make it yours / your own" = the result.**
> You *remix* a vibe (change it — the cultural verb, stays); doing so on a vibe you don't own
> makes it *yours* (an independent copy). "Fork"/"clone" are retired as user words.

| What you can do | How it's surfaced | Replaces |
| --- | --- | --- |
| **Read / use** a readable vibe | **automatic** — public & read-only just load | "View" / "Open" buttons |
| Get into the **shared data** | **automatic** (auto-join) — *or* **"Request access"** when request-gated | "Join collab" button (only "Request access" survives) |
| **Change it** — own → in place; **don't own → it becomes yours** (a copy under your handle), then your edit applies | the edit affordance (chips + Other), §1a — **no verb, no button** | "Remix"/"Clone"/"Fresh Install"/"Edit"/"Fork" buttons |

- **The only surviving explicit access word is "Request access."** Join otherwise just
  happens (auto-join); View always just happens. (jchris)
- **On a request-gated vibe with no grant, the real choice is two things:** **Request access**
  (get into the original's *shared data*) vs **make it yours** (take the published app as your
  own — code only, no change required). Genuinely different outcomes — same data vs your space.
- **Making it yours keeps the slug.** Your copy lands at `/vibe/$yourHandle/$sameAppSlug` —
  the appSlug **does not change** unless you've already used that slug under your handle, in
  which case a fresh slug is assigned (collision only).
- **"Remix" is not a button; "make it yours" is not a verb (jchris).** The copy is implicit,
  surfaced by the #1856 inline "it's yours now — the original is unchanged" message. No
  Remix / Clone / Edit / Fresh-Install button anywhere. (#1709 #2162 #2262 #1855 #1856 #2037
  collapse into this.)

### Ownership, code vs data, and "make it yours" semantics (decided)

- **Ownership is account-level (jchris).** You own every app *any of your handles* created;
  switching your active handle never forks your own work. **Ownership = account; membership
  and identity-exposure = handle.** "Own → edit in place" means *your account* owns it.
- **The edit affordance changes CODE; only the owner changes code in place (jchris).**
  Everyone else — **including writer-members** — forks when they use the chips/Other. A
  write-grant member changes *data* simply by **using** the app (that's using, not editing);
  they cannot rewrite the shared code. So for every non-owner, the edit affordance makes a copy.
- **Making it yours takes code only, fresh/empty data (jchris).** If you wanted the shared
  data you'd Join. (Curated starters are the exception only in that their authored content
  ships *as* the starter.) Your copy lands at `/vibe/$yourActiveHandle/$sameAppSlug`, slug
  preserved unless you've used it (then suffixed).
- **Editing always makes a fresh copy; "open your own" is the explicit return path (jchris).**
  Re-engaging the affordance on a source you've already made yours produces a *new* copy by
  default — no silent routing to the old one. The system *knows* your existing copies and
  offers **"open your own"** as a distinct choice in the access view, but a chip/Other click
  defaults to a fresh copy. (Not idempotent: the menu remembers, the affordance doesn't.)
- **"Make it yours" / "open your own" are access-view choices, not floating buttons.**
  This does *not* reintroduce copy-buttons on the app: they're navigational items inside the
  switch's access view (the gate/menu context), distinct from the deleted Remix/Clone/Edit
  chrome. The running app stays button-free.

### Active-handle resolution & join consent (decided)

The UI over the backend `resolveActiveHandle` (#2275). You act *as a handle*; the rules for
which handle, and when you're asked, differ by app type:

- **"Join as [handle]" is skipped if you have only one handle.** Single-handle users auto-join
  with no consent step; the selector appears only when there's a real choice (>1 handle).
- **Public apps → act as your current session handle; switch at will, no confirm.** Your
  current handle is the acting identity on a public app; switching is free and instant.
- **Request-access apps → fall back to your last-used handle *in that app*.** If your current
  session handle has no relationship yet (no grant, no pending request) in this app, don't
  silently act as it — use the handle you last used in this app, so you don't start over /
  fan out a new identity by accident.
- **Switching on a request-access app is allowed, but issuing *another* access request asks
  for confirmation first** — so you don't accidentally fire duplicate requests from multiple
  handles.

### Identity exposure: reads are anonymous, writes are you (decided)

One clean rule for when your handle is exposed:

- **Reads have no app-effect — anonymous.** Viewing/reading a vibe attributes nothing to you
  (at most *anonymous* metrics). "Consume before identity" in force.
- **Writes are done as your current handle, and expose it (jchris).** Writing *data* to a
  public app (using its features to persist something) is attributed to your current handle
  and visible to others. **Implication: writing requires a current handle → login**; anonymous
  users can read/use but not write.
- **Comments are writes too — posted as your current handle (jchris).** The composer must make
  the **acting handle obvious**: place the submit button right next to the **active-handle tag**
  (the top-level handle indicator already in the switch nav, §1e), so "commenting as @handle"
  is unmistakable. (Ties #1742 comments, #1951 feedback.)
- **Net login-trigger set (resolves §8/17):** login is required to **write** — codegen
  (Other/uncached edit), Join, Request access, any data write, and commenting. Reading and
  browsing cached chips stay anonymous.

### One new setting: publish intent (#1854)

The creator picks what the vibe *is for*; this sets sensible **access defaults** and framing
— it does not add CTAs (there's only ever "Request access", and only when gated).

| Intent | Access default it sets | Visitor experience |
| --- | --- | --- |
| Shared space | auto-join on | **auto-joined**, with a "join as [handle]" consent step; or "Request access" if the creator turned auto-join off |
| Template | public | use it; the chips invite changes; editing **makes it yours** (no CTA) |
| Read-only / published | public, read-only | **view automatically**; editing makes it yours |

### Access-state → what the visitor sees (precedence)

There is now **at most one explicit CTA** (Join or View) plus the always-present edit
affordance (using it forks when you don't own). Access state gates which is shown; resolve
Almost every state is automatic; the only explicit access CTA is **Request access**, and the
always-available alternative is **make it yours** (your own copy → your handle). The canonical
lookup, by access state for a visitor with no personal grant:

| access state | explicit access CTA | what's automatic / the alternative |
| --- | --- | --- |
| `public-access` | — | app loads; **read/use automatically** (View is automatic) |
| auto-join (auto-approve on) | — | **auto-joined**, with a **"join as [handle]" consent** step |
| request-gated (`requests-on`) | **Request access** | or **make it yours** (your own copy) |
| `pending-request` | — (`Requested`, disabled) | or make it yours |
| `revoked-access` | — (`Revoked`, disabled) | or make it yours |
| private, `requests-off` (`not-grant`) | — (`App not available`) | make it yours * |

\* "make it yours" = the no-op copy to your handle (same appSlug unless taken), only when the
published app is reachable (you can't copy what you can't see). `member` / `submitter` resolve
in Member mode, outside this visitor resolver. The strict-enum JSON form (`accessState`,
`explicitCta`, `canMakeYours`) lands with PR-1 as the wiring source of truth.

> **Why "join as [handle]" matters:** joining exposes *a* handle of yours to the other
> members. Since you may have several, auto-join must let you **consent to which handle** is
> revealed before it commits you (jchris). This pairs with the always-visible active-handle
> switcher (§1e, #2275).

> The *visual* placement of the access view, the edit affordance, and the handle switcher in
> the switch menu is **deferred** (jchris: "hard to specify without seeing the other parts
> first") — see §1e. This table fixes the *logic*, not the layout.

### Grant → surface (collapsing the 12-state table)

The 12 grant values in `notes/vibes-sharing-reference.md` collapse, for UI purposes, to
**three viewer modes** with one indicator system (#2178, #2275):

| Mode | Who | Indicator | Pill shows |
| --- | --- | --- | --- |
| **Author** | owner / admin | (highlighted, e.g. shield) | agent-ready, Share, **active-handle switcher** |
| **Member** | writer/reader grant | read-only → lock glyph when no write | agent-ready (writer), active-handle switcher |
| **Visitor** | anon / no grant | none | **Request access** (only if request-gated) + the edit affordance (editing makes it yours); else just uses/views |

The **active-handle switcher is present in every mode** (you always act *as* a handle) and is
a top-level switch-nav item (§1e, #2275).

**`submitter`** (the latent fourth grant role — write-can-add, read-restricted, present in
the type system but unexposed in UI today per `notes/vibes-sharing-reference.md`) folds
into **Member** mode as a write-limited variant; it gets **no distinct viewer mode or
indicator** until/unless it's actually surfaced as a control. Calling it out explicitly so
the three-mode model is known to be a deliberate collapse, not an omission.

### Share panel: link-first (#2232 anchor)

Default Share = **URL + Copy** + the publish-intent toggle. Everything else
(permissions, members, requests, invites, comments policy) collapses behind a single
**"Manage access"** link. Kills: the compact-then-expand layout flash (#2236), the
ambiguous "Public Sharing: disabled / Enable" pill (#2235), the auto-open-new-tab on
publish (#2234 → copy URL + inline "View live" toast), the unexplained role dropdown
(#2233 → moves behind Manage access), and the duplicate auto-accept checkboxes (#1768 →
one shared component).

## 3. Deferred identity (the FTUE principle, #1693)

Not a separate build this week, but a **constraint on every state above**: never show a
control that only rejects the user; defer sign-up until after value. A logged-out visitor
can Join/Remix and is asked to sign in *only* at the moment it's needed, with intent
preserved (the existing `?intent=` routing already does this — keep it, surface it later).
Shared data gets a "sign in to see @sender's entries" prompt (#2353) instead of a silent
empty state.

> **The login boundary is the codegen request, not the page (jchris's rule).** **No login
> until a real code-generation request** — i.e. selecting "Other" (free text) or a chip
> whose result isn't cached. The two cached chips serve pre-generated content as plain page
> views, so anonymous users browse real working apps with **zero login and zero backend
> change**. This means we do **not** need anonymous *generation* — no anonymous-draft +
> claim-on-sign-in system. The existing codegen auth-gate (`routes.ts` auth layout +
> `isSignedIn` in `prompt.tsx`) is **correct and stays**; we just (a) serve cached starters
> as cached vibe page-views that don't hit it, and (b) make sure its trigger is the first
> real codegen (Other / uncached chip / first edit), with the pending prompt preserved
> through sign-in (the existing `?intent=`/prompt routing already carries this). **Net: less
> backend work than the earlier "anonymous draft" reading, not more** — and the whole §1a/§1b
> surface ships in PR-1 with no new backend. Shared data still gets a "sign in to see
> @sender's entries" prompt (#2353) at its own moment.

## 4. Week plan (human-in-the-loop gates)

Two PRs. PR-1 is design + the no-dependency deletions (ships this week regardless of
backend). PR-2 is the inversion wiring (gated on #2517). Each **GATE** is a hard stop
for your judgement before code.

| Day | Work | Output | Gate |
| --- | --- | --- | --- |
| **0–1** | Lofi sketches of the edit affordance (§1a), first-generation `/vibe` (§1b), live+edit (§1c), mobile-first. Flow outlines for: new app from homepage, visitor Join/View, non-owner-edit-forks, owner-edit. Finalize §2 verb spec + §7 subtraction ledger. (Switch menu / access view layout §1e is deferred.) | Sketch set + this doc's §1–2 ratified | **GATE 1: you approve the sketches & verbs before any code.** |
| **2** | **The first & biggest step: redefine the VibesSwitch so opening it reveals the chips** (`OptionButtons`), already-open on start flows (§1c/§1d). Then the first-generation stream→preview behavior (§1b). Behind a flag; cached chips anonymous, **login gates codegen by design** (§3) — no anonymous-draft backend needed. | Switch-reveals-chips + first-gen on `/vibe` | **GATE 2: does opening the switch → chips, and first-gen, feel right on a phone?** |
| **3** | Verb collapse: **Request-access only + "make it yours" implicit on edit**; delete the Remix/Clone/Fresh-Install/Edit buttons entirely; publish-intent setting (#1854). Mostly deletion. | PR-1 part 1 | — |
| **4** | Share panel link-first (#2232 + children). Indicator system for viewer modes (#2178/#2275). | PR-1 complete → review | **GATE 3: PR-1 review/QA.** |
| **5** | Inversion wiring: agent-in-vibe live+edit, hot-swap inline, `/chat` → `/vibe` redirects, lazy chat connection flip. | PR-2 (may carry over) | **GATE 4: full cutover review.** |

**Prerequisite (being handled separately):** full `/chat` deletion needs the lazy chat
connection from **Track B #2517** (SharedSessions DO). jchris is tackling #2517
independently as a pre-task — **treat it as done for planning purposes.** That means PR-2
can land the *full* inversion (not a flagged stub): once #2517 is in, the agent-in-vibe
wiring + `/chat` → `/vibe` redirects + connection-laziness flip all ship together. Keep a
flag only as a rollback seam, not as a dependency workaround.

## 5. PR structure

- **PR-1 "Vibe-first surface: verbs, landing, share" (no backend dep).** Edit affordance
  (§1a) + first-generation `/vibe` state (§1b), both flagged; cached chips anonymous, login
  gates codegen by design (§3 — no anonymous-draft backend); verb collapse, publish-intent,
  link-first share, viewer-mode indicators. This is where most of the *deletion* lands. Ships
  this week.
- **PR-2 "Agent-in-vibe / retire /chat" (#2517 handled as a pre-task).** Inline agent
  live+edit, hot-swap, route redirects, lazy chat connection flip — full cutover, with
  a flag kept only as a rollback seam.

Both human-driven on UI. Label `agent-created`; @-mention `@CharlieHelps`; `ready-to-merge`
when green.

## 6. Full issue disposition (nothing lost)

All **30** issues from the original backlog list are accounted for below, each in exactly
one bucket. (#2517 is **not** one of the 30 — it's the backend prerequisite, kept separate
so the count stays crisp.)

**Resolved by design (the inversion / verb model):**
- #2518 `/chat` deprecation → *is* PR-2 (#2517 handled as a pre-task).
- #1745 inline edit + hot-swap → the edit affordance + live+edit (§1a/§1c); there is no separate iterate flow.
- #1709 EDIT/CLONE/REMIX popup → **deleted** (no submenu; no copy-verbs; editing is the affordance).
- #2262 "vibe" button → "remix" → **moot** ("Remix" is no longer a verb; editing a non-owned vibe forks implicitly, §2).
- #1708 action-bar inconsistency → **deleted** (one switch, one model).
- #2162 Clone/Remix inconsistency across surfaces → **deleted** (no Clone, no Remix verb anywhere).
- #1855 data-mode CTA language → Join/View by intent; "make your own" is the implicit fork on edit, not a labeled CTA.
- #1854 publish intent → the one new setting.
- #1856 non-owner edit = your copy → the inline fork message; now *the* mechanism for "make your own" (§2).
- #2037 Join over Fresh Install → **resolved structurally**: there is no Fresh Install/Remix button to compete with Join; Join is the explicit CTA, forking is implicit-on-edit only.
- #1857 sharing-onramp epic → this doc *is* its resolution.
- #1973 two sharing modes legible → Join vs implicit-fork + intent (third "group-private" = Shared-space intent).
- #2178 read-only/admin indicator → viewer-mode indicator system (§2).
- #2275 active handle + switcher + login → **top-level active-handle switcher in the switch nav**, present in every mode; plus the "join as [handle]" consent step on auto-join (§1e/§2). You join per handle, so the active handle is always visible and switchable.

**Explicit build (Share cluster, PR-1):** #2238 (umbrella — "simplify the sharing UI"; this
cluster *is* its resolution) #2232 (anchor) #2233 #2234 #2235 #2236 #1768.

**Explicit build (FTUE / first-gen + edit affordance):** #1693 (principle, §3) #1896 (Starter Stack
→ *is* the edit affordance, §1a — the only door into edit mode, so it trains the iterate gesture)
#2353 (shared-data "sign in to see @sender's entries" prompt — design in §3, built here; single bucket).

**Validate after landing (small follow-ups):** #1747 (reader → request writer access — now an
agent-bar affordance) #1749 (authed non-owner flow — validate against new Live state)
#1766 (live auto-let-in on approval — keep, orthogonal) #1742 (unread-comments blue dot — keep,
orthogonal) #1951 (feedback link — keep, orthogonal) #1836 (VibesPanel position/first-run —
mostly mooted by the new pill; salvage the first-run onboarding copy into the homepage prompt-entry).

**Prerequisite, handled separately:** #2517 (backend Track B SharedSessions DO — jchris is
doing this as an independent pre-task; not part of these two PRs).

**Deferred to after this epic (new):**
- **Owner self-branch to a new appSlug.** In this model an owner's edits change the app in
  place; a non-owner's edits fork. An owner who wants to *deliberately* branch their own vibe
  to a new appSlug has no affordance yet — that's a wanted follow-up, but explicitly **after
  this epic** (jchris). File it when the epic lands so it isn't lost.

## 7. The subtraction ledger ("learnings")

What we delete, and the learning it encodes — so the knowledge survives the code removal:

| Deleted | Learning |
| --- | --- |
| `/chat` route + editor shell | The editor was never the product; the app is. The agent belongs inside the app. |
| Clone / Fresh Install / Fork verbs | "Copy without the editor" was an artifact of the editor existing. With the inline agent there's no copy-button: you *remix* it (the act) and it *becomes yours* (the result). |
| EDIT/CLONE/REMIX submenu (#1709) | Three verbs for one action taught users nothing; the affordance *is* the explanation. |
| Four-button action bar (#1708) | Look-alike buttons with different interaction models = the cost of bolting features onto a preview pane. |
| "Public Sharing: disabled / Enable" pill (#2235) | State-vs-action ambiguity comes from cramming config into the link surface. Link-first removes the question. |
| Compact-then-expand share panel (#2236) | The flash was the panel trying to be two things. Link-first is one thing. |
| Dual auto-accept checkboxes (#1768) | Two controls for one field = two surfaces drifting. One component. |
| Separate `/start` *system* (#1896) — its curated content feeds the **homepage** prompt-entry; the route itself becomes a **compat redirect**, not hard-removed | Onboarding isn't a special place; it's the homepage's edit affordance seeded with curated content, identical to editing any vibe. (Redirect avoids breaking the prototype/links.) |
| The anonymous-draft + claim-on-sign-in *backend system* we thought we'd need (never built) | Put the login wall on the codegen request, not the page: cached content is anonymous page-views, so anonymous *generation* never exists and there's nothing to claim. The cheapest feature is the one the boundary placement deletes. |

## 8. Open questions for GATE 1

**✅ 1. Edit-affordance shape — DECIDED (jchris).** **Two curated chips (up to three on
occasion) + "Other" (free text)**, rendered with the existing `OptionButtons` suggestion-chip
style for unity, surfaced by **opening the VibesSwitch** (already-open on start). Low-choice
trained gesture; "Other" is the open road. Same on the homepage and on any vibe.
Terminology: **"cached" == "curated"** in this doc; future caching of predicted next-clicks
may extend "cached" beyond curated, even to user-generated vibes.

**✅ 2. Login boundary — DECIDED (jchris).** **No login until a real codegen request** (Other
or an uncached chip). Cached chips are anonymous page-views. So there's **no anonymous
*generation*, hence no anonymous-draft / claim-on-sign-in system to build** (§3). The only
residual: preserve the pending prompt across the sign-in redirect (existing `?intent=`/prompt
routing handles it) — confirm it survives the Other/uncached path. "Uncached" = any click
whose result isn't pre-warmed; today, since cached==curated, that's effectively just "Other",
but future predicted-next-click caching could pre-warm some non-curated clicks too (so keep
the boundary defined by *cache-hit*, not by *is-it-a-curated-chip*).

3. **Slug + draft lifecycle (reduced by Q2).** Cached chips reuse existing cached-vibe URLs;
   a *new* slug is allocated only at the first real codegen — which is now **post-login** — so
   the eager-anonymous-slug + TTL worry largely dissolves. Remaining: confirm slug allocation
   timing for the post-login draft (at codegen start, so the URL is shareable immediately) and
   normal cleanup for drafts abandoned after login.
4. **Curated-vs-real perf contract.** The edit affordance has two lanes — curated/cached (must
   feel instant, click-as-page-view) and real generation (visibly different, has latency). Define
   the perf budget and the visible treatment that distinguishes them, so "instant" is a
   contract, not a hope (ref #1896's <500ms curated-swap target).
5. **Group-private intent.** Is jchris's "group-private / collaborative" (#1973) a fourth
   publish intent or just "Shared space" with a private visibility? Recommendation: the
   latter — publish intent is orthogonal to visibility (Restricted/Public) and to auto-join
   vs request-gated.

**✅ 6. Generation-overlay shape — DECIDED (jchris).** Inset rounded card; card shape never
changes, contents swap stream → live app, forming app de-blurs behind (§1b).

**✅ 7. Desktop — DECIDED (jchris).** Sketch/design **mobile only for now**; defer desktop.

**✅ 8. Per-vibe first-run onboarding — DECIDED (jchris).** **None** — rely on the start flow
already opening the switch; no per-vibe coach (#1836's onboarding idea dropped).

**✅ 9–12. Access/identity core logic — DECIDED (jchris):** ownership is account-level; only
the owner changes code in place (non-owners incl. writer-members make a copy); "make it yours"
= code only + fresh data; editing always makes a fresh copy with "open your own" as the
explicit return path (§2 "Ownership, code vs data, and 'make it yours' semantics").

### Parked semantic gaps (resolve before build, not blocking sketches)

13. **✅ Public-app handle exposure — DECIDED (jchris).** **Reads = anonymous** (no app-effect,
    maybe anon metrics). **Writes (incl. comments) = your current handle, exposed to others**;
    writing therefore requires login. See §2 "Identity exposure: reads are anonymous, writes
    are you."
14. **Request-access consent symmetry.** Requesting access exposes a handle to the owner (for
    approval). Should "Request access" carry the same **"request as [handle]"** consent as
    auto-join? Lean: yes, by symmetry — requesting and joining both expose identity.
15. **appSlug as lineage label.** Slug is a *per-handle* id we keep stable across a
    make-it-yours lineage for memorable/shareable URLs, but it's **not** a global lineage key
    (collisions suffix). True lineage stays tracked via `remixOf`. Confirm we're fine with
    slug-as-best-effort-label, lineage-as-`remixOf`-truth.
16. **Lineage attribution visibility.** `remixOf` records the source. Is that link public /
    shown to the source owner (who sees who made their own copy), or private? Lean: attribution
    visible (matches house "remix culture"), but the copier's *data* never is.
17. **✅ Full login-trigger set — DECIDED (jchris).** Login is required to **write**: codegen
    (Other/uncached edit), Join, Request access, any data write, and **commenting** (posted as
    your current handle). Anonymous stays: reads, viewing/using public apps read-only, and
    cached-chip browsing. (§2 "Identity exposure".)
**✅ 18. Name for the copy concept — DECIDED (jchris): "make it yours / your own."** "Fork"
and "clone" are retired as user words; **"remix"** stays as the cultural *act of changing* a
vibe; the *result* of changing one you don't own is that it **becomes yours** (an independent
code-only copy). Applied doc-wide.
