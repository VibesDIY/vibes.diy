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

## 1. North star: the unified `/vibe` surface

There is one screen. It has three **states**, and the same screen is reused for every
visitor — the differences are parameters, not separate code paths.

```
                       does an app exist yet?
                        ┌──────────────┴──────────────┐
                       NO                              YES
                   ┌────┴────┐                    ┌─────┴─────┐
              ┌─── GENESIS ──┐               who are you? × creator intent
              first-generation                    │
              (replaces /chat new            ┌─────┴─────┬──────────┐
               + home "new vibe"           OWNER     MEMBER /     ANON /
               + Starter Stack)              │       INVITED      no-grant
                                             │          │            │
                                          LIVE        LIVE      LIVE or onramp
                                         (agent      (agent     (Join / Remix /
                                          ready)     ready if    View by intent)
                                                     writer)
```

- **State is a function, not a route.** `/vibe/$user/$app` always. A brand-new draft
  allocates its slug eagerly so the URL is shareable/bookmarkable from second zero
  (open question Q3 below).
- **Mobile-first.** The canvas is the app, full-bleed. The agent is a bottom sheet /
  collapsed bar — never a side-by-side desktop editor. The desktop layout is the mobile
  layout with breathing room, not a different design.
- **The agent is an affordance, not a destination.** Tapping it talks to the app; the
  app hot-swaps in place (the existing hot-swap overlay, kept). No navigation, no
  context switch, no second URL.

### 1a. GENESIS — the new first-generation state (the first thing to design)

This is the riskiest, most novel piece and the thing to sketch first. **It must not look
like today's chat UI.** It is the app's birth, mobile-first, with the agent seeding it.

```
 ┌─────────────────────────┐    Mobile, full-bleed.
 │                         │    - The canvas is where the app WILL be.
 │      (the canvas —      │    - Curated starter tiles (the #1896 Starter Stack
 │     app blooms here)    │      chips, generalized) seed the first prompt:
 │                         │      "Make a ___"  →  app blooms IN the canvas,
 │   ▸ Make a song player  │      not in a code pane with a preview.
 │   ▸ Make a list w/ pals │    - Generation streams INTO the canvas; the agent
 │   ▸ Make a game         │      bar shows progress, collapses when done.
 │   ▸ Other…              │    - No login required to make the first app
 │                         │      (deferred identity — see §3, #1693).
 ├─────────────────────────┤
 │  ✎ describe your app…  ▸│ ← agent bar (collapsed sheet)
 └─────────────────────────┘
```

Genesis is **one screen serving three jobs that are currently three systems**: the
homepage "new vibe" entry (`home.tsx`), the `/chat` new session
(`NewSessionContent`), and the Instant Starter Stack `/start` route (#1896). The
Starter Stack stops being a special route and becomes "Genesis, seeded with curated
content." (jchris's keystone question — answered: yes, standardize it as the normal
pre-vibe display, not a special view.)

### 1b. LIVE — app running, agent collapsed

```
 ┌─────────────────────────┐    - App fills the screen.
 │                         │    - One pill, bottom. It is the agent handle +
 │     (running app)       │      the share/identity affordances, parameterized
 │                         │      by grant (see §2). NOT four look-alike buttons
 │                         │      with three interaction models (#1708).
 │                         │    - Owner: tap pill → agent ready (this is "Edit",
 │                         │      but there is no Edit button — you just talk to
 │                         │      your app).
 ├─────────────────────────┤    - Member/writer: same.
 │ ⌂   ◐ handle ▾   ✎ Remix│ ← - Reader/anon: pill shows the intent-driven CTA
 └─────────────────────────┘      (Join / Remix / View) + Share.
```

### 1c. ITERATING — agent expanded

