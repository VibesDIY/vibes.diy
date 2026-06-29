import React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
// VibeEditorPanel lives in the app package (@vibes-diy/pkg), which the stories
// project does not depend on as a published entry point. We reach it via a
// relative path — the same monorepo-source the app builds from — so these
// stories track the real component, not a copy.
import { VibeEditorPanel } from "../../pkg/app/components/vibe-editor/VibeEditorPanel.js";
import type { PromptState } from "../../pkg/app/routes/chat/prompt-state.js";
import { type EditorTab } from "../../pkg/app/components/vibe-editor/editor-tab-state.js";

/**
 * Storybook coverage for the in-page tabbed editor surface on /vibe (#2518
 * Phase 1). One story per tab (Code / Data / Chat / Settings) plus a 390×844
 * mobile variant for Code and Settings — evidence that the surface is
 * always-mobile (no viewport gating).
 *
 * These stories render WITHOUT the app's data providers, so:
 *   - the Data tab's cross-origin iframe and the Settings tab's `sharedApi`
 *     fetch render empty/loading — that is expected. The stories evidence
 *     layout + reachability of every tab, not live data.
 *   - the Code tab DOES render real source from the `hydratedFileSystem`
 *     fixture, and the Chat tab DOES render its empty "history isn't loaded"
 *     state from `blocks: []`.
 */

// --- fixtures ----------------------------------------------------------------------------

/**
 * Minimal PromptState for the stories. Only the fields the editor tabs read are
 * populated; the rest is cast away. The Code tab renders from
 * `hydratedFileSystem`; the Chat tab keys off `blocks.length`.
 */
const emptyChatState = {
  blocks: [],
  hydratedFileSystem: {
    fsId: "demo",
    files: [
      {
        fileName: "/App.jsx",
        lang: "jsx",
        code: ["export default function App(){", "  return <h1>Hello</h1>;", "}"],
      },
    ],
  },
} as unknown as PromptState;

// --- mobile frame ------------------------------------------------------------------------

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
        background: "#fff",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}

/** Desktop host: a bordered card with a fixed height so the flex column resolves. */
function Desk({ children }: { readonly children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 880,
        height: 560,
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      {children}
    </div>
  );
}

function Panel({ tab }: { readonly tab: EditorTab }) {
  return <VibeEditorPanel tab={tab} onTab={() => undefined} ownerHandle="demo" appSlug="demo-app" promptState={emptyChatState} />;
}

const meta: Meta = {
  title: "sketches/VibeEditorPanel",
};
export default meta;

type Story = StoryObj;

// --- desktop: one per tab ----------------------------------------------------------------

export const Code: Story = {
  name: "Code tab (desktop)",
  render: () => (
    <Desk>
      <Panel tab="code" />
    </Desk>
  ),
};

export const Data: Story = {
  name: "Data tab (desktop)",
  render: () => (
    <Desk>
      <Panel tab="data" />
    </Desk>
  ),
};

export const Chat: Story = {
  name: "Chat tab (desktop · history not loaded)",
  render: () => (
    <Desk>
      <Panel tab="chat" />
    </Desk>
  ),
};

export const Settings: Story = {
  name: "Settings tab (desktop)",
  render: () => (
    <Desk>
      <Panel tab="settings" />
    </Desk>
  ),
};

// --- 390×844 mobile: evidence the surface is always-mobile (no gating) -------------------

export const CodeMobile: Story = {
  name: "Code tab (390×844 mobile)",
  parameters: { viewport: { defaultViewport: "tiny" } },
  render: () => (
    <Phone>
      <Panel tab="code" />
    </Phone>
  ),
};

export const SettingsMobile: Story = {
  name: "Settings tab (390×844 mobile)",
  parameters: { viewport: { defaultViewport: "tiny" } },
  render: () => (
    <Phone>
      <Panel tab="settings" />
    </Phone>
  ),
};
