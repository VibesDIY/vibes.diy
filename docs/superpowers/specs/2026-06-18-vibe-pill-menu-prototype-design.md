# Vibe Pill Menu Prototype — Design

- **Date:** 2026-06-18
- **Status:** Approved — building.
- **Author:** popmechanic

## Goal

Build a static, self-contained, clickable HTML page prototyping a **proposed
permissions-first redesign** of the vibe pill menu — the floating control at the
lower-right of a deployed vibe — sitting over a sample vibe app. It's a
discussion prop for the team. It must look right and be clickable; it need not
be functional (no real navigation, auth, data, QR, or AI).

The collapsed pill, palette, sizing, and open/close motion stay faithful to the
shipping component. The menu's **contents and surfaces are redesigned** around
sharing and per-user access control.

## The redesign in one line

The pill stops being `Home · Group · Vibe` and becomes sharing-first. Tray
order, left to right: `Help · Account · Vibe · Share` (Share on the far right,
nearest the pill).

## Approach

**Single self-contained `index.html`** — inline CSS + vanilla JS, no build, no
deps. The shipping pill's exact values, easing, and phase machine are hand-ported
from the real component; the new surfaces are built to match the vibes aesthetic
(cream surfaces, near-black 1px borders, Inter, bouncy easing).

Rejected: mounting the real React component in a build harness (drags in
build + prop mocking, stops being "just open it"); a rough static mock
(undershoots the requested pixel + motion fidelity).

## Artifact location

`docs/prototypes/vibe-pill-menu/index.html` — open directly or host statically.

## Source of truth (lift exact values from these)

- Component: `vibes.diy/base/components/ExpandedVibesPill.tsx` (SVG paths,
  phase-machine timings, geometry formulas, badge logic)
- Pill SVG fills: `vibes.diy/base/components/VibesSwitch.styles.ts`
- Canonical palette: `vibes.diy/base/theme/tokens.ts`
- Production mount/props: `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`
  (portal into `document.body`, `fixed bottom-4 right-4 z-50`, 1000ms `<Delayed>`,
  `size={60}`)

## Fidelity reference (unchanged pill base)

### Size

`size = 60` (production value): `height = 60`, `scale = 0.2`,
`pillWidth = 120`, `btnWidth = 45` (closed), `btnExpandedWidth = 108` (open),
`btnPadding = 10`. The tray now shows **4** buttons (was 3); recompute
`trayExtra`, the metadata-strip width, and badge open-positions accordingly.

### Palette (define as `:root` CSS variables — canonical token values)

| Variable | Value | Use |
| --- | --- | --- |
| `--vibes-blue` | `#3b82f6` | Share button |
| `--vibes-yellow` | `#eab308` | Vibe button |
| `--vibes-green` | `#51cf66` | Help button |
| `--vibes-purple-neon` | `#c084fc` | **Account button (new)** |
| `--vibes-orange-neon` | `#fb923c` | badges |
| `--vibes-black` | `#000000` | pill outer / wordmark |
| `--vibes-near-black` | `#1a1a1a` | borders, labels |
| `--vibes-cream` | `#fffff0` | surfaces, labels |
| `--vibes-text-primary` | `#333333` | body text |

### Phase machine (exact timings — bouncy easing `cubic-bezier(0.34,1.56,0.64,1)`)

`idle → bubble → expanding → open` (open); `open → collapsing → shrinking → idle`
(close). `bubble`→`expanding` 120ms; `expanding`→`open` 250ms;
`collapsing`→`shrinking` 200ms; `shrinking`→`idle` 150ms. Tray width/top/height
0.5s bouncy (expand) / 0.4s ease (collapse); `bubble` scale 0.25s bouncy;
`shrinking` scale 0.12s ease. Action-button width/label 0.2s bouncy. 1000ms
entrance delay. Long-press-to-hide is **out of scope**.

