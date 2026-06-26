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
  sheet, never a side-by-side desktop editor. Desktop = mobile with breathing room.
- **The codegen agent lives *in* the vibe.** First-generation streaming and every later
  edit happen on `/vibe` through the one affordance. No `/chat`, no second URL, no context
  switch.

### 1a. The edit affordance — the one reusable primitive (design this first)

```
 ┌─────────────────────────┐   chips + textarea. The ONLY door into edit mode.
 │   ▸ Make it a drum kit   │   - On the homepage / a starter: chips CREATE a new
 │   ▸ Add a high score     │     app from nothing ("Make a ___").
 │   ▸ Make it dark         │   - On any vibe: chips TRANSFORM this app ("Make it
 │                         │     ___"); a non-owner's first transform forks to
 ├─────────────────────────┤     their own copy (#1856), inline & non-blocking.
 │  ✎ change this app…    ▸ │   - Chip count is elastic: a few, one, or none —
 └─────────────────────────┘     mostly it's the textarea. Curated chips are the
                                  trained on-ramp; the textarea is the open road.
```

Same component, different seed. This absorbs the Instant Starter Stack (#1896), the inline
edit/hot-swap (#1745), and what used to be a distinct "iterate" UI — into **one** thing.

### 1b. First-generation state on `/vibe` (the new state, sketch alongside 1a)

This is the novel piece. You submitted a prompt on the homepage; now you're on `/vibe` and
**the code is being built.** It must **not** look like today's chat editor.

```
 ┌─────────────────────────┐   Mobile, full-bleed.
 │                         │   - The canvas is where the app is being born; code
 │     (app blooming —     │     streams INTO it, not into a code pane with a
 │   code streaming in)    │     preview tab.
 │                         │   - A slim progress affordance (not a chat log);
 │   building your app…    │     collapses into the Live edit affordance (1a)
 │                         │     when the first runnable build lands.
 ├─────────────────────────┤   - Hot-swap overlay kept: subsequent builds swap in
 │  ◐ building…            │     place (the existing mechanism).
 └─────────────────────────┘
```

### 1c. Live + edit — app running, affordance present

```
 ┌─────────────────────────┐   - App fills the screen.
 │                         │   - One pill carries identity + share, parameterized
 │     (running app)       │     by grant (§2) — NOT four look-alike buttons with
 │                         │     three interaction models (#1708).
 │                         │   - Editing IS the affordance (1a): owner/writer →
 │                         │     chips+textarea change the app in place; reader/anon
 ├─────────────────────────┤     → the pill shows the intent CTA (Join/Remix/View).
 │ ⌂   ◐ handle ▾    ✎ edit │   - There is no "Edit" destination and no separate
 └─────────────────────────┘     iterate flow — you just change the app.
```

## 2. Consistency spec (the verb + state model)

Align to the house voice (`notes/how-to-talk-about-vibes.md`): remix-first, "seeing
should imply changing," plain outcomes over engine talk. The current system has **4+
verbs for 2 outcomes**; collapse them.

### Two outcomes → three canonical CTAs

The fundamental fork is binary — **your own copy** vs **the shared thing**. Within "the
shared thing," creator intent splits participate-vs-read-only. So there are exactly **three
canonical in-product CTA words**, one per outcome, and nothing else. Public-with-no-
membership is *not* a fourth word — the app just loads (no gate, no CTA), so "Open" is
deleted as a verb.

| Outcome | Canonical CTA (the only word) | Replaces | Who |
| --- | --- | --- | --- |
| Participate in the **shared space** (same dataset, become a member) | **Join** | "Join collab", "Request access" | collab-intent / invited |
| **Read** the shared thing (no membership) | **View** | "Open" (as a verb) | read-only-intent |
| Make **your own** independent copy and change it | **Remix** | "Clone", "Fresh Install", "Edit"(non-owner), "Fork" | everyone |

- **Remix is the one primary verb for "make/change."** Owner talking to their own app,
  a stranger forking a template, a friend tweaking a shared game — all "remix." The
  copy-vs-no-copy distinction (`skipChat`) **disappears** because chat is inline: remix
  drops you into the same `/vibe` canvas with the agent ready, on your own copy.
- **"Clone" is deleted.** It was only "remix without the editor"; with the agent inline
  there is no editor to skip. (#1709 #2162 #2262 #1855 #2037)
- **"Edit" as a button is deleted.** The owner doesn't navigate to edit — the agent is
  already there. (#1709 #1856)
- **"Fresh Install" is deleted.** It was Clone with scarier words. (#1855 #2037)

### One new setting: publish intent (#1854)

The creator picks what the vibe *is for*; this drives which CTA is primary on a
non-member's landing — it does **not** change access enforcement.

| Intent | Primary CTA | Secondary (always available) |
| --- | --- | --- |
| Shared space | **Join** | Remix |
| Template | **Remix** | Join (if collab allowed) |
| Read-only / published | **View** | Remix |

### CTA precedence (access-state wins over intent)

Intent only chooses the primary CTA *among actions the access state actually permits*.
Resolve in this fixed order so the CTA is always predictable:
`revoked` → `pending` → `private/no-requests` → `private/requests-on` →
`public-or-granted (intent-driven)`. The canonical lookup (the GATE-1 → implementation
handoff matrix, via @CharlieHelps):

| intent | grant / access-state | request-setting | primary CTA | secondary CTA |
| --- | --- | --- | --- | --- |
| `*` | `revoked-access` | `*` | — (`Access revoked`) | `Remix` |
| `*` | `pending-request` | `*` | — (`Requested`) | `Remix` |
| `*` | `not-grant + private` | `requests-off` | — (`App not available`) | `Remix` * |
| `*` | `not-grant + private` | `requests-on` | `Join` (request-to-join) | `Remix` |
| `shared-space` | `public-or-granted` | `*` | `Join` | `Remix` |
| `template` | `public-or-granted` | `*` | `Remix` | `Join` † |
| `read-only-published` | `public-or-granted` | `*` | `View` | `Remix` |

\* only when the source is reachable for remix. † only when collaboration is allowed.
`public + no-membership` loads directly and bypasses the gate UI (no gate CTA). `member` /
`submitter` are resolved in Member mode, outside this visitor CTA resolver.

`Remix` is the one action available in nearly every state (it forks; it doesn't depend on
the source's grant), which is why it's the universal fallback / secondary. The strict-enum
JSON form of this table (`intent`, `grantState`, `requestSetting`, `primaryCta`,
`secondaryCta`) lands with PR-1 as the wiring source of truth.

### Grant → surface (collapsing the 12-state table)

The 12 grant values in `notes/vibes-sharing-reference.md` collapse, for UI purposes, to
**three viewer modes** with one indicator system (#2178, #2275):

| Mode | Who | Indicator | Pill shows |
| --- | --- | --- | --- |
| **Author** | owner / admin | (highlighted, e.g. shield) | agent-ready, Share, handle switcher |
| **Member** | writer/reader grant | read-only → lock glyph when no write | agent-ready (writer) or Join-to-edit |
| **Visitor** | anon / no grant | none | intent-driven CTA (Join/Remix/View) |

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

> **⚠️ Anonymous first-app creation is NOT free — it has a backend dependency.** The
> current path from homepage prompt to first generation is auth-gated: `routes.ts` puts
> `chat/prompt` under the auth layout, and `prompt.tsx` only calls `chatApi.openChat()`
> once `isSignedIn` is true. So "make the first app with no login" requires **new
> anonymous-draft + claim-on-sign-in work** (server allocates a throwaway-owner draft; the
> slug is claimed on auth). That is a dependency, not a given. **Split the work
> accordingly:** the new mobile-first homepage prompt-entry + edit affordance (§1a) and the
> first-generation `/vibe` *UI* (§1b: canvas, app-blooms-in-place) have no backend
> dependency and ship in PR-1 **still auth-gated**; the *anonymous* path is a separate,
> explicitly-flagged dependency (GATE 1, §8 Q2/Q3) — do not assume it for every state.

## 4. Week plan (human-in-the-loop gates)

Two PRs. PR-1 is design + the no-dependency deletions (ships this week regardless of
backend). PR-2 is the inversion wiring (gated on #2517). Each **GATE** is a hard stop
for your judgement before code.

| Day | Work | Output | Gate |
| --- | --- | --- | --- |
| **0–1** | Lofi sketches of the edit affordance (§1a), first-generation `/vibe` (§1b), live+edit (§1c), mobile-first. Flow outlines for: new app from homepage, visitor-Join, visitor-Remix, owner-edit. Finalize §2 verb spec + §7 subtraction ledger. | Sketch set + this doc's §1–2 ratified | **GATE 1: you approve the sketches & verbs before any code.** |
| **2** | Spike the edit affordance (§1a) + first-generation `/vibe` state (§1b), mobile-first, app-blooms-in-canvas. Behind a flag, **auth-gated** (anonymous path is a separate dependency, §3). | Clickable affordance + first-gen on `/vibe` | **GATE 2: does the affordance + first-gen feel right on a phone?** |
| **3** | Verb collapse + landing card: Remix/Join/View by intent; delete Clone/Fresh-Install/Edit-button; publish-intent setting (#1854). Mostly deletion. | PR-1 part 1 | — |
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
  (§1a) + first-generation `/vibe` state (§1b), both flagged and **auth-gated** (anonymous
  generation deferred to its own dependency, §3); verb collapse, publish-intent, link-first
  share, viewer-mode indicators. This is where most of the *deletion* lands. Ships this week.
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
- #1709 EDIT/CLONE/REMIX popup → **deleted** (no submenu; agent is inline).
- #2262 "vibe" button → "remix" → subsumed; the agent affordance is the remix entry.
- #1708 action-bar inconsistency → **deleted** (one pill, one model).
- #2162 Clone/Remix inconsistency across surfaces → **deleted** (Clone is gone; Remix everywhere).
- #1855 data-mode CTA language → Join/Remix/View by intent.
- #1854 publish intent → the one new setting.
- #1856 non-owner edit = your copy → inline fork message in the edit affordance (§1a).
- #2037 Join over Fresh Install → Fresh Install deleted; Join primary by intent.
- #1857 sharing-onramp epic → this doc *is* its resolution.
- #1973 two sharing modes legible → Join vs Remix + intent (third "group-private" = Shared-space intent).
- #2178 read-only/admin indicator → viewer-mode indicator system (§2).
- #2275 active handle + switcher + login → handle switcher in the pill (Author/Visitor modes).

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

## 7. The subtraction ledger ("learnings")

What we delete, and the learning it encodes — so the knowledge survives the code removal:

| Deleted | Learning |
| --- | --- |
| `/chat` route + editor shell | The editor was never the product; the app is. The agent belongs inside the app. |
| Clone / Fresh Install verbs | "Copy without the editor" was an artifact of the editor existing. With inline agent, there's only Remix. |
| EDIT/CLONE/REMIX submenu (#1709) | Three verbs for one action taught users nothing; the affordance *is* the explanation. |
| Four-button action bar (#1708) | Look-alike buttons with different interaction models = the cost of bolting features onto a preview pane. |
| "Public Sharing: disabled / Enable" pill (#2235) | State-vs-action ambiguity comes from cramming config into the link surface. Link-first removes the question. |
| Compact-then-expand share panel (#2236) | The flash was the panel trying to be two things. Link-first is one thing. |
| Dual auto-accept checkboxes (#1768) | Two controls for one field = two surfaces drifting. One component. |
| Separate `/start` *system* (#1896) — its curated content feeds the **homepage** prompt-entry; the route itself becomes a **compat redirect**, not hard-removed | Onboarding isn't a special place; it's the homepage's edit affordance seeded with curated content, identical to editing any vibe. (Redirect avoids breaking the prototype/links.) |

## 8. Open questions for GATE 1

1. **Edit-affordance chip count.** Does the affordance (homepage *and* on-vibe) lead with
   curated chips (instant cached) or mostly the bare textarea, and how many chips? Recommendation:
   elastic — a few curated chips first (remix-first house thesis; they train the gesture), textarea
   always present and dominant, chips can drop to zero.
2. **Anonymous first-app creation + claim/recovery.** Can a logged-out user generate before any slug
   exists, then claim on sign-in? Ties to #1693, and **has a backend dependency** (§3).
   Recommendation: yes — anonymous draft, claimed later. *Must* define the claim/recovery
   path up front so first-gen work is never lost if sign-in is interrupted (e.g. draft keyed
   to a client token, re-attachable post-auth).
3. **Eager slug + draft lifecycle.** Allocate `/vibe/$user/$app` before first generation (so
   the URL is shareable immediately) or after? Recommendation: eager, throwaway anonymous
   owner for logged-out drafts — **with a defined TTL/cleanup for abandoned drafts** so eager
   allocation doesn't leak slugs/storage.
4. **Curated-vs-real perf contract.** The edit affordance has two lanes — curated/cached (must
   feel instant, click-as-page-view) and real generation (visibly different, has latency). Define
   the perf budget and the visible treatment that distinguishes them, so "instant" is a
   contract, not a hope (ref #1896's <500ms curated-swap target).
5. **Group-private intent.** Is jchris's "group-private / collaborative" (#1973) a fourth
   publish intent or just "Shared space" with a private visibility? Recommendation: the
   latter — intent (Join/Remix/View) is orthogonal to visibility (Restricted/Public).
6. **Desktop.** Confirm desktop = mobile-with-breathing-room, not a reintroduced
   side-by-side editor.
