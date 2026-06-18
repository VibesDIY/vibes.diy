# Vibe Pill Menu Prototype — Design

- **Date:** 2026-06-18
- **Status:** Approved (baseline). This is a starting point; proposed menu changes will be layered on top in a later pass.
- **Author:** popmechanic

## Goal

Build a static, self-contained HTML page that reproduces the current vibe pill
menu — the floating control that appears at the lower-right of a deployed vibe —
pixel- and motion-faithfully, sitting over a sample vibe app. The page is a
discussion prop for walking the team through proposed changes. It must look
right and be clickable; it need not be functional (no real navigation, auth,
data, or QR generation).

## Non-goals

- No real navigation, authentication, sharing, or community/DM data.
- No build step, framework, or dependencies — one file you can open or host.
- No live QR generation (show a static placeholder image).
- No multiple viewer states / persona switcher. One state only (see below).
- No responsive "narrow" layout mode. Target the wide (≥640px) layout where all
  action-button labels are visible. (Mentioned only so it's an explicit cut.)

## Approach

**Single self-contained `index.html`** with inline CSS and vanilla JS. Read the
real component and translate its exact style values, easing, and phase machine
into plain JS. The sample vibe lives in the same file behind the pill.

Rejected alternatives: mounting the real React component in a Vite/sandbox
harness (drags in a build step and heavy prop/dependency mocking, stops being a
"just open it" artifact); a rough static mock (undershoots the requested
pixel + motion fidelity).

## Artifact location

`docs/prototypes/vibe-pill-menu/index.html`

Open directly in a browser or host the folder statically.

## Source of truth (files to lift values from)

- Component: `vibes.diy/base/components/ExpandedVibesPill.tsx`
- Pill SVG fill colors: `vibes.diy/base/components/VibesSwitch.styles.ts`
  (`switchColors.primary = var(--vibes-black)`, `secondary = var(--vibes-cream)`)
- Canonical palette: `vibes.diy/base/theme/tokens.ts` (generates the
  `--vibes-*` CSS variables the viewer page defines)
- Production props / mount: `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`
  (portal into `document.body`, wrapped in `fixed bottom-4 right-4 z-50`, 1000ms
  `<Delayed>`, `size={60}`)

## Fidelity reference

### Size

Pill renders at `size = 60` (matching production), so:

- `height = 60`, `scale = height / 300 = 0.2`
- `pillWidth = 600 * scale = 120px` (SVG viewBox `0 0 600 300`, so 120×60)
- `btnWidth = height * 0.75 = 45px` (closed action button)
- `btnExpandedWidth = height * 1.8 = 108px` (open action button, with label)
- `btnPadding = 10` (cream gap between buttons and pill)
- `visibleButtons = 3`

### Palette (canonical token values — define these as CSS variables)

The prototype must define `:root` variables so the pill renders the colors that
actually ship (the component's inline `var(--x, fallback)` fallbacks are NOT
what production shows, and `switchColors` has no fallbacks):

| Variable | Value |
| --- | --- |
| `--vibes-blue` | `#3b82f6` |
| `--vibes-green` | `#51cf66` |
| `--vibes-yellow` | `#eab308` |
| `--vibes-black` | `#000000` |
| `--vibes-near-black` | `#1a1a1a` |
| `--vibes-cream` | `#fffff0` |
| `--vibes-orange-neon` | `#fb923c` |
| `--vibes-text-primary` | `#333333` |

### Structure (back to front, all within a `position: relative` wrapper)

1. **Bubble tray** — cream, 1px near-black border, `border-radius: 87*scale+4`.
   Sits behind/beside the pill; width animates from `trayCollapsed` (covers the
   pill) to `trayExpanded` (reveals the buttons), `overflow: hidden` so the
   bouncy width reveal clips rather than slides the buttons.
2. **Metadata strip** — appears in extra space at the top of the bubble when
   expanded and metadata exists: app icon (screenshot), title line, slug line.
   Fades in `opacity 0.2s ease`.
3. **Horizontal action buttons** (bottom-anchored, right-aligned against the
   pill): **Home** (blue, cream label), **Group** (green, cream label),
   **Vibe** (yellow, near-black label). Each button: circular near-black icon
   chip + uppercase 700 label, `letter-spacing 1.5px`, Inter.
4. **Vertical sub-menu** — opens above the pill, aligned to the Vibe button's
   right edge, when Vibe is clicked (`subMode === "change"`). Cream, near-black
   border, `border-radius: 12`, scales in from `bottom right` with bouncy
   easing. Rows: **Edit** (yellow), **Clone** (blue), **Remix** (green),
   **QR Code** (cream). QR Code toggles a static QR placeholder image.
5. **Pill SVG** — `viewBox 0 0 600 300`, height 60, always on top (z-index 2).
   Black outer pill; "diy"/"vibes" wordmark paths cross-fade and the cream
   wordmark slides `translateX(3px)` when the tray opens (`creamSlid`).
6. **Badges** (owner, fully-loaded — all shown):
   - **Pending-access count** — orange, top-right; translates onto the Group
     button when expanded (`transform 0.2s` bouncy).
   - **Unread-DM count** — blue, top-left.
   - **Unpublished-changes dot** — orange dot, top-left.

### Phase machine (exact timings)

`idle → bubble → expanding → open` on open; `open → collapsing → shrinking →
idle` on close.

- click pill in `idle` → `bubble`
- `bubble` → `expanding` after **120ms**
- `expanding` → `open` after **250ms**
- click pill in `open` → `collapsing`
- `collapsing` → `shrinking` after **200ms**
- `shrinking` → `idle` after **150ms**
- on `idle`: reset sub-menu to `default`, hide QR

Tray transitions by phase:
- `bubble`: `transform 0.25s cubic-bezier(0.34,1.56,0.64,1)`
- `expanding`/`open`: `width/top/height 0.5s cubic-bezier(0.34,1.56,0.64,1)`
- `collapsing`: `width/top/height 0.4s ease`
- `shrinking`: `transform 0.12s ease` (scale to 0)

Action-button width/label: `0.2s cubic-bezier(0.34,1.56,0.64,1)`.
Sub-menu: `transform 0.12s cubic-bezier(0.34,1.56,0.64,1), opacity 0.08s ease`.

Easing constant throughout: `cubic-bezier(0.34, 1.56, 0.64, 1)` (bouncy).

Entrance: 1000ms delay before the pill appears, then it's interactive.

Long-press-to-hide (500ms) is **out of scope** for the prototype — it's an
easily-missed gesture that doesn't aid the design discussion.

## State shown

**Owner, logged in, fully-loaded.** Everything the menu can contain is on
screen: Home / Group / Vibe horizontal tray; Edit / Clone / Remix / QR Code
vertical sub-menu; all three badges (pending-access count, unread-DM count,
unpublished-changes dot); metadata strip with icon, title, and slug.

(Note: production wires different subsets per real state — e.g. a logged-out
visitor gets a Login button instead of Group/Vibe, and some states omit Remix.
The prototype deliberately shows the maximal owner menu so the team can see and
discuss every affordance in one view.)

## Sample vibe (backdrop)

A simple, real-looking generated vibe: a to-do app — header with a title and a
search field, a few checkable task rows (mixed checked/unchecked), and an "add
task" input. Static and visually muted so the pill stays the focus. Page chrome
fills the viewport; the pill floats fixed at bottom-right over it.

## Interactions

- Click pill → tray expands through the phase machine; click again → collapses.
- Click **Vibe** → vertical sub-menu opens/closes (toggles `subMode`).
- Click **QR Code** → toggles a static QR placeholder image.
- All links (Home, Edit, Clone, Remix) are clickable but inert (`href="#"`,
  `preventDefault`).
- To-do rows: checkboxes toggle visually; no persistence.

## Acceptance (how we eyeball fidelity)

Open the file and compare against a live deployed vibe's pill:

1. Collapsed pill matches the wordmark, colors, and 120×60 size.
2. Click expands the tray with the bouncy reveal; Home/Group/Vibe show labels.
3. Pending-access badge animates from top-right onto the Group button.
4. Vibe opens the vertical Edit/Clone/Remix/QR menu above the pill.
5. QR Code toggles a QR image placeholder.
6. Closing runs collapse → shrink back to the bare pill.
7. Metadata strip (icon/title/slug) is visible when expanded.

## Iteration note

This baseline exists to anchor the proposed changes. Expect to edit this single
file to mock each change as the team works through it.
