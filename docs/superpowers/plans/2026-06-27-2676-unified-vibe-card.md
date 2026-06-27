# Unified Vibe Card (#2676) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the approved Storybook sketch of the "unified vibe card" into a real, interactive `@vibes.diy/base` component (`UnifiedVibeCard`) and swap it onto the `/vibe` route in place of the old `ExpandedVibesPill`, so the agent-in-vibe edit affordance can be felt on the auto-deploy PR preview.

**Architecture:** A new presentational component `UnifiedVibeCard` lives in `@vibes.diy/base`, composing the existing real leaf components (`VibesSwitch`, `OptionButtons`, `ViewerTagView`). It owns a closed↔open state machine: closed = just the `VibesSwitch` toggle in the lower-right; open = a rounded inset card (icon + title header, `OptionButtons` chips + an "Other" textarea body, and a bottom nav row of handle-picker stub · Home · Chat · Share · toggle). All actions are **injected via props** (single-source-of-truth pattern, like `ViewerTagView`). The `/vibe` route renders it instead of `ExpandedVibesPill`, wiring Home→`onHome`, Share→the existing share modal, and the logged-out login path; Clone/Edit/Remix/QR are dropped. `ExpandedVibesPill` itself is left untouched in the codebase for a later cleanup PR.

**Tech Stack:** React 18, TypeScript, Tailwind v4, `@vibes.diy/base` (the shared presentational package), Vitest + Testing Library (`vibes.diy/tests/app`), Storybook (`vibes.diy/stories`).

**Decisions locked (jchris, 2026-06-27):**

