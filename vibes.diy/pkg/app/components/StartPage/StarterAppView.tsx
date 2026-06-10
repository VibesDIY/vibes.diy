import React from "react";
import type { StarterNode } from "./starter-tree.js";
import StarterTray from "./StarterTray.js";
import { getAppContainerStyle, getAppBodyStyle, getBackButtonStyle } from "./StartPage.styles.js";

interface StarterAppViewProps {
  node: StarterNode;
  isMobile: boolean;
  onSelectChiclet: (targetId: string) => void;
  onBack: () => void;
}

export default function StarterAppView({ node, isMobile, onSelectChiclet, onBack }: StarterAppViewProps) {
  const AppComponent = node.component;

  return (
    <div style={getAppContainerStyle()}>
      <div style={getAppBodyStyle()}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            backgroundColor: "var(--vibes-cream, #FFFEF0)",
            borderBottom: "2px solid var(--vibes-near-black)",
          }}
        >
          <button type="button" style={getBackButtonStyle()} onClick={onBack} aria-label="Back">
            ‹
          </button>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--vibes-near-black)" }}>
            {node.title}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--vibes-cream, #FFFEF0)",
          }}
        >
          <AppComponent />
        </div>
      </div>
      <StarterTray node={node} isMobile={isMobile} onSelectChiclet={onSelectChiclet} />
    </div>
  );
}