```
 ┌─────────────────────────┐    - Agent sheet rises over the lower third; app
 │     (running app,       │      stays visible and hot-swaps as code lands.
 │      hot-swapping)      │    - For a NON-owner, the first edit silently forks
 ├─────────────────────────┤      to their copy and the sheet says, inline and
 │ You: make it blue       │      non-blocking: "You're remixing — this is your
 │ ▸ applying…             │      copy, the original is unchanged." (#1856 —
 │ ✎ keep talking…        ▸│      a state, not a modal gate.)
 └─────────────────────────┘    - This is what #1745 / #2518 describe, but as the
                                  default, not a bolt-on.
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
Resolve in this fixed order so the CTA is always predictable (Charlie offered a full
`intent × grant × request-setting → primary/secondary` truth table — accepted, it lands at
GATE 1):

1. `revoked-access` → disabled **"Access revoked"**, no primary. *(Remix still offered — a
   copy is independent of the revocation.)*
2. `pending-request` → disabled **"Requested"**, no primary. *(Remix still offered.)*
3. Private + requests **off** (`not-grant`) → "App not available" (no card). *(Remix only if
   the source is itself reachable to this viewer.)*
4. Private + requests **on** → primary **Join** (as "Request to join"); secondary Remix.
5. Public / granted → primary CTA = **publish-intent** (Shared→Join, Read-only→View,
   Template→Remix); the other two outcomes are always present as secondary.

`Remix` is the one action available in nearly every state (it forks; it doesn't depend on
the source's grant), which is why it's the universal fallback.

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

> **⚠️ Anonymous Genesis is NOT free — it has a backend dependency.** The current
> first-generation path is auth-gated: `routes.ts` puts `chat/prompt` under the auth
> layout, and `prompt.tsx` only calls `chatApi.openChat()` once `isSignedIn` is true. So
> "make the first app with no login" requires **new anonymous-draft + claim-on-sign-in
> work** (server allocates a throwaway-owner draft; the slug is claimed on auth). That is
> a dependency, not a given. **Split the Genesis work accordingly:** the new mobile-first
> first-generation *UI* (canvas, starter tiles, app-blooms-in-place) has no backend
> dependency and ships in PR-1 **still auth-gated**; the *anonymous* path is a separate,
> explicitly-flagged dependency (GATE 1, §8 Q2/Q3) — do not assume it for every state.

## 4. Week plan (human-in-the-loop gates)

Two PRs. PR-1 is design + the no-dependency deletions (ships this week regardless of
backend). PR-2 is the inversion wiring (gated on #2517). Each **GATE** is a hard stop
for your judgement before code.

| Day | Work | Output | Gate |
| --- | --- | --- | --- |
| **0–1** | Lofi sketches of Genesis / Live / Iterating, mobile-first. Flow outlines for: new app, visitor-Join, visitor-Remix, owner-iterate. Finalize §2 verb spec + §7 subtraction ledger. | Sketch set + this doc's §1–2 ratified | **GATE 1: you approve the sketches & verbs before any code.** |
| **2** | Genesis spike — the new first-generation `/vibe` state, mobile-first, app-blooms-in-canvas. Curated starter tiles. Behind a flag, **auth-gated** (anonymous path is a separate dependency, §3). | Clickable Genesis on `/vibe` | **GATE 2: does Genesis feel right on a phone?** |
| **3** | Verb collapse + landing card: Remix/Join/View by intent; delete Clone/Fresh-Install/Edit-button; publish-intent setting (#1854). Mostly deletion. | PR-1 part 1 | — |
| **4** | Share panel link-first (#2232 + children). Indicator system for viewer modes (#2178/#2275). | PR-1 complete → review | **GATE 3: PR-1 review/QA.** |
| **5** | Inversion wiring: agent-in-vibe Live/Iterating, hot-swap inline, `/chat` → `/vibe` redirects, lazy chat connection flip. | PR-2 (may carry over) | **GATE 4: full cutover review.** |

**Prerequisite (being handled separately):** full `/chat` deletion needs the lazy chat
connection from **Track B #2517** (SharedSessions DO). jchris is tackling #2517
independently as a pre-task — **treat it as done for planning purposes.** That means PR-2
can land the *full* inversion (not a flagged stub): once #2517 is in, the agent-in-vibe
wiring + `/chat` → `/vibe` redirects + connection-laziness flip all ship together. Keep a
flag only as a rollback seam, not as a dependency workaround.

## 5. PR structure

- **PR-1 "Vibe-first surface: verbs, landing, share" (no backend dep).** Genesis state
  (flagged, **auth-gated** — anonymous generation is deferred to its own dependency, §3),
  verb collapse, publish-intent, link-first share, viewer-mode indicators. This is where
  most of the *deletion* lands. Ships this week.
- **PR-2 "Agent-in-vibe / retire /chat" (#2517 handled as a pre-task).** Inline agent
  Live/Iterating, hot-swap, route redirects, lazy chat connection flip — full cutover, with
  a flag kept only as a rollback seam.

Both human-driven on UI. Label `agent-created`; @-mention `@CharlieHelps`; `ready-to-merge`
when green.

## 6. Full issue disposition (nothing lost)

All **30** issues from the original backlog list are accounted for below, each in exactly
one bucket. (#2517 is **not** one of the 30 — it's the backend prerequisite, kept separate
so the count stays crisp.)

**Resolved by design (the inversion / verb model):**
- #2518 `/chat` deprecation → *is* PR-2 (#2517 handled as a pre-task).
- #1745 inline edit + hot-swap → the default Iterating state.
- #1709 EDIT/CLONE/REMIX popup → **deleted** (no submenu; agent is inline).
- #2262 "vibe" button → "remix" → subsumed; the agent affordance is the remix entry.
- #1708 action-bar inconsistency → **deleted** (one pill, one model).
- #2162 Clone/Remix inconsistency across surfaces → **deleted** (Clone is gone; Remix everywhere).
- #1855 data-mode CTA language → Join/Remix/View by intent.
- #1854 publish intent → the one new setting.
- #1856 non-owner edit = your copy → inline Iterating state message.
- #2037 Join over Fresh Install → Fresh Install deleted; Join primary by intent.
- #1857 sharing-onramp epic → this doc *is* its resolution.
- #1973 two sharing modes legible → Join vs Remix + intent (third "group-private" = Shared-space intent).
- #2178 read-only/admin indicator → viewer-mode indicator system (§2).
- #2275 active handle + switcher + login → handle switcher in the pill (Author/Visitor modes).

**Explicit build (Share cluster, PR-1):** #2238 (umbrella — "simplify the sharing UI"; this
cluster *is* its resolution) #2232 (anchor) #2233 #2234 #2235 #2236 #1768.

**Explicit build (FTUE / Genesis):** #1693 (principle, §3) #1896 (Starter Stack → Genesis seed)
#2353 (shared-data "sign in to see @sender's entries" prompt — design in §3, built here; single bucket).

**Validate after landing (small follow-ups):** #1747 (reader → request writer access — now an
agent-bar affordance) #1749 (authed non-owner flow — validate against new Live state)
#1766 (live auto-let-in on approval — keep, orthogonal) #1742 (unread-comments blue dot — keep,
orthogonal) #1951 (feedback link — keep, orthogonal) #1836 (VibesPanel position/first-run —
mostly mooted by the new pill; salvage the first-run onboarding copy into Genesis).

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
| Separate `/start` *system* (#1896) — route kept as a **compat redirect** into `/vibe`, not hard-removed | Onboarding isn't a special place; it's the normal vibe surface seeded with curated content. (Redirect avoids breaking the prototype/links.) |

## 8. Open questions for GATE 1

1. **Genesis canvas vs chips.** Does Genesis lead with curated tiles (Starter-Stack
   style, instant cached) or a blank prompt? Recommendation: tiles first (remix-first
   house thesis), blank prompt one tap away.
2. **Anonymous Genesis + claim/recovery.** Can a logged-out user generate before any slug
   exists, then claim on sign-in? Ties to #1693, and **has a backend dependency** (§3).
   Recommendation: yes — anonymous draft, claimed later. *Must* define the claim/recovery
   path up front so first-gen work is never lost if sign-in is interrupted (e.g. draft keyed
   to a client token, re-attachable post-auth).
3. **Eager slug + draft lifecycle.** Allocate `/vibe/$user/$app` before first generation (so
   the URL is shareable immediately) or after? Recommendation: eager, throwaway anonymous
   owner for logged-out drafts — **with a defined TTL/cleanup for abandoned drafts** so eager
   allocation doesn't leak slugs/storage.
4. **Curated-vs-real perf contract.** Genesis has two lanes — curated/cached (must feel
   instant, click-as-page-view) and real generation (visibly different, has latency). Define
   the perf budget and the visible treatment that distinguishes them, so "instant" is a
   contract, not a hope (ref #1896's <500ms curated-swap target).
5. **Group-private intent.** Is jchris's "group-private / collaborative" (#1973) a fourth
   publish intent or just "Shared space" with a private visibility? Recommendation: the
   latter — intent (Join/Remix/View) is orthogonal to visibility (Restricted/Public).
6. **Desktop.** Confirm desktop = mobile-with-breathing-room, not a reintroduced
   side-by-side editor.
