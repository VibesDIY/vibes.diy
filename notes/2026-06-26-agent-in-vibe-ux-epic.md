# UX Epic: The agent lives *in* the vibe

> **One-line thesis.** Today the editor is the container and the running app is a
> preview pane inside it. We invert that: **the vibe is the container, and the codegen
> agent is an affordance inside it.** One route (`/vibe`), one display primitive,
> parameterized by *who you are* × *what the creator intended* × *whether an app exists
> yet*. The `/chat` route, and a large amount of chrome and copy, **go away** — that
> deleted surface area is the deliverable, not a side effect.

Status: **in build** — first checkpoint in review (PR #2684 / child issue #2676). Owner: jchris.
Drafted 2026-06-26; updated 2026-06-27. This is a living plan — update it as the sketches resolve.

## 0. Delivery status (updated 2026-06-27)

Shipping as **incremental merges off `main`**, not the original two-PR plan (§4/§5, rewritten).
The work is broken into the child issues **#2676–#2682**; the first is in review as **PR #2684
(#2676)**.

**Done / in PR #2684:**

- **The unified card** — `UnifiedVibeCard` in `@vibes.diy/base`: the VibesSwitch opens into one
  rounded card — icon + title **and the handle/viewer tag at the top**, chips + "Other" in the
  middle, a **Home / Edit / Share** bottom nav, and the persistent VibesSwitch logo floating
  lower-right. Rendered on `/vibe` in place of `ExpandedVibesPill`. (#2676)
- **The simplified Share dialogue** — `SharePanelView`: the 3-class in-group model (anonymous →
  Copy URL; member → + roster on grant-gated vibes; author → + the Public/grant-required toggle),
  wired into the card's Share view with real member data. (partial #2680)
- **Edit hand-off (the merge checkpoint)** — chips + "Other" encode the typed change as a
  `?prompt64` query. **Owner → `/chat/$owner/$app`** (edit in place); **non-owner → `/remix`**
  (fork to your handle, auth-gated) → both **pre-fill the chat composer** (you tap send). This
  lets the card ship **without** removing `/chat` or building in-page live update yet.

**Deferred (each its own issue), in rough order:**

- **In-page live update / first-generation on `/vibe`** — the chips/Other still hop to `/chat`;
  the stream→preview swap and live hot-swap aren't built. (#2677, #1745)
- **Cached-read chip lane** — chips are placeholder strings that all route to codegen (a write).
  The two-lane model (cached chip = read → navigate to a pre-generated vibe; only Other/uncached =
  write) isn't built, and needs the system-owned cached-fork infra. (§1a, §20)
- **Handle picker** — the top-of-card tag shows the handle with a ▾, but the switcher dropdown
  isn't wired. (#2678, #2275)
- **Verb collapse** — delete the Remix/Clone/Fresh-Install/Edit chrome and the now-unused
  `ExpandedVibesPill`; persist the Public/grant-required setting (today the toggle just opens the
  legacy ShareModal); the #1856 "it's yours now" inline message. (#2679)
- **Share manage flow** — per-member role menu, the request-access screen, the
  `remixable-without-access` setting. (deferred half of #2680; §2 "Deferred")
- **Retire `/chat`** — deliberately kept by the checkpoint; gated on Track B **#2517**. (#2518)
- **Post-epic:** owner self-branch (#2681); propose-upstream + lineage data structures (#2682).

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
        - Any vibe: TRANSFORM this app ("Make it ___").
```

**The cached/uncached boundary is also the read/write (and login/fork) boundary** — this is
the line Charlie flagged, made explicit:

- **A cached chip is a *read*: navigate to pre-generated content.** No codegen, no write,
  **no login**, and **nothing is forked** — you're just moving to an already-existing cached
  result (a page view). Anonymous users can roam the cached tree freely.
- **"Other" / an uncached chip is a *write*: a real codegen request.** This needs **login**
  (it's a write, §"Identity exposure"), and **if the source vibe isn't yours, the generated
  result lands as your own copy** (makes it yours, #1856). So forking happens *only* on an
  uncached transform, never on a cached click.

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

### 1c. Live + edit — the unified card (the expanded switch contains everything)

**Decided (jchris; prototyped in Storybook `Sketches/Agent-in-Vibe`, screenshots in
`notes/sketches/agent-in-vibe/`):** the expanded vibe switch is **one rounded card** — not two
floating bubbles — that contains everything: **icon + title at the top, the content (chips /
stream / access view) in the middle, and the nav row at the bottom latitude.** Closed, it
collapses to just the toggle in the lower-right (a grow/shrink morph). Variable height; floats
above the app, which shows around its edges.

```
  closed (toggle lower-right)            open (the unified card)
  ┌─────────────────────────┐            ┌──────────────────────────────┐
  │                         │            │ ▣ Bloom Machine  (M)@meghan▾ │ ← icon+title + handle tag
  │     (running app)       │            │   bloom                      │
  │                         │   tap      ├──────────────────────────────┤
  │                         │  ───────▶  │ ▸ Make it a drum kit          │ ← OptionButtons
  │                         │            │ ▸ Add a high score            │   (the chips)
  ├─────────────────────────┤            │ ✎ describe a change…       ▸ │ ← "Other"
  │                  [VIBES]│            ├──────────────────────────────┤
  └─────────────────────────┘            │ ⌂   ✎   ↗           [VIBES]   │ ← nav: Home/Edit/Share;
                                         └──────────────────────────────┘   logo floats at right
```

- **Bottom nav (the open switch row), left → right:** **Home**, **Edit** (the edit affordance —
  pencil icon, *selected* by default), **Share** (sharing controls; comments TBD). The persistent
  VibesSwitch logo floats over the row's right end (the row reserves an invisible placeholder so
  it flows around it). **The handle picker moved to the top of the card** (header row), not the
  nav — the bottom row got tight once the persistent logo took its right end. Details in §1e.
  *(Built: Home/Edit/Share + the top handle tag. The handle switcher dropdown is #2678.)*
- **Editing IS the affordance:** owner (account) → chips/Other change the code in place; every
  non-owner — including writer-members — makes it theirs (a fresh copy, #1856). Writer-members
  change *data* by *using* the app; that's using, not editing. No "Remix" button.
- **For a visitor, the only explicit access CTA is "Request access"** (request-gated only);
  View and Join are automatic (§2). No "Edit" destination, no separate iterate flow.

### 1d. Implementation grounding — the build seam (existing code this reuses)

The design lands on code that already exists; the work is mostly *re-wiring*, not new
systems. Charlie/Codex and the explorers confirmed these seams:

| Need | Reuse / extend | Where |
| --- | --- | --- |
| The chips | **`OptionButtons`** — decoupled, Tailwind, already the chat suggestion chips. **Moved to `@vibes.diy/base`** so the chrome sketch and the chat render the *same* component (single source of truth). | `base/components/OptionButtons.tsx` (was `pkg/app/components/`) |
| Chip source | `▸`-prefixed lines parsed from the last AI message (`parseOptionLines`) | `pkg/app/utils/option-lines.ts` |
| The active-handle tag (handle picker leftmost in the nav) | **`ViewerTagView`** — presentational shell **extracted to `@vibes.diy/base`** from the runtime viewer tag: avatar (img/initial), click-the-avatar-to-edit camera affordance + hidden file input, anonymous→Sign-in, a `trailing` slot for the picker caret. All actions are **injected** — the runtime wires `onPickFile`/`onSignIn` to the iframe host bridge (`getRegisteredVibeApi`), the chrome wires them to platform APIs. | `base/components/ViewerTagView.tsx`; runtime wrapper `vibe/runtime/use-viewer-tag.tsx` |
| The switch that opens to reveal them | **`ExpandedVibesPill`** owns the open/close phase machine (`idle→bubble→…→open`); **`VibesSwitch`** is the SVG toggle. Redefine "open" to render the unified card (title + `OptionButtons` + nav). | `base/components/ExpandedVibesPill.tsx`, `VibesSwitch.tsx` |
| The chat stream during generation | `PromptAndBlockMsgs` stream; first-code-block via `isCodeEnd` | `pkg/app/hooks/useChatSession.ts`, `call-ai/v2/block-stream.ts` |
| Real **and faked** chat in one model | `ChatSections` rows of `PromptAndBlockMsgs[]` (`block.toplevel.line` / `block.code.*`); pre-author curated history the same way | `api/sql/...schema-sqlite.ts`, `prompt-assembly.ts` |
| Today's homepage onramp (to replace) | carousel of full suggestions → `/chat/prompt?prompt64=` | `pkg/app/components/HomePage.tsx`, `data/quick-suggestions-data.ts` |

> **There is an earlier prototype of "switch-opens-to-chips" but it's unsatisfying** — treat
> it as a learning, not a base. The unification target is: chips = `OptionButtons` fed by
> `▸` lines, so the affordance and the chat are literally the same data in two surfaces.

> **Shared-component consolidation already started (PR for this doc).** `OptionButtons` and
> `ViewerTagView` are now in `@vibes.diy/base` and rendered by the Storybook sketches *and*
> the runtime, so the sketches are built from real components, not throwaway mockups — the
> single-source-of-truth pattern the next PRs should keep extending. (Ledger §7.)

### 1e. The switch menu & the visitor landing (bottom-nav layout decided; access view deferred)

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

**Decided (jchris; prototyped in Storybook, screenshots in `notes/sketches/agent-in-vibe/`) — and
since built (#2676).** The nav sits at the bottom latitude of the unified card (§1c); the handle
picker sits at the **top**. **As built:**

```
  ▣ title              (M)@meghan ▾   ← header: icon+title + handle picker (TOP)
  ────────────────────────────────
       …chips / Other / share view…
  ────────────────────────────────
   ⌂        ✎          ↗     [VIBES]   ← bottom nav + persistent logo
  Home     Edit      Share    logo
         (selected            floats
          by default)         at right
```

- **Handle picker = top of the card (changed from "leftmost in the nav").** jchris originally
  put it at the leftmost bottom latitude, then moved it to the header: *"move the handle
  chooser/viewer tag to top of the open card"* — the bottom row got tight once the persistent
  logo claimed its right end. It **reuses `ViewerTagView`** (`@vibes.diy/base`, §1d): the handle's
  avatar + name as a pill, a `▾` caret in the `trailing` slot; anonymous → Sign-in. **Editing your
  photo = clicking the avatar** (not a menu row). *Built: the tag + caret render. The handle
  dropdown ("Acting as" → your handles → "New handle") is **#2678**, not yet wired.*
- **Home / Edit / Share** are circular colored nav icons echoing the production `ExpandedVibesPill`
  (Home blue, **Edit** orange — a **pencil**, not a chat bubble; Share green ↗). **Edit is the
  *selected* item by default** (the edit affordance is the home view); Share swaps the card's
  middle for the share view (§2). The **"Chat" label/💬 glyph is retired** — the affordance is
  "Edit." Comments placement TBD.
- **The VibesSwitch logo is persistent, not a contained toggle.** It always renders at a fixed
  size/position (lower-right), like production — it never remounts, resizes, or moves, and runs
  its own open/close morph via `isActive`. The card **grows/shrinks around it**; the bottom row
  reserves an invisible placeholder so it flows around the logo rather than under it.
- **Still deferred:** the layout of the **access view** itself (what fills the card's middle for a
  request-gated visitor / owner share controls). "Hard to specify without seeing the other parts
  first; design it later." The nav frame is settled; the access view's contents are not.

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
- **Visiting a source you've remixed lists *your* remixes of it (jchris).** That "menu
  remembers" capability generalizes: when you open a vibe you've made copies of, the access
  view surfaces **the list of your remixes of that source** (a reverse-lineage lookup over
  `remixOf`). This list is also where the future **"propose upstream"** action lives (below)
  — so the same query powers both "open your own" and "contribute back."
- **"Make it yours" / "open your own" are access-view choices, not floating buttons.**
  This does *not* reintroduce copy-buttons on the app: they're navigational items inside the
  switch's access view (the gate/menu context), distinct from the deleted Remix/Clone/Edit
  chrome. The running app stays button-free.
- **"Make it yours" is one operation with two entry points (Charlie's overload note).** It's
  the *same* server action (code-only copy → your handle) whether triggered (a) **implicitly**
  by editing a vibe you don't own — the copy carries your prompt — or (b) **explicitly** from
  the access view as a no-op — the copy carries no prompt. One operation; the only difference
  is whether a prompt rides along.

### Chips → appSlug vs fsId: decided at the write, by ownership

When a chip/Other produces a change, does it land as a **new appSlug** (a new app) or a **new
fsId in the same appSlug** (a new version, like additional prompting)? **Ownership decides, at
the moment of the write:**

- **Your own app → same appSlug, new fsId.** A chip on your app is additional prompting — it
  advances your app to a new version *in place* (the existing fsId-per-codegen model). *(jchris
  said "same fsId"; read as "same app, normal new-version" — codegen always mints a new fsId.
  Flag if literal fsId-pinning was meant.)*
- **An app you don't own → new appSlug.** The write makes it yours: a fresh app under your
  handle, `remixOf` → source (matches #4).
- **Reads commit nothing.** A *cached* chip is a read — navigate to pre-existing addressable
  content; no slug/fsId is created. The slug-vs-fsId question only arises at a *write*.

**Why this split = the data boundary (jchris's key insight).** **appSlug is the data
namespace; fsId is the code version within it.** So *same slug + new fsId* = new code with the
**data carried over**; *new slug* = **fresh/empty data**. That's precisely why an **owner edit**
stays same-slug (you want your data to carry, like additional prompting) and **make-it-yours** is
a new slug (code only, fresh data — #2). The slug-vs-fsId choice *is* the "carry the data or
not" choice — and the only reason to reuse a slug is to carry its data.

**The cached zone — resolved (jchris): pre-made forks under a system handle.** The apparent
fuzz dissolves once cached content has an *owner*. Curated starters and precached transforms
are **real, addressable apps owned by a platform/system handle** — the start tree is just a set
of system-owned public apps. That makes the slug-vs-fsId rule **fully uniform**:

- **Every app has an owner — user *or* system.** Editing your own advances its fsId; editing
  one you don't own (including a system-owned cached app) forks a new slug under your handle.
  "System" is simply another owner; the same rule covers everything.
- **An anonymous browser is just reading system-owned public apps** (cached chips = reads). The
  **first write forks to their handle**, with `remixOf` → the system fork it came from, whose
  own `remixOf` chains back to the ultimate source (lineage stays intact, #15).
- **Infra follow-ups:** a system/cache handle that owns these, and a dedupe key (content-address
  by `(source, transform)`). **No GC needed** — unkept pre-made forks are a negligible drop in
  the bucket vs everything else (jchris), so they just persist. See §8/20.

**Start-tree default (jchris, for now).** From the **top of the tree, a set of distinct system
appSlugs** (the roots — each its own data namespace); **browsing deeper via chips = new fsIds in
the same slug** (transforms that carry context/data forward as you descend). It'll likely end up
a blend of new-slug vs same-slug-new-fsId in places; this is the working assumption — *if
something different is needed, we code it at the time.* (Consistent with the data-boundary rule:
descending a starter carries its data; jumping to a different root starts fresh.)

### Active-handle resolution & join consent (decided)

The UI over the backend `resolveActiveHandle` (#2275). You act *as a handle*; the rules for
which handle, and when you're asked, differ by app type:

- **Logged-out users have no handle and only read (anonymous).** "Acting as a handle" applies
  to logged-in users; a logged-out visitor reads anonymously, and any *write* (codegen, Join,
  Request, data write, comment) first prompts login (§"Identity exposure"). No tension: reads
  are handle-less; the active handle only exists/matters once you're logged in and writing.
- **"Join as [handle]" / "Request as [handle]" consent — both, skipped if you have one
  handle (jchris, #14).** Joining *and* requesting access both expose a handle to the owner, so
  both let you choose which handle. With a single handle the step is skipped (no real choice).
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

### One new setting: publish intent (#1854) — superseded

> ~~A 3-preset publish-intent picker (Shared space / Template / Read-only) setting access +
> remixability defaults.~~ **Collapsed 2026-06-27 to a single Public vs grant-required access
> setting** — see "Share dialogue — the simplified in-group model" below for the reasoning. The
> remixability axis (`remixable-without-access`) is deferred to #2679.

### Access-state → what the visitor sees (precedence)

Almost every state is automatic; the only explicit access CTA is **Request access**, and the
where-reachable alternative is **make it yours**. The canonical lookup, by access state for a
visitor with no personal grant:

| access state | explicit access CTA | what's automatic / the alternative |
| --- | --- | --- |
| `public-access` | — | app loads; **read/use automatically** (View is automatic) |
| auto-join (auto-approve on) | — | **auto-joined**, with a **"join as [handle]" consent** step |
| request-gated (`requests-on`) | **Request access** | **+ make it yours** if remixable-without-access |
| `pending-request` | — (`Requested`, disabled) | + make it yours if remixable-without-access |
| `revoked-access` | — (`Revoked`, disabled) | + make it yours if remixable-without-access |
| private, `requests-off` (`not-grant`) | — (`App not available`) | only if **remixable-without-access** is on (below) |

**Canonical "make it yours" rule (decided, jchris — supersedes the old reachability-only
rule):** you can make a vibe yours if **either**

1. **you have access** to it (you can load/see it — public or granted), **or**
2. the **owner has marked the app "remixable without access"** — a per-app setting, *separate
   from access*, that exposes the code shell for copying even to people who can't join/see the
   data.

So make-it-yours availability is its **own axis (remixability), orthogonal to access**.
Access gates joining + shared data; remixability gates copying the code. A fully private app
with remixability off is the only "no make-it-yours" case.

> **Remix-seed apps (note, presentation deferred — jchris).** For some creators the *main*
> flow is making apps meant as **remix seeds** — templates to be made-yours, not spaces to
> join. Those apps lead with "remixable without access" on. **Discuss later how we present a
> remix-seed app differently from a request-access app** (a seed says "make this yours"; a
> gated app says "request access") — likely tied to publish intent (#1854), where Template
> intent ⇒ remixability-on by default. Backend must serve the code shell for remixing
> independent of the data grant.

**Second dimension the strict enum needs (exhaustiveness fix):** whether you **already have
your own copy** of this lineage — if so, the access view also offers **"open your own"** (a
chip/Other still defaults to a *fresh* copy, §2 ownership). So the wiring enum is
`{ accessState, hasExistingCopy, remixableWithoutAccess } → { explicitCta, canMakeYours,
offerOpenYourOwn }`, and it lands with the verb-collapse work (#2679) as the source of truth. `member` / `submitter` resolve in Member mode, outside
this visitor resolver.

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

> ~~Everything-behind-one-"Manage access"-link framing.~~ **Refined 2026-06-27** — the
> "Manage access" drawer is superseded by the 3-class in-group model below. **What stays true:**
> Share leads with **URL + Copy**, and link-first still kills the compact-then-expand flash
> (#2236), the "Public Sharing: disabled / Enable" pill (#2235), the auto-open-new-tab on publish
> (#2234 → copy URL + inline "View live"), the unexplained role dropdown (#2233), and the
> duplicate auto-accept checkboxes (#1768).

### Share dialogue — the simplified in-group model (decided 2026-06-27, jchris)

**This supersedes the 3-preset publish-intent picker above and trims the link-first
default.** The whole share dialogue is scoped to **people who can already see the vibe**, and
collapses to **three classes** whose contents stack additively (consistent with the §1e
invariant-nav principle and the three viewer modes above):

| Class | The share dialogue shows |
| --- | --- |
| **Anonymous visitor** | **Copy URL** (+ View live). Reads only — see why below. |
| **Granted member** | Copy URL **+ the member roster** ("who you're in there with"). |
| **Author** | Copy URL + roster **+ the access setting** (Public vs grant-required). |

**Why publish intent collapses to one Public/grant-required setting.** The 3 intents
(Shared space / Template / Read-only) were presets over orthogonal axes, but two facts
dissolve them:

1. **Editing a vibe you don't own *always* forks** (§2 ownership), so "Read-only" and
   "Template" differ only in *emphasis* — not a mode. Both are just "view it; changing it
   makes your own copy."
2. **Anonymous = read-only; every write is you** (§2 "Identity exposure", §3). A stranger
   cannot write your shared data — the moment they try (data write, join, comment, codegen,
   even "make it yours"), they hit login and it's attributed to their handle. So a public
   vibe is never anonymous spam, just accountable contribution. **The login wall already does
   the gating publish-intent was reaching for**, which kills the "read-only vs shared / personal
   vs shared" owner mode — it has nothing left to protect.

What's left for the author to actually decide is **who can READ it** (the only thing
anonymity touches): **Public** (anyone with the link) vs **grant-required**. Everything else
is emergent — View is automatic; **make it yours (fork)** is always available to anyone who
can see it; collaboration happens for people the author lets in (→ the roster).

**Deferred — two distinct items, and only these:**

1. **The `remixable-without-access` setting** — the author toggle that says "you can't
   *see/access* this vibe, but yes you can *remix* the code" (the gated remix-seed). It's an
   advanced, orthogonal knob; build it later. (The "make it yours" rule + remixability axis
   above stay true; we just don't surface the setting yet.)
2. **The request-access *screen*** — the landing a *not-yet-granted* user hits on a
   grant-required vibe. This is a fourth class (someone who *can't* see the vibe yet), outside
   the three-class dialogue.

> **Not deferred: the member roster.** A grant-required vibe has two halves — the
> *already-granted* member (sees the roster → **in scope**) and the *not-yet-granted* visitor
> (request screen → deferred). Only the second half defers. The roster (and "browse members /
> member roster" — naming TBD) is a first-class part of the dialogue.

The roster appears for granted **members** only on a non-auto-grant (grant-required) vibe — a
public ("anyone with the link") vibe has open membership, so there's no curated list to browse,
and the access copy is shown *without* a roster. **The owner is the exception (decided
2026-06-27): they always see the roster, even on a public vibe**, so they can see who's been
granted. Inside the roster, contents differ by role: a member sees a read-only list; the author
additionally manages it (per-member roles via tapping a tag — the deferred manage flow).

## 3. Deferred identity (the FTUE principle, #1693)

Not a separate build this week, but a **constraint on every state above**: never show a
control that only rejects the user; defer sign-up until after value. A logged-out visitor
can Join/Remix and is asked to sign in *only* at the moment it's needed, with intent
preserved (the existing `?intent=` routing already does this — keep it, surface it later).
Shared data gets a "sign in to see @sender's entries" prompt (#2353) instead of a silent
empty state.

> **Login is on the first *write*, not the page (jchris's rule).** Codegen is *one* write,
> not the only one: login is required for **any write** — codegen (Other/uncached edit), Join,
> Request access, a data write, or a comment (§"Identity exposure"). What stays anonymous is
> **reading**: viewing/using public apps read-only, and browsing the cached-chip tree (cached
> chips serve pre-generated content as plain page views — no codegen, no write). So anonymous
> users roam real working apps with **zero login and zero backend change**, and the login wall
> falls on the first write they attempt. This means we do **not** need anonymous *generation* —
> no anonymous-draft +
> claim-on-sign-in system. The existing codegen auth-gate (`routes.ts` auth layout +
> `isSignedIn` in `prompt.tsx`) is **correct and stays**; we just (a) serve cached starters
> as cached vibe page-views that don't hit it, and (b) make sure its trigger is the first
> real codegen (Other / uncached chip / first edit), with the pending prompt preserved
> through sign-in (the existing `?intent=`/prompt routing already carries this). **Net: less
> backend work than the earlier "anonymous draft" reading, not more** — and the whole §1a/§1b
> surface ships across the card (#2676) and first-gen (#2677) with no new backend. Shared data
> still gets a "sign in to see @sender's entries" prompt (#2353) at its own moment.

## 4. Delivery model (incremental merges off `main`)

> **Supersedes the original two-PR week plan (PR-1 deletions / PR-2 inversion).** Rather than one
> big split gated on backend work, the epic ships as a **sequence of small, independently
> mergeable PRs** off `main`, broken into the child issues #2676–#2682. The first (PR #2684 /
> #2676) is in review — current snapshot in §0.

Two principles carry over from the original plan:

- **Human gate before behavior-changing code.** Sketches, verbs, and prompt/behavior changes get
  jchris's eyes before implementation; the single-source-of-truth Storybook loop (real
  `@vibes.diy/base` components, not mockups) keeps each surface reviewable as it lands.
- **`/chat` deletion stays gated on Track B #2517** (lazy SharedSessions connection; jchris,
  separate). Until it lands, the agent-in-vibe surface **coexists** with `/chat` rather than
  replacing it — the prompt64 edit hand-off (§0) is the seam that lets the card ship in the
  meantime, no flag and no backend change.

## 5. Merge sequence

Each is its own small PR; the order is rough, not rigid. Status mirrors §0.

1. **#2676 — unified card + simplified share + prompt64 hand-off.** *(PR #2684, in review.)*
   `UnifiedVibeCard` on `/vibe`, `SharePanelView`, owner→`/chat` / non-owner→`/remix` pre-fill.
   No backend dep. *(partial #2680 rides along.)*
2. **#2677 — first-generation on `/vibe`** (in-page stream→preview, de-blur, hot-swap; #1745).
   The chips/Other stop hopping to `/chat` and change the app in place. The **cached-read chip
   lane** (§1a/§20) lands here or alongside it.
3. **#2678 — handle picker** (wire the top-of-card tag's switcher dropdown; #2275).
4. **#2679 — verb collapse** (delete the Remix/Clone/Fresh-Install/Edit chrome + the unused
   `ExpandedVibesPill`; persist the Public/grant-required setting; the #1856 "it's yours now"
   message; viewer-mode indicators #2178).
5. **#2680 — Share manage flow** (per-member roles, request-access screen,
   `remixable-without-access`).
6. **#2518 — retire `/chat`** (redirects → `/vibe`, lazy connection flip). **Gated on #2517.**

Post-epic: **#2681** (owner self-branch to a new appSlug), **#2682** (propose-upstream + reserve
lineage data structures).

Each PR: label `agent-created`; @-mention `@CharlieHelps`; `ready-to-merge` when green.

## 6. Full issue disposition (nothing lost)

All **30** issues from the original backlog list are accounted for below, each in exactly
one bucket. (#2517 is **not** one of the 30 — it's the backend prerequisite, kept separate
so the count stays crisp.)

**Resolved by design (the inversion / verb model):**
- #2518 `/chat` deprecation → the final merge in the sequence (§5), gated on #2517.
- #1745 inline edit + hot-swap → the edit affordance + live+edit (§1a/§1c); there is no separate iterate flow.
- #1709 EDIT/CLONE/REMIX popup → **deleted** (no submenu; no copy-verbs; editing is the affordance).
- #2262 "vibe" button → "remix" → **moot** ("Remix" is no longer a verb; editing a non-owned vibe forks implicitly, §2).
- #1708 action-bar inconsistency → **deleted** (one switch, one model).
- #2162 Clone/Remix inconsistency across surfaces → **deleted** (no Clone, no Remix verb anywhere).
- #1855 data-mode CTA language → automatic View/Join (+ "Request access" only when gated); "make it yours" is the implicit result of editing, not a labeled CTA.
- #1854 publish intent → the one new setting.
- #1856 non-owner edit = your copy → the inline fork message; now *the* mechanism for "make your own" (§2).
- #2037 Join over Fresh Install → **resolved structurally**: there's no Fresh Install/Remix button to compete with joining; Join happens automatically (auto-join, or "Request access" when gated) and "make it yours" is implicit-on-edit only — so nothing pulls visitors toward an empty fork.
- #1857 sharing-onramp epic → this doc *is* its resolution.
- #1973 two sharing modes legible → Join vs implicit-fork + intent (third "group-private" = Shared-space intent).
- #2178 read-only/admin indicator → viewer-mode indicator system (§2).
- #2275 active handle + switcher + login → **top-level active-handle switcher in the switch nav**, present in every mode; plus the "join as [handle]" consent step on auto-join (§1e/§2). You join per handle, so the active handle is always visible and switchable.

**Explicit build (Share cluster, #2680):** #2238 (umbrella — "simplify the sharing UI"; this
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
- **Propose changes upstream (the contribution path) (jchris).** After you make a vibe yours
  and improve it independently, you may want to **propose those changes back to the source
  appSlug** you got it from — so independent improvements can rejoin the group (this is the
  other half of remixing, and the answer to the #1973 fragmentation risk). **The affordance
  is deferred** (a "propose upstream" / "publish upstream" control on your remix, reviewed by
  the source owner who accepts or declines). **But the DATA STRUCTURES must be reserved now,
  while the model is on the workbench**, so we don't preclude it:
  - **Reverse-lineage query** — "list my remixes where `remixOf` = sourceX" (so visiting a
    source surfaces your copies of it; §2). Needs `remixOf` indexed by `(remixOf, owner)`.
  - **A proposal entity** — a PR-like record: `{ fromAppSlug (your remix), toAppSlug (source),
    proposed fsId/diff, author handle, status: open|accepted|declined }`, reviewable by the
    source owner. Reserve room for this when the lineage/sharing schema is built.

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
| Duplicate viewer-tag / suggestion-chip implementations across runtime, chrome, and sketches | Presentational shells (`ViewerTagView`, `OptionButtons`) belong in `@vibes.diy/base` with their host-bridge actions **injected** at the edge. One component renders in the runtime *and* the platform chrome *and* the Storybook sketches — so sketches stay honest (real components) and the chip/handle UI can't drift between surfaces. |

## 8. Open questions for GATE 1

**✅ 1. Edit-affordance shape — DECIDED (jchris).** **Two curated chips (up to three on
occasion) + "Other" (free text)**, rendered with the existing `OptionButtons` suggestion-chip
style for unity, surfaced by **opening the VibesSwitch** (already-open on start). Low-choice
trained gesture; "Other" is the open road. Same on the homepage and on any vibe.
Terminology: **"cached" == "curated"** in this doc; future caching of predicted next-clicks
may extend "cached" beyond curated, even to user-generated vibes.

**✅ 2. Login boundary — DECIDED (jchris).** **Login on the first *write*** (codegen is one
write — Other/uncached edit — alongside Join, Request, data write, comment; see #17). Reading
and cached-chip browsing stay anonymous. So there's **no anonymous *generation*, hence no
anonymous-draft / claim-on-sign-in system to build** (§3). The only
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
14. **✅ Request-access consent symmetry — DECIDED (jchris): yes.** "Request access" carries the
    same **"request as [handle]"** consent as auto-join (skipped when you have one handle). Both
    expose identity, so both let you choose which handle. (§2 active-handle resolution.)
15. **appSlug as lineage label.** **Invariant (per Charlie): lineage truth is `remixOf`;
    appSlug is only a best-effort *label*.** Slug is a *per-handle* id we keep stable across a
    make-it-yours lineage for memorable/shareable URLs, but it's **not** a lineage key
    (collisions suffix, so it can't be relied on). Anything that needs true ancestry reads
    `remixOf`, never the slug. (Confirm we're fine with this split.)
16. **✅ Lineage attribution visibility — DECIDED (jchris): visible.** The `remixOf` link is
    **public / shown** (the source owner can see who made their own copy) — it matches house
    "remix culture" and feeds the future propose-upstream path. The copier's *data* is never
    exposed, only the lineage edge.
17. **✅ Full login-trigger set — DECIDED (jchris).** Login is required to **write**: codegen
    (Other/uncached edit), Join, Request access, any data write, and **commenting** (posted as
    your current handle). Anonymous stays: reads, viewing/using public apps read-only, and
    cached-chip browsing. (§2 "Identity exposure".)
**✅ 18. Name for the copy concept — DECIDED (jchris): "make it yours / your own."** "Fork"
and "clone" are retired as user words; **"remix"** stays as the cultural *act of changing* a
vibe; the *result* of changing one you don't own is that it **becomes yours** (an independent
code-only copy). Applied doc-wide.

19. **✅ Make-it-yours rule — DECIDED (jchris): access OR remixable-without-access.** You can
    make a vibe yours if you have access to it **or** the owner marked it **remixable-without-
    access** (a per-app setting, its own axis separate from access — §2). Some creators make
    apps as **remix seeds** where this is the main flow; **how we present a remix-seed app vs a
    request-access app is deferred to the design phase** (§2 note). *Backend requirement (not
    just an assumption): serve a remixable app's code shell for copying independent of the data
    grant.*

20. **✅ Chips → appSlug vs fsId — DECIDED (jchris).** **appSlug = data namespace; fsId = code
    version.** Same slug + new fsId = new code, data carried; new slug = fresh data. Ownership
    decides at the write: own app → same slug + new fsId; don't-own → new slug (make it yours,
    fresh data); reads commit nothing. **Cached content = pre-made forks under a system handle**
    (curated starters + precached transforms are system-owned public apps), so the rule is
    fully uniform (system is just another owner). **Start-tree default:** top = distinct system
    appSlugs; deeper = new fsIds in the same slug. Infra follow-ups: system/cache handle +
    content-address dedupe. **No GC** — unkept forks are negligible, they just persist. (§2
    "Chips → appSlug vs fsId".)