## Top-level tray (replaces `Home · Group · Vibe`)

Four buttons, all colors from the brand palette. **No Home button** (dropped).
Order left → right (Share nearest the pill):

| Button | Color | Opens |
| --- | --- | --- |
| **Help** | green `#51cf66`, cream label | AI agent chat modal |
| **Account** | purple `#c084fc`, near-black label | account panel |
| **Vibe** | yellow `#eab308`, near-black label | vertical code menu |
| **Share** | blue `#3b82f6`, cream label | full Share panel (tabs) |

Buttons are widened (124px expanded) so the longest label ("ACCOUNT") fits with
right-side padding.

### Panel-to-tab connection (folder metaphor)

An open panel must read as a folder whose **tab is the nav button that opened
it**, so the user never loses track of which item they're inside:

- The panel anchors **directly above its source button**, right edges aligned,
  with its bottom sitting **right on top of the coloured nav row** (covering the
  mostly-empty cream area above the buttons — no tall gap).
- A short **coloured seam** in the button's colour joins the active button to
  the panel's bottom edge, opening a "mouth" so they read as one piece.
- The active button keeps full colour; the **other buttons recede** (dimmed).
- Positioning is computed from the button's live `getBoundingClientRect`, so it
  tracks each button's spot across the tray.

## Permissions model (the core of the redesign)

Three independent access axes — **no role bundling**; each is its own control:

1. **Site visibility** — an *app-level* toggle (clearly labeled, not a dropdown):
   **Restricted** (default) | **Public**.
   - Restricted → only people on the access list can open the app.
   - Public → anyone with the link can open it.
2. **Data** — *per-user* `None / Read / Read+Write`. When the app is Public, a
   single **public Data default** applies to everyone (starts at `None`).
3. **Code** — *per-user* edit-via-chat on/off. **Always per-person** — there is
   never a "let anyone edit the code" public default.

Being on the access list implies the person can open a restricted app; the list
then governs their Data + Code grants.

## Share surface — tabs: `Share · Comments · Settings`

A cream card with a near-black border, anchored above the pill, opening with a
bouncy scale/fade. One tab visible at a time.

### Share tab — progressive disclosure driven by the site toggle

**Restricted (default) — per-user machinery visible:**

```
[ Invite by email…                ] [ Add ]
People
 you           Owner
 alex@…   Data [ Read/Write ▾ ]   Code [ ✓ ]
 sam@…    Data [ Read ▾ ]         Code [   ]
Requests · 2                                ▾
 jo@…   wants access        [ Deny ] [ Approve ]
──────────────────────────────────────────────
Site access            [ Restricted | Public ]   ← foundational, at the bottom
🔒 Only invited people can open this app
🔗 Site link                          [ Copy ]
🔗 Landing page link                  [ Copy ]
▦ QR code                             [ Show ]
```

**Public — per-user machinery collapses, minimal public choice remains:**

```
▸ Specific people · 2        (add data/code grants)   ← collapsed, still reachable
Public visitors can:   Data [ None ▾ ]
──────────────────────────────────────────────
Site access            [ Restricted | Public ]
🌐 Anyone with the link can open this app
🔗 Site link                          [ Copy ]
🔗 Landing page link                  [ Copy ]
▦ QR code                             [ Show ]
```

- Per-person row = a **Data dropdown** (None/Read/Read+Write) + a **Code
  checkbox**, independent, no role names.
- Site toggle sits at the **bottom** as the primary/foundational control.

### Comments tab

A Google-Docs-style comment thread (mocked): a few comments with avatar, name,
timestamp, body; a "resolve" affordance; a "comment…" composer. Illustrative.

### Settings tab

Mocked app-settings form: app title, icon/screenshot, canonical slug, plus a
destructive "Delete app" row. Illustrative.

## Vibe — code-change chat

