# Spec: Stop the Vibe logo flashing top-left during load

## Problem

When you open a Vibe route (`/vibe/:ownerHandle/:appSlug`), the Vibes logo
appears in the **top-left corner** for a moment while the app loads, then
disappears and reappears as the action pill in the **bottom-right corner**.
The logo looks like it "teleports" from one corner to the other, which reads as
clunky and unfinished.

Desired behavior: the logo should be **invisible during loading** and only
appear once, in the bottom-right corner. No top-left flash.

> Status: **implemented** on branch `claude/vibe-logo-animation-plan-e8px3h`
> (PR #2702). The in-flight route work has merged to main; this branch was
> rebased and the change below applied.

## Where it happens

File: `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`

The route resolves an access `grant` into a `cardVariant`
(`vibe-card-variant.ts`). Until the grant resolves, the variant is `"loading"`.
The relevant states:

- `isAccessGranted` (`cardVariant === "iframe"`) — access resolved, show the app.
- `showCard` (`request`/`invite`/`pending`/`revoked`) — a persistent access card.
- `notFound` — persistent "App not available" screen.
- otherwise — the transient `"loading"` state, which renders `"Preparing…"`.

### The two logos

**Top-left** (lines ~585–591), rendered whenever `!isAccessGranted` — i.e.
during loading *and* on the card / not-found screens:

```tsx
{!isAccessGranted && (
  <div className={cx(gridBackground, "flex h-screen w-screen items-center justify-center")}>
    <div className="fixed top-4 left-4 z-50">
      <Delayed ms={1000}>
        <VibesSwitch size={60} isActive={isSidebarVisible} onToggle={setIsSidebarVisible} className="cursor-pointer" />
      </Delayed>
    </div>
    {/* showCard ? … : notFound ? … : "Preparing…" */}
  </div>
)}
```

**Bottom-right** (lines ~688–727), rendered only once `isAccessGranted`:

```tsx
{isAccessGranted && hasMounted && createPortal(
  <div className="fixed bottom-4 right-4 z-50">
    <Delayed ms={1000}>
      <ExpandedVibesPill … />
      <ShareModal … />
    </Delayed>
  </div>,
  document.body,
)}
```

### Why it flashes

The two logos are **separate elements in opposite corners**, not one element
that animates across the screen. The perceived "teleport" is a sequence:

1. `cardVariant === "loading"` → grid overlay with "Preparing…". The top-left
   `VibesSwitch` is gated behind `Delayed ms={1000}`.
2. If the grant takes longer than ~1s to resolve (common on cold loads), the
   top-left logo appears.
3. Grant resolves to `iframe` → the whole `!isAccessGranted` overlay unmounts,
   so the top-left logo vanishes.
4. The bottom-right `ExpandedVibesPill` mounts, then waits its **own**
   `Delayed ms={1000}` before appearing.

So on a slow-ish load the user sees: nothing → top-left logo → (gone) →
bottom-right pill. That's the clunk.

## Key nuance: the top-left logo is the sidebar toggle

The top-left `VibesSwitch` is not decorative — it's the **only** control that
opens `SessionSidebar` (`onToggle={setIsSidebarVisible}`, line ~589; sidebar at
line ~730). It exists only while `!isAccessGranted`. Once access is granted the
top-left toggle is gone and the bottom-right `ExpandedVibesPill` does **not**
wire up `setIsSidebarVisible`, so the sidebar is effectively unreachable in the
granted state already.

Implication: we can't blindly delete the top-left logo without deciding what
happens to the sidebar toggle on the card / not-found screens, where it is the
only entry point. During the transient `"loading"` state the sidebar carries
nothing useful (`sessionId=""`, grant still resolving), so removing the toggle
*there* is safe.

## Proposed change (recommended)

**Only render the top-left logo on the persistent screens, never during
`"loading"`.** Gate the top-left `<div className="fixed top-4 left-4 …">` on
`showCard || notFound` instead of the broad `!isAccessGranted`.

Result:
- Happy path (`loading → iframe`): nothing in the top-left, ever. The logo
  appears exactly once, as the bottom-right pill. Flash eliminated.
- Card / not-found screens: unchanged — logo + sidebar toggle stay where they
  are the only entry point to the sidebar.

This is the smallest, lowest-risk change that satisfies "invisible until it
appears in the bottom-right" for the common case, without stranding the sidebar
toggle.

### Sketch (implement after the in-flight work lands)

Move the top-left logo so it renders inside the `showCard`/`notFound` branches
only, e.g.:

```tsx
{!isAccessGranted && (
  <div className={cx(gridBackground, "flex h-screen w-screen items-center justify-center")}>
    {(showCard || notFound) && (
      <div className="fixed top-4 left-4 z-50">
        <Delayed ms={1000}>
          <VibesSwitch size={60} isActive={isSidebarVisible} onToggle={setIsSidebarVisible} className="cursor-pointer" />
        </Delayed>
      </div>
    )}
    {showCard ? ( … ) : notFound ? ( … ) : (
      <div style={{ color: "var(--vibes-text-primary)" }}>Preparing…</div>
    )}
  </div>
)}
```

(The grid background + "Preparing…" loading screen stays — only the logo is
suppressed during `"loading"`.)

## Decision (settled)

**Remove the top-left logo from the `"loading"` state only; keep it on the
card / not-found screens.** Gate the top-left logo on `showCard || notFound`.

This was the recommended option and is now the agreed direction (confirmed by
the human and by review on PR #2702). The logo stays as the `SessionSidebar`
entry point on the persistent card / not-found screens; it just never appears
during transient loading, so the happy path shows the logo exactly once — as the
bottom-right pill.

The literal "never top-left anywhere" variant is explicitly **out of scope** for
this change: it would require giving the sidebar an alternate entry point on the
card / not-found screens, which is a separate UX decision.

## Out of scope / follow-ups (not part of this fix)

- The bottom-right pill's own `Delayed ms={1000}` after access is granted still
  produces a ~1s "nothing in the corner" gap before the pill appears. Not part
  of the complaint; leave as-is unless we want the pill to come in sooner or
  with a fade.
- If we later want a genuine cross-screen motion, that's a different design
  (single shared element animating corner-to-corner) and a bigger change.

## Verification (when implemented)

1. Open a public/world-readable vibe on a throttled connection. Confirm the
   top-left corner stays empty for the entire load and the logo only ever
   appears bottom-right.
2. Open a vibe that returns a `request`/`invite`/`pending`/`revoked` card.
   Confirm the top-left logo still shows and still toggles the sidebar.
3. Open a non-existent vibe. Confirm the not-found screen still shows the
   top-left logo.