- No feature flag — review on the PR preview deploy. The route renders `UnifiedVibeCard` directly.
- New component; `ExpandedVibesPill` stays in the tree (deleted later).
- This PR carries Home + Share + login into the nav; drops Clone/Edit/Remix/QR. Handle picker is a visual stub (#2678). Chips are wired to an injected `onSelectChip`/`onSubmitOther`; the route passes **placeholder chips** (`["Make it a drum kit", "Add a high score"]`) and handlers that `console.warn` for now (real codegen wiring is #2677 / PR-2) so the affordance reads fully on the preview.
- **Open/close tween (jchris):** only the **outer card** grows/shrinks (a scale anchored at the closed toggle's lower-right corner); the inner content (header, chips, nav) **fades in after** the card finishes growing, and fades out first on close.

**Scope boundaries (out of scope, tracked elsewhere):**

- First-generation stream→preview swap and de-blur → #2677.
- Real handle dropdown + switching → #2678 (stub only here).
- Verb collapse / publish intent → #2679. Link-first Share panel internals → #2680 (we only open the _existing_ share modal here).
- Deleting `ExpandedVibesPill` → follow-up cleanup issue.

---

## File Structure

- **Create** `vibes.diy/base/components/UnifiedVibeCard.tsx` — the new component. One responsibility: render the closed toggle / open card and emit injected actions. Pure presentation; no platform or iframe imports.
- **Modify** `vibes.diy/base/components/index.ts` — export the new component.
- **Create** `vibes.diy/tests/app/UnifiedVibeCard.test.tsx` — behavior tests (closed→open toggle, chips render, nav callbacks fire, owner vs non-owner header).
- **Modify** `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx` — replace the `ExpandedVibesPill` render (lines ~689-706) with `UnifiedVibeCard`, wiring injected actions to existing route state (`onHome`, `shareModal.open`, `clerk.openSignIn`, title/icon/slug, `isOwner`, `isTwinkling`).
- **Modify** `vibes.diy/stories/sketches/AgentInVibe.stories.tsx` — replace the sketch-local `UnifiedOverlay` usage with the real `UnifiedVibeCard` so the sketch is now a real-component harness (single source of truth) and the closed↔open morph can be exercised interactively.

---

## Component contract

`UnifiedVibeCard` props (all actions injected; nothing platform-specific inside the component):

```ts
export interface UnifiedVibeCardProps {
  /** Public title shown in the card header. */
  appTitle: string;
  /** Secondary line under the title (e.g. "ownerHandle/appSlug"). */
  appSlug?: string;
  /** Icon/screenshot URL shown beside the title; falls back to a gradient block. */
  appIconUrl?: string;
  /** Curated/suggestion chips (the edit affordance). Empty array hides the chip block. */
  chips?: readonly string[];
  /** Fired when a chip is clicked. */
  onSelectChip?: (chip: string) => void;
  /** Fired when the user submits free text in the "Other" row. */
  onSubmitOther?: (text: string) => void;
  /** Owner sees their own title framing; non-owner currently identical visually (verb collapse is #2679). Reserved for later. */
  isOwner?: boolean;
  /** Active handle for the leftmost nav stub. Omit for anonymous (renders Sign in). */
  handleSlug?: string;
  handleAvatarUrl?: string;
  /** Nav actions. */
  onHome?: () => void;
  onShare?: () => void;
  onSignIn?: () => void;
  /** Public-entry attention pulse on the closed toggle. */
  isTwinkling?: boolean;
  /** Controlled open state (optional). When omitted the component manages its own. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}
```

Layout mirrors the approved sketch (`notes/sketches/agent-in-vibe/02-open-chips.png`, story `LiveSwitchOpen`): inset `left/right/bottom: 12`, `borderRadius: 16`, `maxHeight: 82%`, white card with near-black border; header (icon + title + slug), body (`OptionButtons` + Other row), footer nav (`ViewerTagView` stub leftmost · Home · Chat[selected] · Share · `VibesSwitch` toggle rightmost). Closed state renders only the `VibesSwitch` toggle bottom-right.

---

## Task 1: Scaffold `UnifiedVibeCard` (closed state + open toggle)

**Files:**

- Create: `vibes.diy/base/components/UnifiedVibeCard.tsx`
- Modify: `vibes.diy/base/components/index.ts`
- Test: `vibes.diy/tests/app/UnifiedVibeCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// vibes.diy/tests/app/UnifiedVibeCard.test.tsx
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnifiedVibeCard } from "@vibes.diy/base";

beforeEach(() => {
  globalThis.document.body.innerHTML = "";
});

describe("UnifiedVibeCard", () => {
  it("starts closed: title hidden, toggle present", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" />);
    expect(screen.queryByText("Bloom Machine")).toBeNull();
    // the VibesSwitch toggle renders an svg; the card uses a labelled wrapper button.
    expect(screen.getByRole("button", { name: /open vibe menu/i })).toBeTruthy();
  });

  it("opens to reveal the title when the toggle is clicked", () => {
    render(<UnifiedVibeCard appTitle="Bloom Machine" appSlug="meghan/bloom" />);
    fireEvent.click(screen.getByRole("button", { name: /open vibe menu/i }));
    expect(screen.getByText("Bloom Machine")).toBeTruthy();
    expect(screen.getByText("meghan/bloom")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/tests/app && pnpm vitest run UnifiedVibeCard`
Expected: FAIL — `UnifiedVibeCard` is not exported / not defined.

- [ ] **Step 3: Write minimal implementation**

```tsx
// vibes.diy/base/components/UnifiedVibeCard.tsx
import React, { useEffect, useState } from "react";
import { VibesSwitch } from "./VibesSwitch.js";

export interface UnifiedVibeCardProps {
  appTitle: string;
  appSlug?: string;
  appIconUrl?: string;
  chips?: readonly string[];
  onSelectChip?: (chip: string) => void;
  onSubmitOther?: (text: string) => void;
  isOwner?: boolean;
  handleSlug?: string;
  handleAvatarUrl?: string;
  onHome?: () => void;
  onShare?: () => void;
  onSignIn?: () => void;
  isTwinkling?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function UnifiedVibeCard(props: UnifiedVibeCardProps) {
  const { appTitle, appSlug, isTwinkling, open: controlledOpen, onOpenChange } = props;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  // Animation: the OUTER card scales from the toggle's lower-right corner
  // (`grown`), and the inner content fades in only after the grow (`grown`
  // gates opacity with a delay). `mounted` keeps the card in the DOM through
  // the shrink so the exit animates, then unmounts it.
  const [mounted, setMounted] = useState(open);
  const [grown, setGrown] = useState(open);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (open) {
      setMounted(true);
      t = setTimeout(() => setGrown(true), 10); // next tick → trigger the grow transition
    } else {
      setGrown(false);
      t = setTimeout(() => setMounted(false), 240); // unmount after the shrink finishes
    }
    return () => clearTimeout(t);
  }, [open]);

  return (
    <>
      {/* Closed toggle — lower-right, hidden while the card is mounted (the
          card's nav carries its own toggle). The card grows from this corner. */}
      {!mounted && (
        <div style={{ position: "absolute", right: 14, bottom: 16 }}>
          <button
            type="button"
            aria-label="Open vibe menu"
            onClick={() => setOpen(true)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            <VibesSwitch size={48} isActive isTwinkling={isTwinkling} />
          </button>
        </div>
      )}

      {mounted && (
        <div
          role="dialog"
          aria-label="Vibe menu"
          className={props.className}
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 12,
            borderRadius: 16,
            maxHeight: "82%",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            background: "var(--color-light-background-00, #fff)",
            border: "1px solid var(--vibes-near-black, #1a1a1a)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.45)",
            // Only the outer card grows/shrinks; origin = the closed toggle corner.
            transformOrigin: "bottom right",
            transform: grown ? "scale(1)" : "scale(0)",
            transition: "transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1)",
            pointerEvents: grown ? "auto" : "none",
          }}
        >
          {/* Inner content fades in AFTER the grow (delay), out first on close. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              opacity: grown ? 1 : 0,
              transition: grown ? "opacity 0.18s ease 0.14s" : "opacity 0.1s ease",
            }}
            className="text-light-primary dark:text-dark-primary"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 8px" }}>
              <div style={{ lineHeight: 1.2 }}>
                <strong className="text-sm">{appTitle}</strong>
                {appSlug && (
                  <div className="text-light-secondary dark:text-dark-secondary" style={{ fontSize: 12 }}>
                    {appSlug}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default UnifiedVibeCard;
```

Note for later tasks: the header icon (Task 2), body (Task 2), and footer nav (Task 3) all render **inside the inner fade wrapper** (the `<div>` with the `opacity` transition), so they fade in together after the grow. The `setOpen(false)` used by the close button (Task 3) drives this same animation on exit.

Then add to `vibes.diy/base/components/index.ts` after the `ViewerTagView` export line:

```ts
export * from "./UnifiedVibeCard.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy/tests/app && pnpm vitest run UnifiedVibeCard`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/base/components/UnifiedVibeCard.tsx vibes.diy/base/components/index.ts vibes.diy/tests/app/UnifiedVibeCard.test.tsx
git commit -m "feat(base): scaffold UnifiedVibeCard closed/open toggle"
```

---

## Task 2: Card header (icon) + chips body + "Other" row

**Files:**

- Modify: `vibes.diy/base/components/UnifiedVibeCard.tsx`
- Test: `vibes.diy/tests/app/UnifiedVibeCard.test.tsx`

- [ ] **Step 1: Write the failing test** (append inside the `describe`)

```tsx
it("renders chips and fires onSelectChip", () => {
  const onSelectChip = vi.fn();
  render(
    <UnifiedVibeCard appTitle="Bloom Machine" open chips={["Make it a drum kit", "Add a high score"]} onSelectChip={onSelectChip} />
  );
  fireEvent.click(screen.getByText("Make it a drum kit"));
  expect(onSelectChip).toHaveBeenCalledWith("Make it a drum kit");
});

it("submits the Other free-text row", () => {
  const onSubmitOther = vi.fn();
  render(<UnifiedVibeCard appTitle="Bloom Machine" open onSubmitOther={onSubmitOther} />);
  const input = screen.getByPlaceholderText(/describe a change/i);
  fireEvent.change(input, { target: { value: "make it dark" } });
  fireEvent.submit(input.closest("form")!);
  expect(onSubmitOther).toHaveBeenCalledWith("make it dark");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/tests/app && pnpm vitest run UnifiedVibeCard`
Expected: FAIL — no chips, no `describe a change` input.

- [ ] **Step 3: Write minimal implementation**

In `UnifiedVibeCard.tsx`, import `OptionButtons` at the top:

```tsx
import { OptionButtons } from "./OptionButtons.js";
```

Add an icon block at the start of the header row (before the title `<div>`):

```tsx
<div
  aria-hidden
  style={{
    width: 30,
    height: 30,
    borderRadius: 8,
    flexShrink: 0,
    overflow: "hidden",
    background: "linear-gradient(160deg,#312e81,#4c1d95)",
    border: "1px solid rgba(0,0,0,0.15)",
  }}
>
  {props.appIconUrl && <img src={props.appIconUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
</div>
```

After the header `<div>` (still **inside the inner fade wrapper** — the `<div>` with the `opacity` transition), add the body. Use a local controlled input for "Other":

```tsx
<div style={{ padding: "0 14px 12px", overflowY: "auto" }}>
  {props.chips && props.chips.length > 0 && (
    <OptionButtons
      options={props.chips}
      isFirst
      onSelect={(o) => {
        props.onSelectChip?.(o);
        return true;
      }}
    />
  )}
  <OtherRow onSubmitOther={props.onSubmitOther} />
</div>
```

Add the `OtherRow` subcomponent at the bottom of the file (before `export default`):

```tsx
function OtherRow({ onSubmitOther }: { readonly onSubmitOther?: (text: string) => void }) {
  const [value, setValue] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const text = value.trim();
        if (text) onSubmitOther?.(text);
        setValue("");
      }}
      style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}
      className="rounded-md border border-light-decorative-01 dark:border-dark-decorative-01 px-3 py-2"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="describe a change…"
        className="flex-1 bg-transparent text-sm text-light-primary dark:text-dark-primary outline-none placeholder:text-light-secondary dark:placeholder:text-dark-secondary"
      />
      <button
        type="submit"
        aria-label="Submit change"
        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}
      >
        ▸
      </button>
    </form>
  );
}
```

Note: `OptionButtons.onSelect` returning `true` keeps its pressed-spinner state (matches its contract); returning `false` clears it. We return `true` so the press reads as "accepted".

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy/tests/app && pnpm vitest run UnifiedVibeCard`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/base/components/UnifiedVibeCard.tsx vibes.diy/tests/app/UnifiedVibeCard.test.tsx
git commit -m "feat(base): UnifiedVibeCard header icon + chips + Other row"
```

---

## Task 3: Bottom nav row (handle stub · Home · Chat · Share · toggle)

**Files:**

- Modify: `vibes.diy/base/components/UnifiedVibeCard.tsx`
- Test: `vibes.diy/tests/app/UnifiedVibeCard.test.tsx`

- [ ] **Step 1: Write the failing test** (append inside the `describe`)

```tsx
it("fires nav callbacks and closes via the toggle", () => {
  const onHome = vi.fn();
  const onShare = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <UnifiedVibeCard
      appTitle="Bloom Machine"
      open
      handleSlug="meghan"
      onHome={onHome}
      onShare={onShare}
      onOpenChange={onOpenChange}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: /home/i }));
  expect(onHome).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /share/i }));
  expect(onShare).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /close vibe menu/i }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("renders the handle stub when handleSlug is set", () => {
  render(<UnifiedVibeCard appTitle="Bloom Machine" open handleSlug="meghan" />);
  expect(screen.getByText("@meghan")).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/tests/app && pnpm vitest run UnifiedVibeCard`
Expected: FAIL — no Home/Share/close buttons, no `@meghan`.

- [ ] **Step 3: Write minimal implementation**

Import `ViewerTagView` at the top:

```tsx
import { ViewerTagView } from "./ViewerTagView.js";
```

Add a `NavIcon` subcomponent (before `export default`):

```tsx
function NavIcon({
  label,
  color,
  selected,
  onClick,
  children,
}: {
  readonly label: string;
  readonly color: string;
  readonly selected?: boolean;
  readonly onClick?: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: 16,
        cursor: "pointer",
        border: "1px solid var(--vibes-near-black, #1a1a1a)",
        boxShadow: selected ? "0 0 0 3px var(--vibes-near-black, #1a1a1a)" : "none",
      }}
    >
      {children}
    </button>
  );
}
```

Append the footer nav as the last child of the **inner fade wrapper** (after the body block, inside the `opacity`-transition `<div>` — so it fades in with the rest):

```tsx
<div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "10px 12px 12px",
    borderTop: "1px solid var(--color-light-decorative-00, #e5e5e5)",
  }}
