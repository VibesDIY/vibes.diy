import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { VibesSwitch, OptionButtons, ViewerTagView } from "@vibes.diy/base";

/**
 * SKETCH — "the agent lives in the vibe" (see notes/2026-06-26-agent-in-vibe-ux-epic.md).
 *
 * Presentation-only composition, mobile-first. Non-functional.
 * - `VibesSwitch` and `OptionButtons` are the REAL components (@vibes.diy/base) — single
 *   source of truth, shared with the app. The chips here ARE the chat's suggestion chips.
 * - The inset rounded card (margin:12 / radius:12) and the progressive de-blur
 *   (25px × ⅔ ramp, backdropFilter) reproduce ResultPreview.tsx:108 + PreviewApp.tsx:185-276.
 */

// --- mobile frame -----------------------------------------------------------------------

function Phone({ children }: { readonly children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 390,
        height: 844,
        position: "relative",
        overflow: "hidden",
        borderRadius: 36,
        border: "10px solid #111",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        background: "#000",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}

/** Stand-in for the running vibe behind/around the floating agent overlay. */
function FakeVibeApp({ blurPx = 0 }: { readonly blurPx?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(160deg,#1e1b4b 0%,#312e81 45%,#4c1d95 100%)",
        color: "#e9e7ff",
        padding: 20,
        filter: blurPx > 0.01 ? `blur(${blurPx.toPrecision(3)}px)` : undefined,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 28 }}>Bloom Machine</div>
      <div style={{ opacity: 0.7, fontSize: 13, marginBottom: 18 }}>tap the pads · share the beat</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
        {Array.from({ length: 16 }).map((_, i) => (
          <div
            key={i}
            style={{
              aspectRatio: "1 / 1",
              borderRadius: 12,
              background: i % 5 === 0 ? "rgba(244,114,182,0.85)" : "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Small stand-in for the app icon shown in the unified card header. */
function AppIcon() {
  return (
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        flexShrink: 0,
        background: "linear-gradient(160deg,#312e81,#4c1d95)",
        border: "1px solid rgba(0,0,0,0.15)",
      }}
    />
  );
}

/** EXPERIMENT (might revert): ONE unified overlay = the expanded vibe switch as a single
 *  rounded card that contains everything — icon + title at the top, content in the middle,
 *  and the nav row + toggle at the bottom latitude. No second floating bubble. Variable height. */
function UnifiedOverlay({
  title,
  subtitle,
  children,
  pickerOpen,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: React.ReactNode;
  readonly pickerOpen?: boolean;
}) {
  return (
    <div
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
      }}
      className="text-light-primary dark:text-dark-primary"
    >
      {/* header — icon + title at the top */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px 8px" }}>
        <AppIcon />
        <div style={{ lineHeight: 1.2 }}>
          <strong className="text-sm">{title}</strong>
          {subtitle && (
            <div className="text-light-secondary dark:text-dark-secondary" style={{ fontSize: 12 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {/* body — the content (chips, stream, gate) */}
      <div style={{ padding: "0 14px", overflowY: "auto" }}>{children}</div>
      {/* footer — handle picker (leftmost) + nav links + toggle, at the bottom latitude */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginTop: 10,
          padding: "10px 12px 12px",
          borderTop: "1px solid var(--color-light-decorative-00, #e5e5e5)",
        }}
      >
        <ViewerTag pickerOpen={pickerOpen} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <NavIcon color="#3b82f6">⌂</NavIcon>
          <NavIcon color="#fb923c" selected>
            💬
          </NavIcon>
          <NavIcon color="#22c55e">↗</NavIcon>
        </div>
        <VibesSwitch size={38} isActive />
      </div>
    </div>
  );
}

/** The persistent open vibe-switch nav — lower-right, same-latitude buttons + the toggle,
 *  echoing the real ExpandedVibesPill (cream bar #FFFEF0, near-black border, circular
 *  colored icons). Redefines the nav to Home / Chat(selected) / Share + the VibesSwitch. */
function NavIcon({
  children,
  color,
  selected,
}: {
  readonly children: React.ReactNode;
  readonly color: string;
  readonly selected?: boolean;
}) {
  return (
    <div
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
        border: "1px solid var(--vibes-near-black, #1a1a1a)",
        boxShadow: selected ? "0 0 0 3px var(--vibes-near-black, #1a1a1a)" : "none",
      }}
    >
      {children}
    </div>
  );
}

/** Tiny camera glyph for the me-mode "edit photo" affordance (mirrors the runtime ViewerTag). */
/** One row in the handle dropdown — a handle to act as, or an action. */
function HandleRow({
  initial,
  icon,
  label,
  active,
}: {
  readonly initial?: string;
  readonly icon?: React.ReactNode;
  readonly label: string;
  readonly active?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 8px",
        borderRadius: 8,
        background: active ? "var(--color-light-background-01, #eee)" : "transparent",
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: initial ? "#6366f1" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: initial ? "#fff" : "inherit",
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {initial ?? icon}
      </span>
      <span className="text-sm" style={{ flex: 1 }}>
        {label}
      </span>
      {active && <span style={{ fontSize: 12 }}>✓</span>}
    </div>
  );
}

/** The handle dropdown (the active-handle switcher, #2275) — opens upward from the nav tag. */
function HandleMenu() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        left: 0,
        width: 230,
        background: "var(--color-light-background-00, #fff)",
        border: "1px solid var(--color-light-decorative-01, #ddd)",
        borderRadius: 12,
        boxShadow: "0 10px 36px rgba(0,0,0,0.28)",
        padding: 6,
        zIndex: 10,
      }}
      className="text-light-primary dark:text-dark-primary"
    >
      <div className="text-light-secondary dark:text-dark-secondary" style={{ fontSize: 11, padding: "4px 8px" }}>
        Acting as
      </div>
      <HandleRow initial="M" label="@meghan" active />
      <HandleRow initial="W" label="@meghan_work" />
      <div style={{ height: 1, background: "var(--color-light-decorative-00, #eee)", margin: "6px 0" }} />
      <HandleRow icon={<span style={{ fontSize: 15 }}>＋</span>} label="New handle" />
      {/* No "Edit photo" item — editing a photo is done by clicking the avatar (scoped to
          that handle), reusing the runtime ViewerTag's click-photo logic. */}
    </div>
  );
}

/** Sketch viewer-tag + handle picker for the leftmost of the nav. Composes the REAL shared
 *  `ViewerTagView` (@vibes.diy/base) — the same component the runtime uses — with chrome-side
 *  placeholder actions, plus the new handle dropdown as a sibling. Editing the photo is
 *  clicking the avatar (me mode), scoped to the active handle (no separate menu item). */
function ViewerTag({ pickerOpen }: { readonly pickerOpen?: boolean }) {
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      {pickerOpen && <HandleMenu />}
      <ViewerTagView
        slug="meghan"
        displayName="@meghan"
        editable
        onPickFile={() => undefined}
        trailing={<span style={{ fontSize: 11, opacity: 0.6, marginLeft: 1 }}>▾</span>}
        style={{
          background: "var(--color-light-background-01, #eee)",
          border: "1px solid var(--color-light-decorative-01, #ddd)",
          color: "var(--color-light-primary, #333)",
          fontSize: 13,
          padding: "3px 8px 3px 4px",
          cursor: "pointer",
        }}
      />
    </div>
  );
}

