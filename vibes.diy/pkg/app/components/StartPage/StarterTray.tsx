import React, { useCallback } from "react";
import { useNavigate } from "react-router";
import { BuildURI } from "@adviser/cement";
import { VibesButton } from "@vibes.diy/base";
import { useVibesDiy } from "../../vibes-diy-provider.js";
import type { StarterNode } from "./starter-tree.js";
import { getTrayStyle, getTrayLabelStyle, getTrayButtonsStyle } from "./StartPage.styles.js";

interface StarterTrayProps {
  node: StarterNode;
  isMobile: boolean;
  onSelectChiclet: (targetId: string) => void;
}

export default function StarterTray({ node, isMobile, onSelectChiclet }: StarterTrayProps) {
  const navigate = useNavigate();
  const { sthis } = useVibesDiy();

  const handleOther = useCallback(() => {
    const categoryPrompt = `Make me a ${node.category} app`;
    sessionStorage.setItem("vibes.pendingPrompt", categoryPrompt);
    navigate(
      BuildURI.from(window.location.href).pathname("/chat/prompt").setParam("prompt64", sthis.txt.base64.encode(categoryPrompt))
        .withoutHostAndSchema
    );
  }, [node.category, navigate, sthis]);

  return (
    <div style={getTrayStyle(isMobile)}>
      <div style={getTrayLabelStyle()}>✦ Make it yours</div>
      <div style={getTrayButtonsStyle()}>
        {node.chiclets.map((chiclet) => (
          <VibesButton
            key={chiclet.targetId}
            variant={chiclet.variant}
            onClick={() => onSelectChiclet(chiclet.targetId)}
            style={{ flex: 1, minWidth: 0 }}
          >
            {chiclet.label}
          </VibesButton>
        ))}
        <VibesButton variant="gray" onClick={handleOther} style={{ flex: 1, minWidth: 0 }}>
          Other…
        </VibesButton>
      </div>
    </div>
  );
}