>
  {props.handleSlug ? (
    <ViewerTagView
      slug={props.handleSlug}
      displayName={`@${props.handleSlug}`}
      avatarUrl={props.handleAvatarUrl}
      trailing={<span style={{ fontSize: 11, opacity: 0.6, marginLeft: 1 }}>▾</span>}
      style={{
        background: "var(--color-light-background-01, #eee)",
        border: "1px solid var(--color-light-decorative-01, #ddd)",
        color: "var(--color-light-primary, #333)",
        fontSize: 13,
        padding: "3px 8px 3px 4px",
      }}
    />
  ) : (
    <ViewerTagView slug="?" anonymous onSignIn={props.onSignIn} />
  )}
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <NavIcon label="Home" color="#3b82f6" onClick={props.onHome}>
      ⌂
    </NavIcon>
    <NavIcon label="Chat" color="#fb923c" selected>
      💬
    </NavIcon>
    <NavIcon label="Share" color="#22c55e" onClick={props.onShare}>
      ↗
    </NavIcon>
  </div>
  <button
    type="button"
    aria-label="Close vibe menu"
    onClick={() => setOpen(false)}
    style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
  >
    <VibesSwitch size={38} isActive />
  </button>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy/tests/app && pnpm vitest run UnifiedVibeCard`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/base/components/UnifiedVibeCard.tsx vibes.diy/tests/app/UnifiedVibeCard.test.tsx
git commit -m "feat(base): UnifiedVibeCard bottom nav row + close toggle"
```