function OtherInput() {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}
      className="rounded-md border border-light-decorative-01 dark:border-dark-decorative-01 px-3 py-2"
    >
      <span className="text-sm text-light-secondary dark:text-dark-secondary" style={{ flex: 1 }}>
        describe a change…
      </span>
      <span aria-hidden style={{ fontSize: 16 }}>
        ▸
      </span>
    </div>
  );
}

const meta: Meta = {
  title: "Sketches/Agent-in-Vibe",
  parameters: {
    layout: "centered",
    viewport: { defaultViewport: "tiny" },
  },
};
export default meta;
type Story = StoryObj;

// --- 1c: live, switch CLOSED (public entry = closed + subtle pulse) ----------------------

export const LiveSwitchClosed: Story = {
  name: "1c · Live — switch closed (public: pulse)",
  render: () => (
    <Phone>
      <FakeVibeApp />
      {/* closed: just the switch in the lower-right (nav collapsed); isTwinkling = public-entry pulse */}
      <div style={{ position: "absolute", right: 14, bottom: 16 }}>
        <VibesSwitch size={48} isTwinkling />
      </div>
    </Phone>
  ),
};

// --- 1a/1c: live, switch OPEN reveals the chips (the edit affordance) --------------------

export const LiveSwitchOpen: Story = {
  name: "1a · Live — switch open (chips)",
  render: () => (
    <Phone>
      <FakeVibeApp />
      <UnifiedOverlay title="Bloom Machine" subtitle="bloom">
        <OptionButtons options={["Make it a drum kit", "Add a high score"]} isFirst />
        <OtherInput />
      </UnifiedOverlay>
    </Phone>
  ),
};

