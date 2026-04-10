import React, { useCallback, useState } from "react";
import type { ReactElement } from "react";
import { TexturedPattern } from "@vibes.diy/base";

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
    <button
      type="button"
      className="flex cursor-pointer flex-col items-center gap-2 border-none bg-none p-0"
      onClick={handleClick}
      aria-label={`Get a random ${category} prompt`}
    >
      <div
        className={`relative ${isMobile ? "h-16 w-16" : "h-[100px] w-[100px]"}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Textured shadow */}
        <div
          className={`absolute overflow-hidden transition-all duration-200 ease-in-out ${isMobile ? "rounded-2xl" : "rounded-3xl"}`}
          style={{
            width: iconSize,
            height: iconSize,
            top: "8px",
            left: isHovered ? "10px" : "8px",
            zIndex: 0,
          }}
        >
          <TexturedPattern width={iconSize} height={iconSize} borderRadius={borderRadius} />
        </div>

        {/* Main icon container */}
        <div
          className={`relative flex items-center justify-center border-2 border-near-black bg-light-background-00 transition-transform duration-200 ease-in-out dark:bg-dark-background-00 ${isMobile ? "rounded-2xl p-2" : "rounded-3xl p-4"}`}
          style={{
            width: iconSize,
            height: iconSize,
            transform: isHovered ? "translate(-2px, -2px)" : "translate(0, 0)",
            zIndex: 1,
            cursor: "pointer",
          }}
        >
          {IconComponent && <IconComponent width={iconInnerSize} height={iconInnerSize} fill="currentColor" />}
        </div>
      </div>
      <div className="w-[110px] truncate text-center text-base font-medium text-near-black dark:text-dark-primary">{category}</div>
    </button>
  );
}