---

## Task 4: Point the Storybook sketch at the real component

**Files:**

- Modify: `vibes.diy/stories/sketches/AgentInVibe.stories.tsx`

- [ ] **Step 1: Update the import and the live stories**

At the top, add `UnifiedVibeCard` to the base import:

```tsx
import { VibesSwitch, OptionButtons, ViewerTagView, UnifiedVibeCard } from "@vibes.diy/base";
```

Replace the `LiveSwitchClosed`, `LiveSwitchOpen`, and `HandlePickerOpen` render bodies so they drive the real component (closed and open via the `open` prop), keeping `FakeVibeApp` behind it:

```tsx
export const LiveSwitchClosed: Story = {
  name: "1c · Live — switch closed (public: pulse)",
  render: () => (
    <Phone>
      <FakeVibeApp />
      <UnifiedVibeCard appTitle="Bloom Machine" appSlug="meghan/bloom" isTwinkling />
    </Phone>
  ),
};

export const LiveSwitchOpen: Story = {
  name: "1a · Live — switch open (chips)",
  render: () => (
    <Phone>
      <FakeVibeApp />
      <UnifiedVibeCard
        open
        appTitle="Bloom Machine"
        appSlug="meghan/bloom"
        handleSlug="meghan"
        chips={["Make it a drum kit", "Add a high score"]}
        onSelectChip={() => undefined}
        onSubmitOther={() => undefined}
        onHome={() => undefined}
        onShare={() => undefined}
      />
    </Phone>
  ),
};
```