A chat bot for changing the app's code, same UX as the Help assistant but
scaffolded around **making code changes**: "Vibe Coder" identity, a seeded
exchange where the user asks for a change and the agent narrates editing the
code (e.g. adding a `darkMode` toggle), code-change suggestion chips ("Change
the accent color", "Add a due-date field", "Make it mobile-friendly"), and a
"Describe a change…" composer. The single **Edit** affordance (open the full
editor) lives as a button in the chat header. (The QR code moved to Share — see
Site access.)

## Account

Primarily an auth affordance, by sign-in state. The prototype's base state is
owner-logged-in, so it shows the **logged-in** variant (avatar + email +
**Log out**). A **logged-out** variant (**Log in** / **Create account**) is also
mocked so the team can see both; a tiny in-panel switch flips between them (this
is the only persona toggle, scoped to the Account panel).

## Help — AI agent chat modal

Best-practice assistant chat UX, styled to match: clear agent identity (name +
avatar + "online" status), a seeded sample exchange (user question → agent
answer), a typing/streaming indicator, a row of suggested-prompt chips, and a
clickable composer (sending echoes the message into the thread; no real AI).
Cream surface, near-black border, anchored bottom-right, taller than the Share
panel.

## State shown

**Owner, logged in, fully loaded.** All affordances present. The pill itself
carries **no badges or dots** — the numbered count badges (pending-access,
unread) and the unpublished-changes dot were all removed as visual clutter.
Pending requests still surface inside the Share panel's Requests section.

## Sample vibe (backdrop)

A muted, real-looking to-do app: header with title + search, several checkable
task rows (mixed checked/unchecked), an "add task" input. Static; keeps the pill
the focus. Fills the viewport with the pill floating fixed at bottom-right.

## Interactions

- Click pill → tray expands through the phase machine; click again → collapses.
- **Share** → opens Share panel (default Restricted view). Tabs switch content.
- Site toggle flips Restricted ⇄ Public with the progressive-disclosure change.
- Per-person Data dropdowns and Code checkboxes are operable (visual only).
- In Site access, **QR code** "Show/Hide" reveals a placeholder QR image.
- **Vibe** → code-change chat; chips and composer post code-change replies.
- **Account** → panel; in-panel switch flips logged-in/out mocks.
- **Help** → chat modal; suggested chips and composer are clickable.
- All outbound links (Edit, Site link, Landing page link) are inert.
- To-do checkboxes toggle visually; nothing persists.
- Clicking outside an open surface closes it.

## Out of scope

Real navigation/auth/data/QR/AI; long-press-to-hide; narrow/mobile layout;
multi-persona switching beyond the Account panel's two mocks; final copy/content
in Comments / Settings / Account / Help.

## Acceptance (eyeball checklist)

1. Collapsed pill matches the wordmark, colors, and 120×60 size; 1s entrance.
2. Click expands the tray (bouncy reveal) showing `Help · Account · Vibe ·
   Share` with the correct four palette colors (Account = purple), all labels
   (incl. "ACCOUNT") fully readable.
3. The pill carries no badges or dots — clean wordmark only.
4. Share opens the panel; Restricted shows invite + people (Data dropdown +
   Code checkbox) + requests + the site toggle at the bottom.
5. Flipping the site toggle to Public collapses the people machinery and shows
   the single public Data default; flipping back restores it.
6. Comments and Settings tabs switch the panel content; Site access has Site
   link / Landing page link / QR code (QR "Show" reveals the placeholder).
7. Vibe opens a code-change chat (Vibe Coder, code-themed seed + chips +
   composer) with an Edit affordance in the header.
8. Account shows logged-in (Log out); the in-panel switch reveals the
   logged-out variant.
9. Help opens an AI chat modal with a seeded exchange, typing indicator,
   suggested chips, and a clickable composer.
10. Closing runs collapse → shrink back to the bare pill.

## Iteration note

This is the discussion baseline for the redesign. Expect to edit this single
file to mock each refinement as the team works through it.
