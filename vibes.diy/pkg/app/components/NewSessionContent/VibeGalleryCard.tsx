import React, { ReactElement, useCallback, useState } from "react";
import { TexturedPattern } from "@vibes.diy/base";
import {
  getVibeCardWrapperStyle,
  getVibeCardIconContainerStyle,
  getVibeCardTexturedShadowStyle,
  getVibeCardMainIconContainerStyle,
  getVibeCardNameStyle,
} from "./NewSessionContent.styles.js";

interface VibeGalleryCardProps {
  category: string;
  prompts: string[];
  IconComponent?: React.ComponentType<{
    width?: number;
    height?: number;
    fill?: string;
  }>;
  isMobile?: boolean;
  onSelectPrompt?: (prompt: string) => void;
}

export default function VibeGalleryCard({
  category,
  prompts,
  IconComponent,
  isMobile = false,
  onSelectPrompt,
}: VibeGalleryCardProps): ReactElement {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * prompts.length);
    onSelectPrompt?.(prompts[randomIndex]);
  }, [prompts, onSelectPrompt]);

  const iconSize = isMobile ? 64 : 100;
  const iconInnerSize = isMobile ? 40 : 68;
  const borderRadius = isMobile ? 16 : 24;

  return (
    <div
      style={{ ...getVibeCardWrapperStyle(), cursor: "pointer" }}
      onClick={handleClick}
    >
      <div
        style={getVibeCardIconContainerStyle(isMobile)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div style={getVibeCardTexturedShadowStyle(isHovered, isMobile)}>
          <TexturedPattern
            width={iconSize}
            height={iconSize}
            borderRadius={borderRadius}
          />
        </div>

        <div style={getVibeCardMainIconContainerStyle(isHovered, isMobile)}>
          {IconComponent && (
            <IconComponent
              width={iconInnerSize}
              height={iconInnerSize}
              fill="var(--vibes-near-black)"
            />
          )}
        </div>
      </div>
      <div style={getVibeCardNameStyle()}>{category}</div>
    </div>
  );
}
