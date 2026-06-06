import React from "react";
import type { StarterNode } from "./starter-tree.js";
import StarterTray from "./StarterTray.js";
import { getAppContainerStyle, getAppBodyStyle, getBackButtonStyle, getAppTitleStyle } from "./StartPage.styles.js";

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
        <button type="button" style={getBackButtonStyle()} onClick={onBack} aria-label="Back">
          ‹
        </button>
        <div style={getAppTitleStyle()}>{node.title}</div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <AppComponent />
        </div>
      </div>
      <StarterTray node={node} isMobile={isMobile} onSelectChiclet={onSelectChiclet} />
    </div>
  );
}