// --- handle picker open — the active-handle display + switcher (#2275), leftmost in the nav --

export const HandlePickerOpen: Story = {
  name: "1a · Handle picker (open)",
  render: () => (
    <Phone>
      <FakeVibeApp />
      <UnifiedOverlay title="Bloom Machine" subtitle="bloom" pickerOpen>
        <OptionButtons options={["Make it a drum kit", "Add a high score"]} isFirst />
        <OtherInput />
      </UnifiedOverlay>
    </Phone>
  ),
};

// --- 1b: first-generation — stream then de-blur into the inset card ----------------------

export const FirstGeneration: StoryObj<{ progress: number }> = {
  name: "1b · First-generation (stream → de-blur)",
  argTypes: {
    progress: { control: { type: "range", min: 0, max: 1, step: 0.05 } },
  },
  args: { progress: 0.35 },
  render: (args) => {
    const p = args.progress;
    // 25px → ~0 across generation (mirrors PreviewApp blur ramp, simplified to a continuous scrub)
    const blurPx = 25 * Math.pow(2 / 3, p * 8);
    const firstCodeDone = p >= 0.6;
    return (
      <Phone>
        <FakeVibeApp blurPx={firstCodeDone ? Math.min(blurPx, 4) : blurPx} />
        <UnifiedOverlay title="Bloom Machine" subtitle={firstCodeDone ? "live ✦" : "building your app…"}>
          {firstCodeDone ? (
            <div className="text-sm">
              <p className="text-light-secondary dark:text-dark-secondary" style={{ marginTop: 2 }}>
                Keep going — tap a chip or describe a change.
              </p>
              <OptionButtons options={["Add a high score", "Make it dark"]} />
              <OtherInput />
            </div>
          ) : (
            <div className="text-sm" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="text-light-secondary dark:text-dark-secondary">▸ laying out a 4×4 pad grid</span>
              <span className="text-light-secondary dark:text-dark-secondary">▸ wiring up the sound</span>
              <code style={{ fontSize: 12, opacity: 0.8 }}>
                ```jsx{"\n"}function App() {"{"}
              </code>
              <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            </div>
          )}
        </UnifiedOverlay>
      </Phone>
    );
  },
};

// --- visitor entry — restricted vibe: blurred preview behind the gate --------------------

export const RestrictedGate: Story = {
  name: "Visitor · restricted (blurred gate)",
  render: () => (
    <Phone>
      <FakeVibeApp blurPx={14} />
      <UnifiedOverlay title="@meghan’s Bloom Machine" subtitle="invite-only">
        <p className="text-light-secondary dark:text-dark-secondary text-sm" style={{ marginTop: 2 }}>
          This vibe is invite-only. Ask to join the shared beat, or start your own.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            className="rounded-md px-3 py-2 text-sm font-medium bg-light-background-01 dark:bg-dark-background-01 border border-light-decorative-01 dark:border-dark-decorative-01"
            style={{ flex: 1 }}
          >
            Request access
          </button>
          <button
            type="button"
            className="rounded-md px-3 py-2 text-sm font-medium border border-light-decorative-01 dark:border-dark-decorative-01"
            style={{ flex: 1 }}
          >
            Make it yours
          </button>
        </div>
      </UnifiedOverlay>
    </Phone>
  ),
};