Leave `HandlePickerOpen`, `FirstGeneration`, and `RestrictedGate` as sketch-local for now (they cover #2677/#2678 states not built here) — but delete the now-unused `UnifiedOverlay`'s `pickerOpen`-only path only if it becomes dead. Do not remove `UnifiedOverlay`/`FakeVibeApp`/`OtherInput` yet; `FirstGeneration` and `RestrictedGate` still use them.

- [ ] **Step 2: Verify the stories typecheck/build**

Run: `cd vibes.diy/stories && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: PASS (no type errors). If `stories` has no standalone tsc target, instead run the repo build in Step (Task 6) and confirm Storybook builds.

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/stories/sketches/AgentInVibe.stories.tsx
git commit -m "refactor(stories): drive AgentInVibe live sketches from real UnifiedVibeCard"
```

---

## Task 5: Swap `UnifiedVibeCard` onto the `/vibe` route

**Files:**

- Modify: `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx`

- [ ] **Step 1: Update the import**

Change line 10 from importing `ExpandedVibesPill` to importing `UnifiedVibeCard` (keep the rest):

```tsx
import { VibesSwitch, VibesButton, BLUE, YELLOW, UnifiedVibeCard, gridBackground, cx, useMobile } from "@vibes.diy/base";
```

(Leave `ExpandedVibesPill` exported from base; it is simply no longer imported here.)

- [ ] **Step 2: Replace the render block**

Replace the `<ExpandedVibesPill ... />` element (≈ lines 689-706) with:

```tsx
<UnifiedVibeCard
  appTitle={appTitle ?? appSlug}
  appSlug={vibeSlug}
  appIconUrl={screenshotUrl ?? undefined}
  isOwner={isOwner}
  handleSlug={authSignedIn ? ownerHandle : undefined}
  chips={["Make it a drum kit", "Add a high score"]}
  onSelectChip={(chip) => console.warn("[agent-in-vibe] chip select not wired yet:", chip)}
  onSubmitOther={(text) => console.warn("[agent-in-vibe] other submit not wired yet:", text)}
  onHome={() => {
    window.open("https://vibes.diy", "_blank");
  }}
  onShare={authSignedIn ? shareModal.open : undefined}
  onSignIn={authSignedIn ? undefined : () => clerk.openSignIn()}
  isTwinkling={isNetworkActive}
/>
```

Notes:

- `handleSlug={authSignedIn ? ownerHandle : undefined}` is a **stub**: it shows _the app owner's_ handle, not the viewer's active handle. The real active-handle wiring is #2678. (Acceptable for a preview; revisit in #2678.)
- `shareModal.buttonRef` was used for popover positioning of the old Group button. The `ShareModal` below still renders with `placement="above"`; keep the existing `<ShareModal .../>` element unchanged directly after the card. If the share popover positioning looks off in preview, that is expected and tracked for #2680 (link-first Share); do not block this PR on it.

- [ ] **Step 3: Typecheck the app package**

Run: `cd vibes.diy/tests/app && pnpm typecheck`
Expected: PASS. If `appTitle ?? appSlug` types complain (both possibly null/string), confirm `appSlug` is a non-null route param string at that point (it is — destructured from `useParams`); adjust to `appTitle ?? appSlug ?? "Vibe"` if the typechecker requires a non-null fallback.

- [ ] **Step 4: Commit**

```bash
git add "vibes.diy/pkg/app/routes/vibe.\$ownerHandle.\$appSlug.tsx"
git commit -m "feat(vibe): render UnifiedVibeCard in place of ExpandedVibesPill"
```

---

## Task 6: Full verification + push + PR

- [ ] **Step 1: Run the base + app test suites**

Run: `cd vibes.diy/tests/app && pnpm test`
Expected: PASS, including the new `UnifiedVibeCard` tests and the existing `OptionButtons`/`ShareModal` tests.

- [ ] **Step 2: Run the repo check (format + build + lint + rules-bag)**

Run: `pnpm check`
Then: `pnpm run rules-bag:constructors`
Expected: both PASS. Fix any formatter/lint findings the new file introduces.

- [ ] **Step 3: Build Storybook to confirm the sketch compiles**

Run: `cd vibes.diy/stories && pnpm exec storybook build -o sb-out`
Expected: build succeeds; `Sketches/Agent-in-Vibe` stories present.

- [ ] **Step 4: (Optional, recommended) Screenshot the live + open states for the PR**

Serve `sb-out` on :8901 and screenshot `sketches-agent-in-vibe--live-switch-closed` and `--live-switch-open` at 390×844 (per the issue's loop). Commit PNGs under `notes/sketches/agent-in-vibe/` and embed raw commit-pinned URLs in the PR body.

- [ ] **Step 5: Push and open the PR**

```bash
git push -u origin claude/issue-2675-inline-edit-c85153
```

Open a PR titled for the feature goal (e.g. "Unified vibe card: open the switch into the edit affordance (#2676)"), body referencing #2675 / #2676, label `agent-created`, post a comment @-mentioning `@CharlieHelps`, subscribe to PR activity, and mark `ready-to-merge` once CI is green and feedback is resolved.

---

## Self-Review

**Spec coverage (issue #2676 scope):**

- Unified card on "open" (icon+title / chips+Other / nav) — Tasks 1-3. ✅
- Chips = `OptionButtons` fed by option strings — Task 2. ✅
- Bottom nav order handle·Home·Chat(selected)·Share·toggle — Task 3. ✅
- Closed = lower-right toggle that grows into the card — Task 1 implements the real tween: the **outer card** scales from the toggle corner (`transformOrigin: bottom right`), and the **inner content fades in after** the grow (and out first on close). Per jchris. ✅
- Cached-chip-as-read vs Other-as-write boundary — **logic deferred** to #2677/PR-2; here chips/Other call injected handlers that warn, fed by **placeholder chips** so the affordance reads on the preview. Documented in scope boundaries. ✅
- "Behind a flag" — **explicitly overridden by jchris** (no flag; PR preview). Documented under Decisions. ✅
- Handle picker stub — Task 3 renders `ViewerTagView` with a caret; dropdown is #2678. ✅

**Placeholder scan:** No "TBD"/"add error handling"/"similar to" placeholders; every code step shows full code. ✅

**Type consistency:** Prop names (`appTitle`, `appSlug`, `appIconUrl`, `chips`, `onSelectChip`, `onSubmitOther`, `handleSlug`, `handleAvatarUrl`, `onHome`, `onShare`, `onSignIn`, `isTwinkling`, `open`, `onOpenChange`) are identical across the contract section, Tasks 1-3, the story (Task 4), and the route (Task 5). `setOpen` defined in Task 1 is reused in Task 3's close button. ✅

**Known simplifications flagged (not gaps):** the tween animates only the outer card's scale + an inner fade (not a full path-morph of the VibesSwitch glyph itself); `handleSlug` shows owner handle not viewer active handle (#2678); route chips are hardcoded placeholders until codegen wiring (#2677). All intentional and documented.
