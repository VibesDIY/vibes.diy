import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { VibesSwitch, OptionButtons, ViewerTagView, UnifiedVibeCard, SharePanelView } from "@vibes.diy/base";
import type { ShareAccess, ShareMember, HandleOption } from "@vibes.diy/base";

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
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: React.ReactNode;
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
        <ViewerTag />
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

/** Sketch viewer-tag for the leftmost of the nav. Composes the REAL shared
 *  `ViewerTagView` (@vibes.diy/base) — the same component the runtime uses — with chrome-side
 *  placeholder actions. Editing the photo is clicking the avatar (me mode), scoped to the
 *  active handle (no separate menu item). The handle dropdown itself is the real
 *  `HandlePickerMenu` (@vibes.diy/base), shown in the `HandlePickerOpen` story below via the
 *  as-built `UnifiedVibeCard`. */
function ViewerTag() {
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
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
      <UnifiedVibeCard appTitle="Bloom Machine" appSlug="meghan/bloom" isTwinkling />
    </Phone>
  ),
};

// --- 1a/1c: live, switch OPEN reveals the chips (the edit affordance) --------------------

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
        viewerMode="author"
        chips={["Make it a drum kit", "Add a high score"]}
        onSelectChip={() => undefined}
        onSubmitOther={() => undefined}
        onHome={() => undefined}
        onShare={() => undefined}
      />
    </Phone>
  ),
};

// --- handle picker open — the active-handle display + switcher (#2275), leftmost in the nav --

const PICKER_HANDLES: readonly HandleOption[] = [{ slug: "meghan" }, { slug: "meghan_work" }];

export const HandlePickerOpen: Story = {
  name: "1a · Handle picker (open)",
  render: () => (
    <Phone>
      <FakeVibeApp />
      {/* The as-built UnifiedVibeCard with the active-handle switcher open — the real
          HandlePickerMenu (@vibes.diy/base) drops below the header tag (#2678 / UI for #2275). */}
      <UnifiedVibeCard
        open
        handlePickerOpen
        appTitle="Bloom Machine"
        appSlug="meghan/bloom"
        handleSlug="meghan"
        handles={PICKER_HANDLES}
        chips={["Make it a drum kit", "Add a high score"]}
        onSelectChip={() => undefined}
        onSubmitOther={() => undefined}
        onHome={() => undefined}
        onShare={() => undefined}
        onSelectHandle={() => undefined}
        onNewHandle={() => undefined}
      />
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

// --- Share dialogue (simplified in-group model, #2680 groundwork) ------------------------
// Real `SharePanelView` rendered inside the unified card's body via its `body` slot, so we
// can iterate on the actual component (single-source-of-truth loop). Three in-scope classes:
// anonymous → Copy URL · member → + roster · author → + access setting.

const ROSTER: readonly ShareMember[] = [
  { handle: "meghan", role: "owner" },
  { handle: "alex", role: "editor" },
  { handle: "sam", role: "viewer" },
];

function ShareBody({
  viewer,
  initialAccess = "public",
}: {
  readonly viewer: "anonymous" | "member" | "author";
  readonly initialAccess?: ShareAccess;
}) {
  const [copied, setCopied] = React.useState(false);
  const [access, setAccess] = React.useState<ShareAccess>(initialAccess);
  return (
    <SharePanelView
      url="vibes.diy/meghan/bloom"
      copied={copied}
      onCopy={() => setCopied(true)}
      onViewLive={() => undefined}
      viewer={viewer}
      members={viewer === "anonymous" ? [] : ROSTER}
      access={access}
      onChangeAccess={setAccess}
      onSelectMember={() => undefined}
    />
  );
}

export const ShareVisitor: Story = {
  name: "Share · anonymous visitor (copy URL)",
  render: () => (
    <Phone>
      <FakeVibeApp />
      <UnifiedVibeCard
        open
        appTitle="Bloom Machine"
        appSlug="meghan/bloom"
        selectedNav="share"
        onHome={() => undefined}
        onShare={() => undefined}
        onSignIn={() => undefined}
        body={<ShareBody viewer="anonymous" />}
      />
    </Phone>
  ),
};

export const ShareMemberView: Story = {
  name: "Share · granted member, gated (+ roster)",
  render: () => (
    <Phone>
      <FakeVibeApp />
      <UnifiedVibeCard
        open
        appTitle="Bloom Machine"
        appSlug="meghan/bloom"
        handleSlug="alex"
        viewerMode="member"
        memberReadOnly
        selectedNav="share"
        onHome={() => undefined}
        onShare={() => undefined}
        body={<ShareBody viewer="member" initialAccess="request" />}
      />
    </Phone>
  ),
};

export const ShareAuthorView: Story = {
  name: "Share · author (+ access setting)",
  render: () => (
    <Phone>
      <FakeVibeApp />
      <UnifiedVibeCard
        open
        appTitle="Bloom Machine"
        appSlug="meghan/bloom"
        handleSlug="meghan"
        viewerMode="author"
        selectedNav="share"
        onHome={() => undefined}
        onShare={() => undefined}
        body={<ShareBody viewer="author" />}
      />
    </Phone>
  ),
};
