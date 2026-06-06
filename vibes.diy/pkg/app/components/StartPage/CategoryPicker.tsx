import React, { useCallback, useState } from "react";
import { FaceIcon1, FaceIcon2, FaceIcon3, FaceIcon4, TexturedPattern } from "@vibes.diy/base";
import { playChime, getAudioContext } from "./audio-helpers.js";
import { getCategoryRootId } from "./starter-tree.js";
import {
  getVibeCardWrapperStyle,
  getVibeCardIconContainerStyle,
  getVibeCardTexturedShadowStyle,
  getVibeCardMainIconContainerStyle,
  getVibeCardNameStyle,
} from "../NewSessionContent/NewSessionContent.styles.js";
import { getCategoryGridStyle } from "./StartPage.styles.js";

const CATEGORIES = [
  { label: "Creative", Icon: FaceIcon1 },
  { label: "Productive", Icon: FaceIcon2 },
  { label: "Music", Icon: FaceIcon3 },
  { label: "Games", Icon: FaceIcon4 },
];

interface CategoryPickerProps {
  isMobile: boolean;
  onSelect: (nodeId: string) => void;
}

export default function CategoryPicker({ isMobile, onSelect }: CategoryPickerProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleTouch = useCallback(
    (category: string) => {
      const rootId = getCategoryRootId(category);
      if (!rootId) return;
      const ctx = getAudioContext();
      playChime(ctx);
      onSelect(rootId);
    },
    [onSelect]
  );

  const iconSize = isMobile ? 64 : 100;
  const iconInnerSize = isMobile ? 40 : 68;
  const borderRadius = isMobile ? 16 : 24;

  return (
    <div style={getCategoryGridStyle(isMobile)}>
      {CATEGORIES.map((cat, index) => (
        <button
          key={cat.label}
          type="button"
          style={{
            ...getVibeCardWrapperStyle(),
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleTouch(cat.label);
          }}
          onClick={() => handleTouch(cat.label)}
          aria-label={`Start with ${cat.label}`}
        >
          <div
            style={getVibeCardIconContainerStyle(isMobile)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div style={getVibeCardTexturedShadowStyle(hoveredIndex === index, isMobile)}>
              <TexturedPattern width={iconSize} height={iconSize} borderRadius={borderRadius} />
            </div>
            <div style={getVibeCardMainIconContainerStyle(hoveredIndex === index, isMobile)}>
              <cat.Icon width={iconInnerSize} height={iconInnerSize} fill="var(--vibes-near-black)" />
            </div>
          </div>
          <div style={getVibeCardNameStyle()}>{cat.label}</div>
        </button>
      ))}
    </div>
  );
}
